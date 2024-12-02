import { _, imock, instance, mock, reset, spy, verify, when } from "@johanblumenberg/ts-mockito";
import { Logger, waitAndCall, waitFor, YagnaApi } from "../shared/utils";
import { MarketModuleImpl } from "./market.module";
import { Demand, DemandSpecification } from "./demand";
import { Subject, take } from "rxjs";
import { MarketProposalEvent, OfferProposal, ProposalProperties } from "./proposal";
import { MarketApiAdapter } from "../shared/yagna/";
import { IActivityApi, IFileServer } from "../activity";
import { StorageProvider } from "../shared/storage";
import { GolemMarketError } from "./error";
import { Allocation, IPaymentApi } from "../payment";
import { INetworkApi, NetworkModule } from "../network";
import { DraftOfferProposalPool } from "./draft-offer-proposal-pool";
import { Agreement, AgreementEvent, ProviderInfo } from "./agreement";
import { MarketOrderSpec } from "../golem-network";
import { GolemAbortError } from "../shared/error/golem-error";

const mockMarketApiAdapter = mock(MarketApiAdapter);
const mockYagna = mock(YagnaApi);
const mockAgreement = mock(Agreement);

const testAgreementEvent$ = new Subject<AgreementEvent>();

let marketModule: MarketModuleImpl;

const DEMAND_REFRESH_INTERVAL_SEC = 60;

beforeEach(() => {
  jest.useFakeTimers();
  jest.resetAllMocks();

  reset(mockMarketApiAdapter);
  reset(mockAgreement);

  when(mockMarketApiAdapter.collectAgreementEvents()).thenReturn(testAgreementEvent$);

  marketModule = new MarketModuleImpl(
    {
      activityApi: instance(imock<IActivityApi>()),
      paymentApi: instance(imock<IPaymentApi>()),
      networkApi: instance(imock<INetworkApi>()),
      yagna: instance(mockYagna),
      logger: instance(imock<Logger>()),
      marketApi: instance(mockMarketApiAdapter),
      fileServer: instance(imock<IFileServer>()),
      storageProvider: instance(imock<StorageProvider>()),
      networkModule: instance(imock<NetworkModule>()),
    },
    {
      demandRefreshIntervalSec: DEMAND_REFRESH_INTERVAL_SEC,
    },
  );
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

      const rentalDurationHours = 1;
      const demandSpecification = await marketModule.buildDemandDetails(
        {
          workload: {
            imageHash: "AAAAHASHAAAA",
            imageUrl: "https://custom.image.url/",
          },
          payment: {
            debitNotesAcceptanceTimeoutSec: 42,
            midAgreementDebitNoteIntervalSec: 42,
            midAgreementPaymentTimeoutSec: 42,
          },
        },
        {
          rentHours: rentalDurationHours,
          pricing: {
            model: "burn-rate",
            avgGlmPerHour: 1,
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
          key: "golem.node.debug.subnet",
          value: "public",
        },
        {
          key: "golem.srv.comp.expiration",
          value: Date.now() + rentalDurationHours * 60 * 60 * 1000,
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

      const demand$ = marketModule.publishAndRefreshDemand(mockSpecification);
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
      const mockSpecificationInstance = instance(mockSpecification);
      const mockDemand0 = new Demand("demand-id-0", mockSpecificationInstance);
      const mockDemand1 = new Demand("demand-id-1", mockSpecificationInstance);
      const mockDemand2 = new Demand("demand-id-2", mockSpecificationInstance);

      when(mockMarketApiAdapter.publishDemandSpecification(_))
        .thenResolve(mockDemand0)
        .thenResolve(mockDemand1)
        .thenResolve(mockDemand2);
      when(mockMarketApiAdapter.unpublishDemand(_)).thenResolve();

      const demand$ = marketModule.publishAndRefreshDemand(mockSpecificationInstance);
      const demands: Demand[] = [];
      demand$.pipe(take(3)).subscribe({
        next: (demand) => {
          demands.push(demand);
          jest.advanceTimersByTime(DEMAND_REFRESH_INTERVAL_SEC * 1000);
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

      const demand$ = marketModule.publishAndRefreshDemand(details);

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

  describe("startCollectingProposals()", () => {
    const initialOfferProperties: ProposalProperties = {
      "golem.activity.caps.transfer.protocol": ["http"],
      "golem.com.payment.chosen-platform": "erc20-hoeslky-glm",
      "golem.com.payment.debit-notes.accept-timeout?": 120,
      "golem.com.payment.protocol.version": 2,
      "golem.com.pricing.model": "linear",
      "golem.com.pricing.model.linear.coeffs": [0.0, 0.0, 0.0],
      "golem.com.scheme": "payu",
      "golem.com.usage.vector": [],
      "golem.inf.cpu.architecture": "",
      "golem.inf.cpu.brand": "",
      "golem.inf.cpu.capabilities": [],
      "golem.inf.cpu.model": "",
      "golem.inf.cpu.vendor": "GenuineIntel",
      "golem.node.id.name": "",
      "golem.runtime.capabilities": [],
      "golem.runtime.name": "",
      "golem.runtime.version": "",
      "golem.srv.caps.multi-activity": false,
      "golem.srv.comp.expiration": 0,
      "golem.srv.comp.task_package": "",
      "golem.inf.cpu.cores": 2,
      "golem.inf.cpu.threads": 2,
      "golem.inf.mem.gib": 1,
      "golem.inf.storage.gib": 1,
    };

    test("should negotiate any initial proposal", async () => {
      jest.useRealTimers();

      const spec = new DemandSpecification(
        {
          properties: [],
          constraints: [],
        },
        "erc20-holesky-tglm",
      );

      const providerInfo: ProviderInfo = {
        id: "test-provider-id",
        name: "test-provider-name",
        walletAddress: "0xTestWallet",
      };

      const mockInitialOfferProposal = mock(OfferProposal);
      when(mockInitialOfferProposal.isInitial()).thenReturn(true);
      when(mockInitialOfferProposal.isValid()).thenReturn(true);
      when(mockInitialOfferProposal.provider).thenReturn(providerInfo);
      when(mockInitialOfferProposal.properties).thenReturn(initialOfferProperties);
      when(mockInitialOfferProposal.pricing).thenReturn({
        cpuSec: 0.4 / 3600,
        envSec: 0.4 / 3600,
        start: 0.4,
      });

      const mockDraftOfferProposal = mock(OfferProposal);
      when(mockDraftOfferProposal.isDraft()).thenReturn(true);
      when(mockDraftOfferProposal.isValid()).thenReturn(true);
      when(mockDraftOfferProposal.provider).thenReturn(providerInfo);
      when(mockDraftOfferProposal.properties).thenReturn(initialOfferProperties);
      when(mockDraftOfferProposal.pricing).thenReturn({
        cpuSec: 0.4 / 3600,
        envSec: 0.4 / 3600,
        start: 0.4,
      });

      const initialProposal = instance(mockInitialOfferProposal);
      const draftProposal = instance(mockDraftOfferProposal);

      const demandOfferEvent$ = new Subject<MarketProposalEvent>();

      when(mockMarketApiAdapter.collectMarketProposalEvents(_)).thenReturn(demandOfferEvent$);

      // When
      const draftProposal$ = marketModule.collectDraftOfferProposals({
        demandSpecification: spec,
        pricing: {
          model: "linear",
          maxStartPrice: 0.5,
          maxCpuPerHourPrice: 1.0,
          maxEnvPerHourPrice: 0.5,
        },
      });

      const draftListener = jest.fn();

      // Control the test using a subscription
      const testSub = draftProposal$.subscribe(draftListener);

      // We need this because the actual demand publishing is async, so the result of that publishing will be available
      // on the next tick. Only then it makes sense to push the proposals into the test subjects.
      setImmediate(() => {
        // Emit the values on the subjects
        demandOfferEvent$.next({
          type: "ProposalReceived",
          proposal: initialProposal,
          timestamp: new Date(),
        });
        demandOfferEvent$.next({
          type: "ProposalReceived",
          proposal: draftProposal,
          timestamp: new Date(),
        });
      });

      await waitFor(() => draftListener.mock.calls.length > 0);
      testSub.unsubscribe();

      expect(draftListener).toHaveBeenCalledWith(draftProposal);

      verify(mockMarketApiAdapter.counterProposal(initialProposal, spec)).once();
      // Right now we don't expect counter draft proposals (advanced negotiations)
      verify(mockMarketApiAdapter.counterProposal(draftProposal, spec)).never();
    });

    test("should reduce proposals from the same provider", async () => {
      jest.useRealTimers();

      const spec = new DemandSpecification(
        {
          properties: [],
          constraints: [],
        },
        "erc20-holesky-tglm",
      );

      const providerInfo: ProviderInfo = {
        id: "test-provider-id",
        name: "test-provider-name",
        walletAddress: "0xTestWallet",
      };

      const mockInitialOfferProposal = mock(OfferProposal);
      when(mockInitialOfferProposal.isInitial()).thenReturn(true);
      when(mockInitialOfferProposal.isValid()).thenReturn(true);
      when(mockInitialOfferProposal.provider).thenReturn(providerInfo);
      when(mockInitialOfferProposal.properties).thenReturn(initialOfferProperties);
      when(mockInitialOfferProposal.pricing).thenReturn({
        cpuSec: 0.4 / 3600,
        envSec: 0.4 / 3600,
        start: 0.4,
      });

      const initialProposal = instance(mockInitialOfferProposal);

      const demandOfferEvent$ = new Subject<MarketProposalEvent>();

      when(mockMarketApiAdapter.collectMarketProposalEvents(_)).thenReturn(demandOfferEvent$);

      // When
      const draftProposal$ = marketModule.collectDraftOfferProposals({
        demandSpecification: spec,
        proposalsBatchReleaseTimeoutMs: 1,
        minProposalsBatchSize: 3,
        pricing: {
          model: "linear",
          maxStartPrice: 0.5,
          maxCpuPerHourPrice: 1.0,
          maxEnvPerHourPrice: 0.5,
        },
      });

      // Drop 3 initial proposals about the same thing
      setImmediate(() => {
        demandOfferEvent$.next({
          type: "ProposalReceived",
          proposal: initialProposal,
          timestamp: new Date(),
        });
        demandOfferEvent$.next({
          type: "ProposalReceived",
          proposal: initialProposal,
          timestamp: new Date(),
        });
        demandOfferEvent$.next({
          type: "ProposalReceived",
          proposal: initialProposal,
          timestamp: new Date(),
        });
      });

      const testSub = draftProposal$.subscribe();

      await waitAndCall(() => testSub.unsubscribe(), 0.2);

      verify(mockMarketApiAdapter.counterProposal(initialProposal, spec)).once();
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
      when(mockPool.acquire(_)).thenResolve(badProposal0).thenResolve(badProposal1).thenResolve(goodProposal);
      const goodAgreement = {} as Agreement;
      const marketSpy = spy(marketModule);
      when(marketSpy.proposeAgreement(goodProposal, _)).thenResolve(goodAgreement);
      when(marketSpy.proposeAgreement(badProposal0, _)).thenReject(new Error("Failed to sign proposal"));
      when(marketSpy.proposeAgreement(badProposal1, _)).thenReject(new Error("Failed to sign proposal"));

      const signedProposal = await marketModule.signAgreementFromPool(instance(mockPool));

      verify(mockPool.acquire(_)).thrice();
      verify(marketSpy.proposeAgreement(badProposal0, _)).once();
      verify(mockPool.remove(badProposal0)).once();
      verify(marketSpy.proposeAgreement(badProposal1, _)).once();
      verify(mockPool.remove(badProposal1)).once();
      verify(marketSpy.proposeAgreement(goodProposal, _)).once();
      verify(mockPool.remove(goodProposal)).once();
      expect(signedProposal).toBe(goodAgreement);
    });
    it("should release the proposal if the operation is cancelled between acquiring and signing", async () => {
      const ac = new AbortController();
      const error = new Error("Operation cancelled");
      const proposal = {} as OfferProposal;
      const mockPool = mock(DraftOfferProposalPool);
      when(mockPool.acquire(_)).thenCall(async () => {
        ac.abort(error);
        return proposal;
      });
      const marketSpy = spy(marketModule);

      await expect(marketModule.signAgreementFromPool(instance(mockPool), {}, ac.signal)).rejects.toMatchError(
        new GolemAbortError("The signing of the agreement has been aborted", error),
      );

      verify(mockPool.acquire(_)).once();
      verify(mockPool.release(proposal)).once();
      verify(mockPool.remove(_)).never();
      verify(marketSpy.proposeAgreement(_)).never();
    });
    it("should abort immediately if the given signal is already aborted", async () => {
      const mockPool = mock(DraftOfferProposalPool);
      const signal = AbortSignal.abort();
      await expect(marketModule.signAgreementFromPool(instance(mockPool), {}, signal)).rejects.toThrow(
        "The signing of the agreement has been aborted",
      );
      verify(mockPool.acquire()).never();
    });
    it("should abort after a set timeout", async () => {
      const mockPool = mock(DraftOfferProposalPool);
      when(mockPool.acquire()).thenResolve({} as OfferProposal);
      const marketSpy = spy(marketModule);
      when(marketSpy.proposeAgreement(_)).thenReject(new Error("Failed to sign proposal"));

      await expect(marketModule.signAgreementFromPool(instance(mockPool), {}, 50)).rejects.toThrow(
        "Could not sign any agreement in time",
      );
    });
    it("respects the timeout on draft proposal pool acquire and forwards the error", async () => {
      const mockPool = mock(DraftOfferProposalPool);
      when(mockPool.acquire(_)).thenCall(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error("Failed to acquire")), 10)),
      );
      expect(marketModule.signAgreementFromPool(instance(mockPool))).rejects.toThrow("Failed to acquire");
    });
  });

  describe("emitted events", () => {
    describe("agreement related events", () => {
      test("Emits 'agreementConfirmed'", () => {
        // Given
        const agreement = instance(mockAgreement);

        const listener = jest.fn();
        marketModule.events.on("agreementApproved", listener);

        // When
        testAgreementEvent$.next({
          type: "AgreementApproved",
          agreement,
          timestamp: new Date(),
        });

        // Then
        expect(listener).toHaveBeenCalled();
      });

      test("Emits 'agreementTerminated'", () => {
        // Given
        const agreement = instance(mockAgreement);

        const listener = jest.fn();
        marketModule.events.on("agreementTerminated", listener);

        // When
        testAgreementEvent$.next({
          type: "AgreementTerminated",
          agreement,
          terminatedBy: "Provider",
          reason: "Because I can",
          timestamp: new Date(),
        });

        // Then
        expect(listener).toHaveBeenCalled();
      });

      test("Emits 'agreementRejected'", () => {
        // Given
        const agreement = instance(mockAgreement);

        const listener = jest.fn();
        marketModule.events.on("agreementRejected", listener);

        // When
        testAgreementEvent$.next({
          type: "AgreementRejected",
          agreement,
          reason: "I didn't like it",
          timestamp: new Date(),
        });

        // Then
        expect(listener).toHaveBeenCalled();
      });

      test("Emits 'agreementCancelled'", () => {
        // Given
        const agreement = instance(mockAgreement);

        const listener = jest.fn();
        marketModule.events.on("agreementCancelled", listener);

        // When
        testAgreementEvent$.next({
          type: "AgreementCancelled",
          agreement,
          timestamp: new Date(),
        });

        // Then
        expect(listener).toHaveBeenCalled();
      });
    });
  });
  describe("estimateBudget()", () => {
    it("estimates budget for max number of agreements", () => {
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
      const maxAgreements = 10;
      const cpuPrice = 0.5 * 5 * 5; // 5 threads for 0.5 per hour for 5 hours
      const envPrice = 2 * 5; // 2 per hour for 5 hours
      const totalPricePerMachine = 1 + cpuPrice + envPrice;
      const expectedBudget = totalPricePerMachine * maxAgreements;

      const budget = marketModule.estimateBudget({ order, maxAgreements });
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
      const maxAgreements = 3;
      const expectedBudget = 5 * 2 * maxAgreements;

      const budget = marketModule.estimateBudget({ order, maxAgreements });
      expect(budget).toBeCloseTo(expectedBudget, 5);
    });
  });
});
