import { _, imock, instance, mock, reset, verify, when } from "@johanblumenberg/ts-mockito";
import { Logger, YagnaApi } from "../shared/utils";
import { MarketModuleImpl } from "./market.module";
import * as YaTsClient from "ya-ts-client";
import { DemandNew, DemandSpecification, IDemandRepository } from "./demand";
import { from, of, take, takeUntil, timer } from "rxjs";
import { IProposalRepository, ProposalNew, ProposalProperties } from "./proposal";
import { MarketApiAdapter } from "../shared/yagna/";
import { IActivityApi, IPaymentApi } from "../agreement";
import { IAgreementApi } from "../agreement/agreement";
import { PayerDetails } from "../payment/PayerDetails";
import { IFileServer } from "../activity";
import { StorageProvider } from "../shared/storage";

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
    proposalRepository: instance(imock<IProposalRepository>()),
    demandRepository: instance(imock<IDemandRepository>()),
    yagna: instance(mockYagna),
    logger: instance(imock<Logger>()),
    marketApi: instance(mockMarketApiAdapter),
    fileServer: instance(imock<IFileServer>()),
    storageProvider: instance(imock<StorageProvider>()),
  });
});

describe("Market module", () => {
  describe("buildDemand()", () => {
    it("should build a demand", async () => {
      const payerDetails = new PayerDetails("holesky", "erc20", "0x123");

      const demandSpecification = await marketModule.buildDemand(
        {
          imageHash: "AAAAHASHAAAA",
          imageUrl: "https://custom.image.url/",
          expirationSec: 42,
          debitNotesAcceptanceTimeoutSec: 42,
          midAgreementDebitNoteIntervalSec: 42,
          midAgreementPaymentTimeoutSec: 42,
        },
        payerDetails,
      );

      const expectedConstraints = [
        "(golem.inf.mem.gib>=0.5)",
        "(golem.inf.storage.gib>=2)",
        "(golem.runtime.name=vm)",
        "(golem.inf.cpu.cores>=1)",
        "(golem.inf.cpu.threads>=1)",
        "(golem.com.pricing.model=linear)",
        "(golem.node.debug.subnet=public)",
        "(golem.com.payment.platform.erc20-holesky-tglm.address=*)",
      ].join("\n\t");
      const expectedProperties = {
        "golem.srv.comp.vm.package_format": "gvmkit-squash",
        "golem.srv.comp.task_package": "hash:sha3:AAAAHASHAAAA:https://custom.image.url/",
        "golem.com.payment.platform.erc20-holesky-tglm.address": "0x123",
        "golem.srv.caps.multi-activity": true,
        "golem.srv.comp.expiration": Date.now() + 42 * 1000,
        "golem.node.debug.subnet": "public",
        "golem.com.payment.debit-notes.accept-timeout?": 42,
        "golem.com.scheme.payu.debit-note.interval-sec?": 42,
        "golem.com.scheme.payu.payment-timeout-sec?": 42,
      };

      expect(demandSpecification.paymentPlatform).toBe(payerDetails.getPaymentPlatform());
      expect(demandSpecification.expirationSec).toBe(42);
      expect(demandSpecification.decoration.constraints).toBe(`(&${expectedConstraints})`);
      expect(demandSpecification.decoration.properties).toEqual(expectedProperties);
    });
  });

  describe("publishDemand()", () => {
    it("should publish a demand", (done) => {
      const mockSpecification = mock(DemandSpecification);
      when(mockMarketApiAdapter.publishDemandSpecification(mockSpecification)).thenCall(async (specification) => {
        return new DemandNew("demand-id", specification);
      });

      const demand$ = marketModule.publishDemand(mockSpecification);
      demand$.pipe(take(1)).subscribe({
        next: (demand) => {
          try {
            expect(demand).toEqual(new DemandNew("demand-id", mockSpecification));
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
      const mockDemand0 = new DemandNew("demand-id-0", mockSpecificationInstance);
      const mockDemand1 = new DemandNew("demand-id-1", mockSpecificationInstance);
      const mockDemand2 = new DemandNew("demand-id-2", mockSpecificationInstance);

      when(mockMarketApiAdapter.publishDemandSpecification(_))
        .thenResolve(mockDemand0)
        .thenResolve(mockDemand1)
        .thenResolve(mockDemand2);
      when(mockMarketApiAdapter.unpublishDemand(_)).thenResolve();

      const demand$ = marketModule.publishDemand(mockSpecificationInstance);
      const demands: DemandNew[] = [];
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
  });

  describe("subscribeForProposals()", () => {
    it("should filter out rejected proposals", (done) => {
      const mockDemand = instance(imock<DemandNew>());
      const mockProposalDTO = imock<YaTsClient.MarketApi.ProposalEventDTO["proposal"]>();
      when(mockProposalDTO.issuerId).thenReturn("issuer-id");
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
      } as ProposalNew;
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
      } as ProposalNew;
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
      } as ProposalNew;
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
      } as ProposalNew;

      marketModule.publishDemand = jest.fn().mockReturnValue(of({ id: "demand-id" }));
      marketModule.negotiateProposal = jest.fn();
      marketModule.subscribeForProposals = jest
        .fn()
        .mockReturnValue(from([proposal1, proposal2, proposal3, proposal4]));

      const draftProposals: ProposalNew[] = [];
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
      } as ProposalNew;
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
      } as ProposalNew;
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
      } as ProposalNew;
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
      } as ProposalNew;

      marketModule.publishDemand = jest.fn().mockReturnValue(of({ id: "demand-id" }));
      marketModule.negotiateProposal = jest.fn();
      marketModule.subscribeForProposals = jest
        .fn()
        .mockReturnValue(from([proposal1, proposal2, proposal3, proposal4]));

      const draftProposals: ProposalNew[] = [];
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
});
