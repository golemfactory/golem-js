import { _, imock, instance, mock, reset, spy, verify, when } from "@johanblumenberg/ts-mockito";
import { Logger, YagnaApi } from "../shared/utils";
import { MarketModuleImpl } from "./market.module";
import * as YaTsClient from "ya-ts-client";
import { Demand, DemandSpecification, IDemandRepository } from "./demand";
import { from, of, take, takeUntil, timer } from "rxjs";
import { IProposalRepository, OfferProposal, ProposalProperties } from "./offer-proposal";
import { MarketApiAdapter } from "../shared/yagna/";
import { Agreement, IAgreementApi } from "./agreement/agreement";
import { IActivityApi, IFileServer } from "../activity";
import { StorageProvider } from "../shared/storage";
import { GolemMarketError } from "./error";
import { Allocation, IPaymentApi } from "../payment";
import { INetworkApi } from "../network/api";
import { NetworkModule } from "../network";
import { DraftOfferProposalPool } from "./draft-offer-proposal-pool";
import { MarketOrderSpec } from "../golem-network";

const mockMarketApiAdapter = mock(MarketApiAdapter);
const mockYagna = mock(YagnaApi);
let marketModule: MarketModuleImpl;

beforeEach(() => {
  jest.useFakeTimers();
  jest.resetAllMocks();
  reset(mockMarketApiAdapter);
  marketModule = new MarketModuleImpl({
    activityApi: instance(imock<IActivityApi>()),
    paymentApi: instance(imock<IPaymentApi>()),
    agreementApi: instance(imock<IAgreementApi>()),
    networkApi: instance(imock<INetworkApi>()),
    proposalRepository: instance(imock<IProposalRepository>()),
    demandRepository: instance(imock<IDemandRepository>()),
    yagna: instance(mockYagna),
    logger: instance(imock<Logger>()),
    marketApi: instance(mockMarketApiAdapter),
    fileServer: instance(imock<IFileServer>()),
    storageProvider: instance(imock<StorageProvider>()),
    networkModule: instance(imock<NetworkModule>()),
  });
});

describe("Market module", () => {
  describe("buildDemand()", () => {
    it("should build a demand", async () => {
      const allocation = {
        id: "allocation-id",
        paymentPlatform: "erc20-holesky-tglm",
      } as Allocation;
      when(mockMarketApiAdapter.getPaymentRelatedDemandDecorations("allocation-id")).thenResolve({
        properties: [
          {
            key: "golem.com.payment.platform.erc20-holesky-tglm.address",
            value: "0x123",
          },
          {
            key: "golem.com.payment.protocol.version",
            value: "2",
          },
        ],
        constraints: [
          "(golem.com.payment.platform.erc20-holesky-tglm.address=*)",
          "(golem.com.payment.protocol.version>1)",
        ],
      });

      const demandSpecification = await marketModule.buildDemandDetails(
        {
          workload: {
            imageHash: "AAAAHASHAAAA",
            imageUrl: "https://custom.image.url/",
          },
          expirationSec: 42,
          payment: {
            debitNotesAcceptanceTimeoutSec: 42,
            midAgreementDebitNoteIntervalSec: 42,
            midAgreementPaymentTimeoutSec: 42,
          },
        },
        allocation,
      );

      const expectedConstraints = [
        "(golem.com.pricing.model=linear)",
        "(golem.node.debug.subnet=public)",
        "(golem.runtime.name=vm)",
        "(golem.inf.mem.gib>=0.5)",
        "(golem.inf.storage.gib>=2)",
        "(golem.inf.cpu.cores>=1)",
        "(golem.inf.cpu.threads>=1)",
        "(golem.com.payment.platform.erc20-holesky-tglm.address=*)",
        "(golem.com.payment.protocol.version>1)",
      ];

      const expectedProperties = [
        {
          key: "golem.srv.caps.multi-activity",
          value: true,
        },
        {
          key: "golem.srv.comp.expiration",
          value: Date.now() + 42 * 1000,
        },
        {
          key: "golem.node.debug.subnet",
          value: "public",
        },
        {
          key: "golem.srv.comp.vm.package_format",
          value: "gvmkit-squash",
        },
        {
          key: "golem.srv.comp.task_package",
          value: "hash:sha3:AAAAHASHAAAA:https://custom.image.url/",
        },
        {
          key: "golem.com.scheme.payu.debit-note.interval-sec?",
          value: 42,
        },
        {
          key: "golem.com.scheme.payu.payment-timeout-sec?",
          value: 42,
        },
        {
          key: "golem.com.payment.debit-notes.accept-timeout?",
          value: 42,
        },
        {
          key: "golem.com.payment.platform.erc20-holesky-tglm.address",
          value: "0x123",
        },
        {
          key: "golem.com.payment.protocol.version",
          value: "2",
        },
      ];

      expect(demandSpecification.paymentPlatform).toBe(allocation.paymentPlatform);
      expect(demandSpecification.expirationSec).toBe(42);
      expect(demandSpecification.prototype.constraints).toEqual(expect.arrayContaining(expectedConstraints));
      expect(demandSpecification.prototype.properties).toEqual(expectedProperties);
    });
  });

  describe("publishDemand()", () => {
    it("should publish a demand", (done) => {
      const mockSpecification = mock(DemandSpecification);
      when(mockMarketApiAdapter.publishDemandSpecification(mockSpecification)).thenCall(async (specification) => {
        return new Demand("demand-id", specification);
      });

      const demand$ = marketModule.publishDemand(mockSpecification);
      demand$.pipe(take(1)).subscribe({
        next: (demand) => {
          try {
            expect(demand).toEqual(new Demand("demand-id", mockSpecification));
            done();
          } catch (error) {
            done(error);
          }
        },
        error: (error) => done(error),
      });
    });

    it("should emit a new demand every specified interval", (done) => {
      const mockSpecification = mock(DemandSpecification);
      when(mockSpecification.expirationSec).thenReturn(10);
      const mockSpecificationInstance = instance(mockSpecification);
      const mockDemand0 = new Demand("demand-id-0", mockSpecificationInstance);
      const mockDemand1 = new Demand("demand-id-1", mockSpecificationInstance);
      const mockDemand2 = new Demand("demand-id-2", mockSpecificationInstance);

      when(mockMarketApiAdapter.publishDemandSpecification(_))
        .thenResolve(mockDemand0)
        .thenResolve(mockDemand1)
        .thenResolve(mockDemand2);
      when(mockMarketApiAdapter.unpublishDemand(_)).thenResolve();

      const demand$ = marketModule.publishDemand(mockSpecificationInstance);
      const demands: Demand[] = [];
      demand$.pipe(take(3)).subscribe({
        next: (demand) => {
          demands.push(demand);
          jest.advanceTimersByTime(10 * 1000);
        },
        complete: () => {
          try {
            expect(demands).toEqual([mockDemand0, mockDemand1, mockDemand2]);
            verify(mockMarketApiAdapter.unpublishDemand(demands[0])).once();
            verify(mockMarketApiAdapter.unpublishDemand(demands[1])).once();
            verify(mockMarketApiAdapter.unpublishDemand(demands[2])).once();
            verify(mockMarketApiAdapter.unpublishDemand(_)).times(3);
            done();
          } catch (error) {
            done(error);
          }
        },
        error: (error) => done(error),
      });
    });

    it("should throw an error if the demand cannot be subscribed", (done) => {
      const mockSpecification = mock(DemandSpecification);
      const details = instance(mockSpecification);

      when(mockMarketApiAdapter.publishDemandSpecification(_)).thenReject(new Error("Triggered"));

      const demand$ = marketModule.publishDemand(details);

      demand$.subscribe({
        error: (err: GolemMarketError) => {
          try {
            expect(err.message).toEqual("Could not publish demand on the market");
            expect(err.previous?.message).toEqual("Triggered");
            done();
          } catch (assertionError) {
            done(assertionError);
          }
        },
      });
    });
  });

  describe("subscribeForProposals()", () => {
    it("should filter out proposals that are invalid (in terms of content)", (done) => {
      const mockDemand = instance(imock<Demand>());
      const mockProposalDTO = imock<YaTsClient.MarketApi.ProposalEventDTO["proposal"]>();

      when(mockProposalDTO.issuerId).thenReturn("issuer-id");
      when(mockProposalDTO.properties).thenReturn({
        "golem.com.usage.vector": ["golem.usage.duration_sec", "golem.usage.cpu_sec"],
        "golem.com.pricing.model.linear.coeffs": [0.1, 0.1],
      });

      const mockProposalEventSuccess: YaTsClient.MarketApi.ProposalEventDTO = {
        eventType: "ProposalEvent",
        eventDate: "0000-00-00",
        proposal: instance(mockProposalDTO),
      };
      const mockProposalEventRejected: YaTsClient.MarketApi.ProposalRejectedEventDTO = {
        eventType: "ProposalRejectedEvent",
        eventDate: "0000-00-00",
        proposalId: "proposal-id",
        reason: { key: "value" },
      };

      when(mockMarketApiAdapter.observeProposalEvents(_)).thenReturn(
        from([
          mockProposalEventSuccess,
          mockProposalEventSuccess,
          mockProposalEventRejected,
          mockProposalEventSuccess,
          mockProposalEventRejected,
          mockProposalEventSuccess,
        ]),
      );

      const proposal$ = marketModule.subscribeForProposals(mockDemand);

      let proposalsEmitted = 0;

      proposal$.subscribe({
        error: (error) => {
          done(error);
        },
        next: () => {
          proposalsEmitted++;
        },
        complete: () => {
          try {
            expect(proposalsEmitted).toBe(4);
            done();
          } catch (error) {
            done(error);
          }
        },
      });
    });
  });

  describe("startCollectingProposals()", () => {
    it("should negotiate any initial proposals", (done) => {
      jest.useRealTimers();
      const mockSpecification = mock(DemandSpecification);
      const demandSpecification = instance(mockSpecification);
      const proposalProperties = {
        ["golem.inf.cpu.cores"]: 1,
        ["golem.inf.cpu.threads"]: 1,
        ["golem.inf.mem.gib"]: 1,
      } as ProposalProperties;
      const proposal1 = {
        isInitial: () => true,
        isDraft: () => false,
        isValid: () => true,
        getDto: () => ({
          state: "Initial",
        }),
        provider: {
          id: "provider-1",
        },
        properties: proposalProperties,
        getEstimatedCost: () => 1,
      } as OfferProposal;
      const proposal2 = {
        isInitial: () => true,
        isDraft: () => false,
        isValid: () => true,
        getDto: () => ({
          state: "Initial",
        }),
        provider: {
          id: "provider-2",
        },
        properties: proposalProperties,
        getEstimatedCost: () => 1,
      } as OfferProposal;
      const proposal3 = {
        isInitial: () => false,
        isDraft: () => true,
        isValid: () => true,
        getDto: () => ({
          state: "Draft",
        }),
        provider: {
          id: "provider-3",
        },
        properties: proposalProperties,
        getEstimatedCost: () => 1,
      } as OfferProposal;
      const proposal4 = {
        isInitial: () => false,
        isDraft: () => true,
        isValid: () => true,
        getDto: () => ({
          state: "Draft",
        }),
        provider: {
          id: "provider-1",
        },
        properties: proposalProperties,
        getEstimatedCost: () => 1,
      } as OfferProposal;

      marketModule.publishDemand = jest.fn().mockReturnValue(of({ id: "demand-id" }));
      marketModule.negotiateProposal = jest.fn();
      marketModule.subscribeForProposals = jest
        .fn()
        .mockReturnValue(from([proposal1, proposal2, proposal3, proposal4]));

      const draftProposals: OfferProposal[] = [];
      marketModule
        .startCollectingProposals({
          demandSpecification,
          bufferSize: 1,
          proposalsBatchReleaseTimeoutMs: 10,
        })
        // using timer instead of take here because proposalBatch releases initial proposals
        // after a timeout (10ms) so draftProposals will be emitted before that happens
        .pipe(takeUntil(timer(50)))
        .subscribe({
          next: (proposal) => {
            draftProposals.push(...proposal);
          },
          complete: () => {
            try {
              expect(draftProposals).toEqual([proposal3, proposal4]);
              expect(marketModule.negotiateProposal).toHaveBeenCalledTimes(2);
              expect(marketModule.negotiateProposal).toHaveBeenCalledWith(proposal1, demandSpecification);
              expect(marketModule.negotiateProposal).toHaveBeenCalledWith(proposal2, demandSpecification);
              done();
            } catch (error) {
              done(error);
            }
          },
          error: (error) => done(error),
        });
    });
    it("should reduce proposals from the same provider", (done) => {
      jest.useRealTimers();

      const mockSpecification = mock(DemandSpecification);
      const demandSpecification = instance(mockSpecification);
      const proposalProperties = {
        ["golem.inf.cpu.cores"]: 1,
        ["golem.inf.cpu.threads"]: 1,
        ["golem.inf.mem.gib"]: 1,
      } as ProposalProperties;
      const proposal1 = {
        isInitial: () => true,
        isDraft: () => false,
        isValid: () => true,
        getDto: () => ({
          state: "Initial",
        }),
        provider: {
          id: "provider-1",
        },
        properties: proposalProperties,
        getEstimatedCost: () => 99,
      } as OfferProposal;
      const proposal2 = {
        isInitial: () => true,
        isDraft: () => false,
        isValid: () => true,
        getDto: () => ({
          state: "Initial",
        }),
        provider: {
          id: "provider-2",
        },
        properties: proposalProperties,
        getEstimatedCost: () => 1,
      } as OfferProposal;
      const proposal3 = {
        isInitial: () => true,
        isDraft: () => false,
        isValid: () => true,
        getDto: () => ({
          state: "Initial",
        }),
        provider: {
          id: "provider-1",
        },
        properties: proposalProperties,
        getEstimatedCost: () => 1,
      } as OfferProposal;
      const proposal4 = {
        isInitial: () => false,
        isDraft: () => true,
        isValid: () => true,
        getDto: () => ({
          state: "Draft",
        }),
        provider: {
          id: "provider-1",
        },
        properties: proposalProperties,
        getEstimatedCost: () => 1,
      } as OfferProposal;

      marketModule.publishDemand = jest.fn().mockReturnValue(of({ id: "demand-id" }));
      marketModule.negotiateProposal = jest.fn();
      marketModule.subscribeForProposals = jest
        .fn()
        .mockReturnValue(from([proposal1, proposal2, proposal3, proposal4]));

      const draftProposals: OfferProposal[] = [];
      marketModule
        .startCollectingProposals({
          demandSpecification,
          bufferSize: 1,
          proposalsBatchReleaseTimeoutMs: 10,
        })
        // using timer instead of take here because proposalBatch releases initial proposals
        // after a timeout (10ms) so draftProposals will be emitted before that happens
        .pipe(takeUntil(timer(50)))
        .subscribe({
          next: (proposal) => {
            draftProposals.push(...proposal);
          },
          complete: () => {
            try {
              expect(draftProposals.length).toBe(1);
              expect(marketModule.negotiateProposal).toHaveBeenCalledTimes(2);
              expect(marketModule.negotiateProposal).toHaveBeenCalledWith(proposal2, demandSpecification);
              expect(marketModule.negotiateProposal).toHaveBeenCalledWith(proposal3, demandSpecification);
              done();
            } catch (error) {
              done(error);
            }
          },
        });
    });
  });
  describe("signAgreementFromPool()", () => {
    beforeEach(() => {
      jest.useRealTimers();
    });
    it("should keep acquiring proposals until one is successfully signed", async () => {
      const badProposal0 = {} as OfferProposal;
      const badProposal1 = {} as OfferProposal;
      const goodProposal = {} as OfferProposal;
      const mockPool = mock(DraftOfferProposalPool);
      when(mockPool.acquire()).thenResolve(badProposal0).thenResolve(badProposal1).thenResolve(goodProposal);
      when(mockPool.remove(_)).thenResolve();
      const goodAgreement = {} as Agreement;
      const marketSpy = spy(marketModule);
      when(marketSpy.proposeAgreement(goodProposal)).thenResolve(goodAgreement);
      when(marketSpy.proposeAgreement(badProposal0)).thenReject(new Error("Failed to sign proposal"));
      when(marketSpy.proposeAgreement(badProposal1)).thenReject(new Error("Failed to sign proposal"));

      const signedProposal = await marketModule.signAgreementFromPool(instance(mockPool));

      verify(mockPool.acquire()).thrice();
      verify(marketSpy.proposeAgreement(badProposal0)).once();
      verify(mockPool.remove(badProposal0)).once();
      verify(marketSpy.proposeAgreement(badProposal1)).once();
      verify(mockPool.remove(badProposal1)).once();
      verify(marketSpy.proposeAgreement(goodProposal)).once();
      verify(mockPool.remove(goodProposal)).once();
      expect(signedProposal).toBe(goodAgreement);
    });
    it("should release the proposal if the operation is cancelled between acquiring and signing", async () => {
      const ac = new AbortController();
      const error = new Error("Operation cancelled");
      const proposal = {} as OfferProposal;
      const mockPool = mock(DraftOfferProposalPool);
      when(mockPool.acquire()).thenCall(async () => {
        ac.abort(error);
        return proposal;
      });
      const marketSpy = spy(marketModule);

      await expect(marketModule.signAgreementFromPool(instance(mockPool), ac.signal)).rejects.toThrow(error);

      verify(mockPool.acquire()).once();
      verify(mockPool.release(proposal)).once();
      verify(mockPool.remove(_)).never();
      verify(marketSpy.proposeAgreement(_)).never();
    });
    it("should abort immediately if the given signal is already aborted", async () => {
      const mockPool = mock(DraftOfferProposalPool);
      const signal = AbortSignal.abort();
      await expect(marketModule.signAgreementFromPool(instance(mockPool), signal)).rejects.toThrow(
        "This operation was aborted",
      );
      verify(mockPool.acquire()).never();
    });
    it("should abort after a set timeout", async () => {
      const mockPool = mock(DraftOfferProposalPool);
      when(mockPool.acquire()).thenResolve({} as OfferProposal);
      when(mockPool.remove(_)).thenResolve();
      const marketSpy = spy(marketModule);
      when(marketSpy.proposeAgreement(_)).thenReject(new Error("Failed to sign proposal"));

      await expect(marketModule.signAgreementFromPool(instance(mockPool), 50)).rejects.toThrow(
        "The operation was aborted due to timeout",
      );
    });
    it("respects the timeout on draft proposal pool acquire and forwards the error", async () => {
      const mockAcquire: DraftOfferProposalPool["acquire"] = jest
        .fn()
        .mockImplementation(
          () => new Promise((_, reject) => setTimeout(() => reject(new Error("Failed to acquire")), 10)),
        );
      const mockPool = {
        acquire: mockAcquire,
      } as DraftOfferProposalPool;
      expect(marketModule.signAgreementFromPool(mockPool)).rejects.toThrow("Failed to acquire");
    });
  });
  describe("estimateBudget()", () => {
    it("estimates budget for the exact concurrency level", () => {
      const order: MarketOrderSpec = {
        demand: {
          workload: {
            imageTag: "image",
            minCpuThreads: 5,
          },
        },
        market: {
          rentHours: 5,
          pricing: {
            model: "linear",
            maxStartPrice: 1,
            maxEnvPerHourPrice: 2,
            maxCpuPerHourPrice: 0.5,
          },
        },
      };
      const concurrency = 3;
      const cpuPrice = 0.5 * 5 * 5; // 5 threads for 0.5 per hour for 5 hours
      const envPrice = 2 * 5; // 2 per hour for 5 hours
      const totalPricePerMachine = 1 + cpuPrice + envPrice;
      const expectedBudget = totalPricePerMachine * concurrency;

      const budget = marketModule.estimateBudget({ order, concurrency });
      expect(budget).toBeCloseTo(expectedBudget, 5);
    });
    it("estimates budget for max concurrency level", () => {
      const order: MarketOrderSpec = {
        demand: {
          workload: {
            imageTag: "image",
            minCpuThreads: 5,
          },
        },
        market: {
          rentHours: 5,
          pricing: {
            model: "linear",
            maxStartPrice: 1,
            maxEnvPerHourPrice: 2,
            maxCpuPerHourPrice: 0.5,
          },
        },
      };
      const concurrency = { max: 10 };
      const cpuPrice = 0.5 * 5 * 5; // 5 threads for 0.5 per hour for 5 hours
      const envPrice = 2 * 5; // 2 per hour for 5 hours
      const totalPricePerMachine = 1 + cpuPrice + envPrice;
      const expectedBudget = totalPricePerMachine * concurrency.max;

      const budget = marketModule.estimateBudget({ order, concurrency });
      expect(budget).toBeCloseTo(expectedBudget, 5);
    });
    it("estimates budget for non-linear pricing model", () => {
      const order: MarketOrderSpec = {
        demand: {
          workload: {
            imageTag: "image",
          },
        },
        market: {
          rentHours: 5,
          pricing: {
            model: "burn-rate",
            avgGlmPerHour: 2,
          },
        },
      };
      const concurrency = 3;
      const expectedBudget = 5 * 2 * concurrency;

      const budget = marketModule.estimateBudget({ order, concurrency });
      expect(budget).toBeCloseTo(expectedBudget, 5);
    });
  });
});
