import { Subject } from "rxjs";
import { ActivityModuleImpl } from "../activity";
import { RentalModuleImpl, ResourceRental, ResourceRentalPool } from "../resource-rental";
import { DraftOfferProposalPool, MarketModuleImpl, OfferProposal } from "../market";
import { NetworkModuleImpl } from "../network";
import { Allocation, PaymentModuleImpl } from "../payment";
import { YagnaApi, sleep } from "../shared/utils";
import { MarketApiAdapter, PaymentApiAdapter } from "../shared/yagna";
import { ActivityApiAdapter } from "../shared/yagna/adapters/activity-api-adapter";
import { GolemNetwork, MarketOrderSpec } from "./golem-network";
import { _, instance, mock, reset, spy, verify, when } from "@johanblumenberg/ts-mockito";
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

const identity = {
  identity: "0x0123456789",
  role: "test-role",
  name: "test-name",
};

const mockMarket = mock(MarketModuleImpl);
const mockPayment = mock(PaymentModuleImpl);
const mockActivity = mock(ActivityModuleImpl);
const mockNetwork = mock(NetworkModuleImpl);
const mockRental = mock(RentalModuleImpl);
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
  reset(mockRental);
  reset(mockPaymentApi);
  reset(mockActivityApi);
  reset(mockMarketApi);
  reset(mockStorageProvider);

  jest.clearAllMocks();
});

beforeEach(() => {
  when(mockStorageProvider.close()).thenResolve();
  when(mockYagna.disconnect()).thenResolve();
  when(mockYagna.connect()).thenResolve(identity);
});

function getGolemNetwork() {
  return new GolemNetwork({
    override: {
      yagna: instance(mockYagna),
      activity: instance(mockActivity),
      market: instance(mockMarket),
      payment: instance(mockPayment),
      network: instance(mockNetwork),
      rental: instance(mockRental),
      paymentApi: instance(mockPaymentApi),
      activityApi: instance(mockActivityApi),
      marketApi: instance(mockMarketApi),
      storageProvider: instance(mockStorageProvider),
    },
  });
}

describe("Golem Network", () => {
  describe("oneOf()", () => {
    it("should create a rental and clean it up when disconnected", async () => {
      const mockResourceRental = mock(ResourceRental);
      const mockResourceRentalInstance = instance(mockResourceRental);

      when(mockResourceRental.stopAndFinalize()).thenResolve();
      when(mockRental.createResourceRental(_, _, _)).thenReturn(mockResourceRentalInstance);

      const draftProposal$ = new Subject<OfferProposal>();
      when(mockMarket.collectDraftOfferProposals(_)).thenReturn(draftProposal$);

      const allocation = instance(mock(Allocation));
      when(mockPayment.createAllocation(_)).thenResolve(allocation);

      jest.spyOn(DraftOfferProposalPool.prototype, "acquire").mockResolvedValue({} as OfferProposal);

      const glm = getGolemNetwork();
      await glm.connect();

      const rental = await glm.oneOf({ order });

      expect(rental).toBe(mockResourceRentalInstance);

      await glm.disconnect();

      verify(mockResourceRental.stopAndFinalize()).once();
      verify(mockPayment.releaseAllocation(allocation)).once();
    });
    it("should not release the allocation if it was provided by the user", async () => {
      const allocation = instance(mock(Allocation));

      const mockResourceRental = mock(ResourceRental);
      const mockResourceRentalInstance = instance(mockResourceRental);
      when(mockResourceRental.stopAndFinalize()).thenResolve();
      when(mockRental.createResourceRental(_, _, _)).thenReturn(mockResourceRentalInstance);

      when(mockMarket.collectDraftOfferProposals(_)).thenReturn(new Subject<OfferProposal>());
      jest.spyOn(DraftOfferProposalPool.prototype, "acquire").mockResolvedValue({} as OfferProposal);

      const glm = getGolemNetwork();
      await glm.connect();

      const rental = await glm.oneOf({
        order: {
          ...order,
          payment: {
            allocation,
          },
        },
      });

      expect(rental).toBe(mockResourceRentalInstance);

      await glm.disconnect();

      verify(mockResourceRental.stopAndFinalize()).once();
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

      const mockRentalPool = mock(ResourceRentalPool);
      when(mockRentalPool.drainAndClear()).thenResolve();
      const rentalPool = instance(mockRentalPool);
      when(mockRental.createResourceRentalPool(_, _, _)).thenReturn(rentalPool);

      const glm = getGolemNetwork();

      await glm.connect();

      const pool = await glm.manyOf({
        poolSize: 3,
        order,
      });

      expect(pool).toBe(rentalPool);

      await glm.disconnect();

      verify(mockRentalPool.drainAndClear()).once();
      verify(mockPayment.releaseAllocation(allocation)).once();
    });
    it("should not release the allocation if it was provided by the user", async () => {
      const allocation = instance(mock(Allocation));

      when(mockMarket.collectDraftOfferProposals(_)).thenReturn(new Subject<OfferProposal>());
      const mockRentalPool = mock(ResourceRentalPool);
      when(mockRentalPool.drainAndClear()).thenResolve();
      const rentalPool = instance(mockRentalPool);
      when(mockRental.createResourceRentalPool(_, _, _)).thenReturn(rentalPool);

      const glm = getGolemNetwork();
      await glm.connect();

      const pool = await glm.manyOf({
        poolSize: 3,
        order: {
          ...order,
          payment: {
            allocation,
          },
        },
      });

      expect(pool).toBe(rentalPool);
      await glm.disconnect();
      verify(mockRentalPool.drainAndClear()).once();
      verify(mockPayment.createAllocation(_)).never();
      verify(mockPayment.releaseAllocation(allocation)).never();
    });
  });
  describe("disconnect()", () => {
    it("reuses the same promise if called multiple times", async () => {
      const glm = getGolemNetwork();
      await glm.connect();
      const glmSpy = spy(glm);
      when(glmSpy["startDisconnect"]()).thenResolve();
      expect(glm["disconnectPromise"]).toBeUndefined();
      const promise1 = glm.disconnect();
      const promise2 = glm.disconnect();
      const promise3 = glm.disconnect();
      expect(glm["disconnectPromise"]).toBeDefined();
      await Promise.all([promise1, promise2, promise3]);
      verify(glmSpy["startDisconnect"]()).once();
      expect(glm["disconnectPromise"]).toBeUndefined();
    });
    it("stops any oneOf() rentals that are in the process of being created", async () => {
      const allocation = instance(mock(Allocation));
      when(mockPayment.createAllocation(_)).thenResolve(allocation);
      when(mockPayment.releaseAllocation(allocation)).thenResolve();

      // simulate some operation taking a long time
      when(mockPayment.createAllocation(_)).thenCall(async () => {
        await sleep(100, true);
        return allocation;
      });

      const glm = getGolemNetwork();
      await glm.connect();

      expect.assertions(1);
      const rentalPromise = glm
        .oneOf({ order })
        .then(() => {
          throw new Error("Rental should not be created");
        })
        .catch((err) => {
          expect(err).toBe("Golem Network is disconnecting");
        });
      await glm.disconnect();
      await rentalPromise;
      verify(mockPayment.releaseAllocation(allocation)).once();
    });
    it("stops any manyOf() rentals that are in the process of being created", async () => {
      const allocation = instance(mock(Allocation));
      when(mockPayment.createAllocation(_)).thenResolve(allocation);
      when(mockPayment.releaseAllocation(allocation)).thenResolve();

      // simulate some operation taking a long time
      when(mockPayment.createAllocation(_)).thenCall(async () => {
        await sleep(100, true);
        return allocation;
      });

      const glm = getGolemNetwork();
      await glm.connect();

      expect.assertions(1);
      const rentalPromise = glm
        .manyOf({ poolSize: 3, order })
        .then(() => {
          throw new Error("Pool should not be created");
        })
        .catch((err) => {
          expect(err).toBe("Golem Network is disconnecting");
        });
      await glm.disconnect();
      await rentalPromise;
      verify(mockPayment.releaseAllocation(allocation)).once();
    });
  });
});
