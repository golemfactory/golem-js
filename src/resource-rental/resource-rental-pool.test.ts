import { Agreement } from "../market/agreement/agreement";
import { _, imock, instance, mock, reset, spy, verify, when } from "@johanblumenberg/ts-mockito";
import { ResourceRental } from "./resource-rental";
import { Allocation } from "../payment";
import type { MarketModule } from "../market";
import { DraftOfferProposalPool } from "../market";
import { ResourceRentalPool } from "./resource-rental-pool";
import { type RequireAtLeastOne } from "../shared/utils/types";
import { NetworkModule } from "../network";
import { RentalModule } from "./rental.module";
import { Logger } from "../shared/utils";

const allocation = mock(Allocation);
const proposalPool = mock(DraftOfferProposalPool);
const marketModule = imock<MarketModule>();
const networkModule = imock<NetworkModule>();
const rentalModule = imock<RentalModule>();

function getMockResourceRental() {
  return {
    hasActivity: () => false,
    fetchAgreementState: () => Promise.resolve("Approved"),
    agreement: { id: "1" } as Agreement,
  } as ResourceRental;
}

function getRentalPool(replicas: RequireAtLeastOne<{ min: number; max: number }>) {
  return new ResourceRentalPool({
    allocation: instance(allocation),
    proposalPool: instance(proposalPool),
    marketModule: instance(marketModule),
    networkModule: instance(networkModule),
    rentalModule: instance(rentalModule),
    logger: instance(imock<Logger>()),
    network: undefined,
    poolSize: replicas,
  });
}

beforeEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  reset(allocation);
  reset(proposalPool);
  reset(marketModule);
  reset(networkModule);
  reset(rentalModule);
});

describe("ResourceRentalPool", () => {
  describe("ready()", () => {
    it("prepares MIN_POOL_SIZE resource rentals", async () => {
      when(marketModule.signAgreementFromPool(_, _)).thenResolve({} as Agreement);
      when(rentalModule.createResourceRental(_, _, _)).thenCall(() => ({}) as ResourceRental);

      const pool = getRentalPool({ min: 5, max: 10 });

      await pool.ready();

      expect(pool.getAvailableSize()).toBe(5);
      verify(marketModule.signAgreementFromPool(_, _, _)).times(5);
    });
    it("retries on error", async () => {
      when(rentalModule.createResourceRental(_, _, _)).thenCall(() => ({}) as ResourceRental);

      const fakeAgreement = {} as Agreement;
      when(marketModule.signAgreementFromPool(_, _, _))
        .thenResolve(fakeAgreement)
        .thenReject(new Error("Failed to propose agreement"))
        .thenResolve(fakeAgreement)
        .thenReject(new Error("Failed to propose agreement"))
        .thenResolve(fakeAgreement);

      const pool = getRentalPool({ min: 3 });

      await pool.ready();

      expect(pool.getAvailableSize()).toBe(3);
      verify(marketModule.signAgreementFromPool(_, _, _)).times(5);
    });
    it("stops retrying after abort signal is triggered", async () => {
      const pool = getRentalPool({ min: 3 });
      const poolSpy = spy(pool);
      // first call will succeed, the rest will fail (fall back to the first implementation)
      when(poolSpy["createNewResourceRental"]())
        .thenCall(() => new Promise((resolve) => setTimeout(() => resolve(getMockResourceRental()), 10)))
        .thenCall(
          () => new Promise((_, reject) => setTimeout(() => reject(new Error("Failed to propose agreement")), 10)),
        );
      await expect(pool.ready(AbortSignal.timeout(100))).rejects.toThrow(
        "Could not create enough resource rentals to reach the minimum pool size in time",
      );
      // at least the first iteration was finished (with 1 rental created) and the second one was started
      verify(poolSpy["createNewResourceRental"](_)).atLeast(5);
    });
    it("stops retrying after specified timeout is reached", async () => {
      const pool = getRentalPool({ min: 3 });
      const poolSpy = spy(pool);
      when(poolSpy["createNewResourceRental"]())
        .thenResolve(getMockResourceRental())
        .thenReject(new Error("Failed to propose agreement"));

      await expect(pool.ready(10)).rejects.toThrow(
        "Could not create enough resource rentals to reach the minimum pool size in time",
      );
      expect(pool.getAvailableSize()).toBe(1);
      verify(poolSpy["createNewResourceRental"](_)).atLeast(3);
    });
  });
  describe("acquire()", () => {
    it("takes a random resource rental from the pool if none have activities", async () => {
      const pool = getRentalPool({ min: 3 });
      const rental1 = getMockResourceRental();
      const rental2 = getMockResourceRental();
      const rental3 = getMockResourceRental();
      pool["lowPriority"].add(rental1);
      pool["lowPriority"].add(rental2);
      pool["lowPriority"].add(rental3);

      const resourceRental = await pool.acquire();
      expect(pool.getBorrowedSize()).toBe(1);
      expect(pool.getAvailableSize()).toBe(2);
      expect([rental1, rental2, rental3]).toContain(resourceRental);
    });
    it("prioritizes resource rentals from high priority pool", async () => {
      const pool = getRentalPool({ min: 3 });
      const rental1 = getMockResourceRental();
      const rental2 = getMockResourceRental();
      const rental3 = getMockResourceRental();
      pool["lowPriority"].add(rental1);
      pool["highPriority"].add(rental2);
      pool["lowPriority"].add(rental3);

      const resourceRental = await pool.acquire();
      expect(pool.getBorrowedSize()).toBe(1);
      expect(pool.getAvailableSize()).toBe(2);
      expect(resourceRental).toBe(rental2);
    });
    it("creates a new resource rental if none are available", async () => {
      const pool = getRentalPool({ min: 3 });
      pool["createNewResourceRental"] = jest.fn(() => Promise.resolve(getMockResourceRental()));

      expect(pool.getSize()).toBe(0);
      await pool.acquire();
      expect(pool.getSize()).toBe(1);
      expect(pool.getBorrowedSize()).toBe(1);
      expect(pool.getAvailableSize()).toBe(0);
    });
    it("waits for a rental to become available when the pool is full", async () => {
      const pool = getRentalPool({ min: 3, max: 3 });
      const rental1 = getMockResourceRental();
      const rental2 = getMockResourceRental();
      const rental3 = getMockResourceRental();
      pool["lowPriority"].add(rental1);
      pool["lowPriority"].add(rental2);
      pool["lowPriority"].add(rental3);

      const acquiredRental1 = await pool.acquire();
      await pool.acquire();
      await pool.acquire();

      expect(pool.getAvailableSize()).toBe(0);
      expect(pool.getBorrowedSize()).toBe(3);
      const acquiredRentalPromise = pool.acquire();
      // go to the next tick
      await Promise.resolve();
      expect(pool["acquireQueue"].length).toBe(1);
      pool.release(acquiredRental1);
      await acquiredRentalPromise;
      expect(pool.getAvailableSize()).toBe(0);
      expect(pool.getBorrowedSize()).toBe(3);
      expect(pool["acquireQueue"].length).toBe(0);
    });
    it("validates the resource rental before returning it", async () => {
      const pool = getRentalPool({ min: 3 });
      const newlyCreatedRental = getMockResourceRental();
      jest.spyOn(pool, "destroy");
      pool["createNewResourceRental"] = jest.fn(() => Promise.resolve(newlyCreatedRental));

      const rental1 = getMockResourceRental();
      rental1.fetchAgreementState = jest.fn().mockResolvedValue("Expired");
      const rental2 = getMockResourceRental();
      rental2.fetchAgreementState = jest.fn().mockResolvedValue("Expired");
      pool["lowPriority"].add(rental1);
      pool["lowPriority"].add(rental2);

      expect(pool.getBorrowedSize()).toBe(0);
      expect(pool.getAvailableSize()).toBe(2);
      const resourceRental = await pool.acquire();
      expect(pool.getBorrowedSize()).toBe(1);
      expect(pool.getAvailableSize()).toBe(0);
      expect(resourceRental).toBe(newlyCreatedRental);
      expect(pool["destroy"]).toHaveBeenCalledWith(rental1);
      expect(pool["destroy"]).toHaveBeenCalledWith(rental2);
    });
    it("should not create more processes than allowed", async () => {
      jest.useFakeTimers();
      const pool = getRentalPool({ min: 3, max: 3 });
      pool["createNewResourceRental"] = jest.fn(async () => {
        pool["rentalsBeingSigned"]++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        pool["rentalsBeingSigned"]--;
        return getMockResourceRental();
      });
      expect(pool.getSize()).toBe(0);
      pool.acquire(); // should be resolved after 50ms
      pool.acquire(); // should be resolved after 50ms
      pool.acquire(); // should be resolved after 50ms
      pool.acquire(); // should be added to the queue
      pool.acquire(); // should be added to the queue
      pool.acquire(); // should be added to the queue
      pool.acquire(); // should be added to the queue
      await jest.advanceTimersByTimeAsync(50);
      expect(pool.getSize()).toBe(3);
      expect(pool.getBorrowedSize()).toBe(3);
      expect(pool.getAvailableSize()).toBe(0);
      expect(pool["acquireQueue"].length).toBe(4);
    });
  });
  describe("release()", () => {
    it("releases a resource rental back to the pool", async () => {
      const pool = getRentalPool({ min: 3 });
      const rental1 = getMockResourceRental();
      const rental2 = getMockResourceRental();
      pool["lowPriority"].add(rental1);
      pool["lowPriority"].add(rental2);

      const resourceRental = await pool.acquire();
      expect(pool.getBorrowedSize()).toBe(1);
      expect(pool.getAvailableSize()).toBe(1);
      await pool.release(resourceRental);
      expect(pool.getBorrowedSize()).toBe(0);
      expect(pool.getAvailableSize()).toBe(2);
      expect(pool["lowPriority"].has(rental1)).toBe(true);
      expect(pool["lowPriority"].has(rental2)).toBe(true);
    });
    it("releases a resource rental back to the high priority pool if it has an activity", async () => {
      const pool = getRentalPool({ min: 3 });
      const rental1 = getMockResourceRental();
      const rental2 = getMockResourceRental();
      const rental3 = getMockResourceRental();
      pool["lowPriority"].add(rental1);
      pool["lowPriority"].add(rental2);
      pool["lowPriority"].add(rental3);

      const resourceRental = await pool.acquire();
      expect(pool.getBorrowedSize()).toBe(1);
      expect(pool.getAvailableSize()).toBe(2);
      resourceRental.hasActivity = () => true;
      await pool.release(resourceRental);
      expect(pool.getBorrowedSize()).toBe(0);
      expect(pool.getAvailableSize()).toBe(3);
      expect(pool["highPriority"].size).toBe(1);
      expect(pool["lowPriority"].size).toBe(2);
    });
    it("destroys the resource rental if the pool is full", async () => {
      const pool = getRentalPool({ max: 2 });
      jest.spyOn(pool, "destroy");
      const rental1 = getMockResourceRental();
      const rental2 = getMockResourceRental();
      const rental3 = getMockResourceRental();

      pool["lowPriority"].add(rental1);
      pool["lowPriority"].add(rental2);

      const acquiredRental1 = await pool.acquire();
      expect(pool.getBorrowedSize()).toBe(1);
      expect(pool.getAvailableSize()).toBe(1);

      pool["lowPriority"].add(rental3);

      await pool.release(acquiredRental1);
      expect(pool.getBorrowedSize()).toBe(0);
      expect(pool.getAvailableSize()).toBe(2);
      expect(pool["lowPriority"].has(rental2)).toBe(true);
      expect(pool["lowPriority"].has(rental3)).toBe(true);
      expect(pool["destroy"]).toHaveBeenCalledWith(rental1);
    });
    it("destroys the resource rental if it is invalid", async () => {
      const pool = getRentalPool({ max: 1 });
      jest.spyOn(pool, "destroy");
      const rental1 = getMockResourceRental();

      pool["lowPriority"].add(rental1);

      const acquiredRental1 = await pool.acquire();
      expect(pool.getBorrowedSize()).toBe(1);
      expect(pool.getAvailableSize()).toBe(0);

      acquiredRental1.fetchAgreementState = jest.fn().mockResolvedValue("Expired");

      await pool.release(acquiredRental1);
      expect(pool.getBorrowedSize()).toBe(0);
      expect(pool.getAvailableSize()).toBe(0);
      expect(pool["destroy"]).toHaveBeenCalledWith(rental1);
    });
  });
  describe("destroy()", () => {
    it("removes the resource rental from the pool", async () => {
      const pool = getRentalPool({ max: 1 });
      const rental1 = getMockResourceRental();
      pool["lowPriority"].add(rental1);

      const resourceRental = await pool.acquire();
      expect(pool.getBorrowedSize()).toBe(1);
      expect(pool.getAvailableSize()).toBe(0);
      pool.destroy(resourceRental);
      expect(pool.getBorrowedSize()).toBe(0);
      expect(pool.getAvailableSize()).toBe(0);
    });
  });
  describe("drainAndClear", () => {
    it("destroys all resource rentals in the pool", async () => {
      const pool = getRentalPool({ max: 3 });
      jest.spyOn(pool, "destroy");
      const rental1 = getMockResourceRental();
      const rental2 = getMockResourceRental();
      const rental3 = getMockResourceRental();
      pool["lowPriority"].add(rental1);
      pool["lowPriority"].add(rental2);
      pool["lowPriority"].add(rental3);

      await pool.acquire();
      await pool.acquire();
      expect(pool.getBorrowedSize()).toBe(2);
      expect(pool.getAvailableSize()).toBe(1);
      await pool.drainAndClear();
      expect(pool.getBorrowedSize()).toBe(0);
      expect(pool.getAvailableSize()).toBe(0);
      expect(pool["destroy"]).toHaveBeenCalledWith(rental1);
      expect(pool["destroy"]).toHaveBeenCalledWith(rental2);
      expect(pool["destroy"]).toHaveBeenCalledWith(rental3);
    });
    it("prevents new rentals from being acquired during the drain", async () => {
      const pool = getRentalPool({ max: 3 });
      const realDestroy = pool.destroy;
      jest.spyOn(pool, "destroy").mockImplementation(async (...args) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return realDestroy.apply(pool, args);
      });
      const rental1 = getMockResourceRental();
      const rental2 = getMockResourceRental();
      const rental3 = getMockResourceRental();
      pool["lowPriority"].add(rental1);
      pool["lowPriority"].add(rental2);
      pool["lowPriority"].add(rental3);

      await pool.acquire();
      await pool.acquire();
      expect(pool.getBorrowedSize()).toBe(2);
      expect(pool.getAvailableSize()).toBe(1);
      const drainPromise = pool.drainAndClear();
      expect(pool.acquire()).rejects.toThrow("The pool is in draining mode");
      await drainPromise;
      expect(pool.getBorrowedSize()).toBe(0);
      expect(pool.getAvailableSize()).toBe(0);
      expect(pool["destroy"]).toHaveBeenCalledWith(rental1);
      expect(pool["destroy"]).toHaveBeenCalledWith(rental2);
      expect(pool["destroy"]).toHaveBeenCalledWith(rental3);
    });
    it("reuses the same promise if called multiple times", async () => {
      const pool = getRentalPool({ max: 3 });
      const poolSpy = spy(pool);
      when(poolSpy["startDrain"]()).thenResolve();

      expect(pool["drainPromise"]).toBeUndefined();
      const drainPromise1 = pool.drainAndClear();
      const drainPromise2 = pool.drainAndClear();
      const drainPromise3 = pool.drainAndClear();
      expect(pool["drainPromise"]).toBeDefined();
      await Promise.all([drainPromise1, drainPromise2, drainPromise3]);
      verify(poolSpy["startDrain"]()).once();
      expect(pool["drainPromise"]).toBeUndefined();
    });
    it("stops rentals that are in the process of being signed", async () => {
      const pool = getRentalPool({ max: 3 });
      const mockAgreement = mock(Agreement);
      const agreement = instance(mockAgreement);

      // simulate signing process taking a long time
      when(marketModule.signAgreementFromPool(_, _, _)).thenCall((_1, _2, signal: AbortSignal) => {
        return new Promise((resolve, reject) => {
          signal.throwIfAborted();
          signal.addEventListener("abort", () => reject(signal.reason));
          setTimeout(() => resolve(agreement), 1000);
        });
      });

      expect.assertions(3);
      const acquirePromise = pool
        .acquire()
        .then(() => {
          throw new Error("Acquire resolved even though it should have been rejected");
        })
        .catch((error) => {
          expect(error).toBe("The pool is in draining mode");
        });
      await pool.drainAndClear();
      await acquirePromise;
      expect(pool.getSize()).toBe(0);
      expect(pool["rentalsBeingSigned"]).toBe(0);
    });
  });
});
