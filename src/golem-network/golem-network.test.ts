import { Observable, Subscription } from "rxjs";
import { ActivityModuleImpl } from "../activity";
import { LeaseProcess, LeaseProcessPool } from "../lease-process";
import { DraftOfferProposalPool, MarketModuleImpl, OfferProposal } from "../market";
import { NetworkModuleImpl } from "../network/network.module";
import { Allocation, PaymentModuleImpl } from "../payment";
import { YagnaApi } from "../shared/utils";
import { MarketApiAdapter, PaymentApiAdapter } from "../shared/yagna";
import { ActivityApiAdapter } from "../shared/yagna/adapters/activity-api-adapter";
import { GolemNetwork, MarketOrderSpec } from "./golem-network";
import { _, instance, mock, reset, when, verify } from "@johanblumenberg/ts-mockito";
import { GftpStorageProvider } from "../shared/storage";
import { LeaseModuleImpl } from "../lease-process/lease.module";

const order: MarketOrderSpec = Object.freeze({
  demand: {
    workload: { imageTag: "golem/alpine:latest" },
  },
  market: {
    maxAgreements: 1,
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

function mockStartCollectingProposals() {
  const mockSubscription = { unsubscribe: jest.fn() as Subscription["unsubscribe"] } as Subscription;
  const mockObservable = {
    subscribe: jest.fn().mockReturnValue(mockSubscription) as Observable<OfferProposal[]>["subscribe"],
  } as Observable<OfferProposal[]>;
  when(mockMarket.startCollectingDraftOfferProposals(_)).thenReturn(mockObservable);
  return mockSubscription;
}
function mockPaymentCreateAllocation() {
  const mockAllocation = {} as Allocation;
  when(mockPayment.createAllocation(_)).thenReturn(Promise.resolve(mockAllocation));
  return mockAllocation;
}

describe("Golem Network", () => {
  describe("oneOf()", () => {
    it("should create a lease and clean it up when disconnected", async () => {
      const mockLeaseProcess = {
        finalize: jest.fn().mockImplementation(() => Promise.resolve()) as LeaseProcess["finalize"],
      } as LeaseProcess;
      when(mockLease.createLease(_, _, _)).thenReturn(mockLeaseProcess);
      const mockSubscription = mockStartCollectingProposals();
      const mockAllocation = mockPaymentCreateAllocation();
      jest.spyOn(DraftOfferProposalPool.prototype, "acquire").mockResolvedValue({} as OfferProposal);

      const glm = getGolemNetwork();
      await glm.connect();
      const lease = await glm.oneOf(order);
      expect(lease === mockLeaseProcess).toBe(true);
      await glm.disconnect();
      expect(mockLeaseProcess.finalize).toHaveBeenCalled();
      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
      verify(mockPayment.releaseAllocation(mockAllocation)).once();
    });
  });
  describe("manyOf()", () => {
    it("should create a pool and clean it up when disconnected", async () => {
      const mockSubscription = mockStartCollectingProposals();
      const mockAllocation = mockPaymentCreateAllocation();
      const mockLeasePool = mock(LeaseProcessPool);
      when(mockLeasePool.drainAndClear()).thenResolve();
      when(mockLease.createLeaseProcessPool(_, _, _)).thenReturn(instance(mockLeasePool));

      const glm = getGolemNetwork();
      await glm.connect();
      const leasePool = await glm.manyOf({
        concurrency: 3,
        order,
      });
      expect(leasePool === instance(mockLeasePool)).toBe(true);
      await glm.disconnect();
      verify(mockLeasePool.drainAndClear()).once();
      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
      verify(mockPayment.releaseAllocation(mockAllocation)).once();
    });
  });
});
