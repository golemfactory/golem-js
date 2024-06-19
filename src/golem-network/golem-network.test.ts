import { Subject } from "rxjs";
import { ActivityModuleImpl } from "../activity";
import { LeaseModuleImpl, LeaseProcess, LeaseProcessPool } from "../lease-process";
import { DraftOfferProposalPool, MarketModuleImpl, OfferProposal } from "../market";
import { NetworkModuleImpl } from "../network";
import { Allocation, PaymentModuleImpl } from "../payment";
import { YagnaApi } from "../shared/utils";
import { MarketApiAdapter, PaymentApiAdapter } from "../shared/yagna";
import { ActivityApiAdapter } from "../shared/yagna/adapters/activity-api-adapter";
import { GolemNetwork, MarketOrderSpec } from "./golem-network";
import { _, instance, mock, reset, verify, when } from "@johanblumenberg/ts-mockito";
import { GftpStorageProvider } from "../shared/storage";

const order: MarketOrderSpec = Object.freeze({
  demand: {
    workload: { imageTag: "golem/alpine:latest" },
  },
  market: {
    rentHours: 0.5,
    pricing: {
      model: "linear",
      maxStartPrice: 0.5,
      maxCpuPerHourPrice: 1.0,
      maxEnvPerHourPrice: 0.5,
    },
  },
} as const);
const mockMarket = mock(MarketModuleImpl);
const mockPayment = mock(PaymentModuleImpl);
const mockActivity = mock(ActivityModuleImpl);
const mockNetwork = mock(NetworkModuleImpl);
const mockLease = mock(LeaseModuleImpl);
const mockYagna = mock(YagnaApi);
const mockPaymentApi = mock(PaymentApiAdapter);
const mockActivityApi = mock(ActivityApiAdapter);
const mockMarketApi = mock(MarketApiAdapter);
const mockStorageProvider = mock(GftpStorageProvider);

afterEach(() => {
  reset(mockYagna);
  reset(mockActivity);
  reset(mockMarket);
  reset(mockPayment);
  reset(mockNetwork);
  reset(mockLease);
  reset(mockPaymentApi);
  reset(mockActivityApi);
  reset(mockMarketApi);
  reset(mockStorageProvider);

  jest.clearAllMocks();
});
function getGolemNetwork() {
  return new GolemNetwork({
    override: {
      yagna: instance(mockYagna),
      activity: instance(mockActivity),
      market: instance(mockMarket),
      payment: instance(mockPayment),
      network: instance(mockNetwork),
      lease: instance(mockLease),
      paymentApi: instance(mockPaymentApi),
      activityApi: instance(mockActivityApi),
      marketApi: instance(mockMarketApi),
      storageProvider: instance(mockStorageProvider),
    },
  });
}

describe("Golem Network", () => {
  describe("oneOf()", () => {
    it("should create a lease and clean it up when disconnected", async () => {
      const mockLeaseProcess = mock(LeaseProcess);
      const testProcess = instance(mockLeaseProcess);

      when(mockLeaseProcess.finalize()).thenResolve();
      when(mockLease.createLease(_, _, _)).thenReturn(testProcess);

      const draftProposal$ = new Subject<OfferProposal>();
      when(mockMarket.collectDraftOfferProposals(_)).thenReturn(draftProposal$);

      const allocation = instance(mock(Allocation));
      when(mockPayment.createAllocation(_)).thenResolve(allocation);

      jest.spyOn(DraftOfferProposalPool.prototype, "acquire").mockResolvedValue({} as OfferProposal);

      const glm = getGolemNetwork();
      await glm.connect();

      const lease = await glm.oneOf({ order });

      expect(lease).toBe(testProcess);

      await glm.disconnect();

      verify(mockLeaseProcess.finalize()).once();
      verify(mockPayment.releaseAllocation(allocation)).once();
    });
    it("should not release the allocation if it was provided by the user", async () => {
      const allocation = instance(mock(Allocation));

      const mockLeaseProcess = mock(LeaseProcess);
      const testProcess = instance(mockLeaseProcess);
      when(mockLeaseProcess.finalize()).thenResolve();
      when(mockLease.createLease(_, _, _)).thenReturn(testProcess);

      when(mockMarket.collectDraftOfferProposals(_)).thenReturn(new Subject<OfferProposal>());
      jest.spyOn(DraftOfferProposalPool.prototype, "acquire").mockResolvedValue({} as OfferProposal);

      const glm = getGolemNetwork();
      await glm.connect();

      const lease = await glm.oneOf({
        order: {
          ...order,
          payment: {
            allocation,
          },
        },
      });

      expect(lease).toBe(testProcess);

      await glm.disconnect();

      verify(mockLeaseProcess.finalize()).once();
      verify(mockPayment.createAllocation(_)).never();
      verify(mockPayment.releaseAllocation(allocation)).never();
    });
  });

  describe("manyOf()", () => {
    it("should create a pool and clean it up when disconnected", async () => {
      const allocation = instance(mock(Allocation));
      when(mockPayment.createAllocation(_)).thenResolve(allocation);

      const draftProposal$ = new Subject<OfferProposal>();
      when(mockMarket.collectDraftOfferProposals(_)).thenReturn(draftProposal$);

      const mockLeasePool = mock(LeaseProcessPool);
      when(mockLeasePool.drainAndClear()).thenResolve();
      const leasePool = instance(mockLeasePool);
      when(mockLease.createLeaseProcessPool(_, _, _)).thenReturn(leasePool);

      const glm = getGolemNetwork();

      await glm.connect();

      const pool = await glm.manyOf({
        concurrency: 3,
        order,
      });

      expect(pool).toBe(leasePool);

      await glm.disconnect();

      verify(mockLeasePool.drainAndClear()).once();
      verify(mockPayment.releaseAllocation(allocation)).once();
    });
    it("should not release the allocation if it was provided by the user", async () => {
      const allocation = instance(mock(Allocation));

      when(mockMarket.collectDraftOfferProposals(_)).thenReturn(new Subject<OfferProposal>());
      const mockLeasePool = mock(LeaseProcessPool);
      when(mockLeasePool.drainAndClear()).thenResolve();
      const leasePool = instance(mockLeasePool);
      when(mockLease.createLeaseProcessPool(_, _, _)).thenReturn(leasePool);

      const glm = getGolemNetwork();
      await glm.connect();

      const pool = await glm.manyOf({
        concurrency: 3,
        order: {
          ...order,
          payment: {
            allocation,
          },
        },
      });

      expect(pool).toBe(leasePool);
      await glm.disconnect();
      verify(mockLeasePool.drainAndClear()).once();
      verify(mockPayment.createAllocation(_)).never();
      verify(mockPayment.releaseAllocation(allocation)).never();
    });
  });
});
