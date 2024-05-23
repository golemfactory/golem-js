import { Observable, Subscription } from "rxjs";
import { ActivityModuleImpl } from "../activity";
import { LeaseProcess, LeaseProcessPool } from "../agreement";
import { DemandSpec, DraftOfferProposalPool, MarketModuleImpl, OfferProposal } from "../market";
import { NetworkModuleImpl } from "../network/network.module";
import { Allocation, PaymentModuleImpl } from "../payment";
import { YagnaApi } from "../shared/utils";
import { MarketApiAdapter, PaymentApiAdapter } from "../shared/yagna";
import { ActivityApiAdapter } from "../shared/yagna/adapters/activity-api-adapter";
import { AgreementApiAdapter } from "../shared/yagna/adapters/agreement-api-adapter";
import { GolemNetwork } from "./golem-network";
import { _, instance, mock, reset, when, verify } from "@johanblumenberg/ts-mockito";
import { GftpStorageProvider } from "../shared/storage";

const demandOptions: DemandSpec = Object.freeze({
  demand: {
    activity: { imageTag: "golem/alpine:latest" },
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
const mockYagna = mock(YagnaApi);
const mockPaymentApi = mock(PaymentApiAdapter);
const mockActivityApi = mock(ActivityApiAdapter);
const mockAgreementApi = mock(AgreementApiAdapter);
const mockMarketApi = mock(MarketApiAdapter);
const mockStorageProvider = mock(GftpStorageProvider);

afterEach(() => {
  reset(mockYagna);
  reset(mockActivity);
  reset(mockMarket);
  reset(mockPayment);
  reset(mockNetwork);
  reset(mockPaymentApi);
  reset(mockActivityApi);
  reset(mockAgreementApi);
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
      paymentApi: instance(mockPaymentApi),
      activityApi: instance(mockActivityApi),
      agreementApi: instance(mockAgreementApi),
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
  when(mockMarket.startCollectingProposals(_)).thenReturn(mockObservable);
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
      const mockLease = {
        finalize: jest.fn().mockImplementation(() => Promise.resolve()) as LeaseProcess["finalize"],
      } as LeaseProcess;
      when(mockMarket.createLease(_, _)).thenReturn(mockLease);
      const mockSubscription = mockStartCollectingProposals();
      const mockAllocation = mockPaymentCreateAllocation();
      jest.spyOn(DraftOfferProposalPool.prototype, "acquire").mockResolvedValue({} as OfferProposal);

      const glm = getGolemNetwork();
      await glm.connect();
      const lease = await glm.oneOf(demandOptions);
      expect(lease === mockLease).toBe(true);
      await glm.disconnect();
      expect(mockLease.finalize).toHaveBeenCalled();
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
      when(mockMarket.createLeaseProcessPool(_, _, _)).thenReturn(instance(mockLeasePool));

      const glm = getGolemNetwork();
      await glm.connect();
      const leasePool = await glm.manyOf(3, demandOptions);
      expect(leasePool === instance(mockLeasePool)).toBe(true);
      await glm.disconnect();
      verify(mockLeasePool.drainAndClear()).once();
      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
      verify(mockPayment.releaseAllocation(mockAllocation)).once();
    });
  });
});
