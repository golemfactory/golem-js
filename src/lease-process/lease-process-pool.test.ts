import { _, imock, instance, mock, reset, verify, when } from "@johanblumenberg/ts-mockito";
import type { Agreement, IAgreementApi } from "../market/agreement/agreement";
import { LeaseProcess } from "./lease-process";
import { Allocation, IPaymentApi } from "../payment";
import type { MarketModule } from "../market";
import { DraftOfferProposalPool } from "../market";
import { LeaseProcessPool } from "./lease-process-pool";
import { type RequireAtLeastOne } from "../shared/utils/types";
import { NetworkModule } from "../network";

const agreementApi = imock<IAgreementApi>();
const paymentApi = imock<IPaymentApi>();
const allocation = mock(Allocation);
const proposalPool = mock(DraftOfferProposalPool);
const marketModule = imock<MarketModule>();
const networkModule = imock<NetworkModule>();

function getMockLeaseProcess() {
  return {
    hasActivity: () => false,
    fetchAgreementState: () => Promise.resolve("Approved"),
    agreement: { id: "1", getDto: () => ({}) } as Agreement,
  } as LeaseProcess;
}

function getLeasePool(replicas: RequireAtLeastOne<{ min: number; max: number }>) {
  return new LeaseProcessPool({
    agreementApi: instance(agreementApi),
    paymentApi: instance(paymentApi),
    allocation: instance(allocation),
    proposalPool: instance(proposalPool),
    marketModule: instance(marketModule),
    networkModule: instance(networkModule),
    network: undefined,
    replicas,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  reset(agreementApi);
  reset(paymentApi);
  reset(allocation);
  reset(proposalPool);
  reset(marketModule);
});

describe("LeaseProcessPool", () => {
  describe("ready()", () => {
    it("prepares MIN_POOL_SIZE lease processes", async () => {
      when(marketModule.signAgreementFromPool(_)).thenResolve({
        getDto: () => ({}),
      } as Agreement);
      when(marketModule.createLease(_, _, _)).thenCall(() => ({}) as LeaseProcess);

      const pool = getLeasePool({ min: 5, max: 10 });

      await pool.ready();

      expect(pool.getAvailableSize()).toBe(5);
      verify(marketModule.signAgreementFromPool(_)).times(5);
    });
    it("retries on error", async () => {
      when(marketModule.createLease(_, _, _)).thenCall(() => ({}) as LeaseProcess);

      const fakeAgreement = { getDto: () => ({}) } as Agreement;
      when(marketModule.signAgreementFromPool(_))
        .thenResolve(fakeAgreement)
        .thenReject(new Error("Failed to propose agreement"))
        .thenResolve(fakeAgreement)
        .thenReject(new Error("Failed to propose agreement"))
        .thenResolve(fakeAgreement);

      const pool = getLeasePool({ min: 3 });

      await pool.ready();

      expect(pool.getAvailableSize()).toBe(3);
      verify(marketModule.signAgreementFromPool(_)).times(5);
    });
    it("stops retrying after abort signal is triggered", async () => {
      const pool = getLeasePool({ min: 3 });
      pool["createNewLeaseProcess"] = jest
        .fn(
          () =>
            new Promise<LeaseProcess | never>((_, reject) =>
              setTimeout(() => reject(new Error("Failed to propose agreement")), 50),
            ),
        )
        // the first call will succeed, the rest will fail (fall back to the first implementation)
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve(getMockLeaseProcess()), 50)));

      await expect(pool.ready(AbortSignal.timeout(60))).rejects.toThrow(
        "Could not create enough lease processes to reach the minimum pool size in time",
      );
      expect(pool.getAvailableSize()).toBe(1);
      // first loop 3 times, then 2 times
      expect(pool["createNewLeaseProcess"]).toHaveBeenCalledTimes(5);
    });
    it("stops retrying after specified timeout is reached", async () => {
      const pool = getLeasePool({ min: 3 });
      pool["createNewLeaseProcess"] = jest
        .fn(
          () =>
            new Promise<LeaseProcess | never>((_, reject) =>
              setTimeout(() => reject(new Error("Failed to propose agreement")), 50),
            ),
        )
        // the first call will succeed, the rest will fail (fall back to the first implementation)
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve(getMockLeaseProcess()), 50)));

      await expect(pool.ready(60)).rejects.toThrow(
        "Could not create enough lease processes to reach the minimum pool size in time",
      );
      expect(pool.getAvailableSize()).toBe(1);
      // first loop 3 times, then 2 times
      expect(pool["createNewLeaseProcess"]).toHaveBeenCalledTimes(5);
    });
  });
  describe("acquire()", () => {
    it("takes a random lease process from the pool if none have activities", async () => {
      const pool = getLeasePool({ min: 3 });
      const lease1 = getMockLeaseProcess();
      const lease2 = getMockLeaseProcess();
      const lease3 = getMockLeaseProcess();
      pool["lowPriority"].add(lease1);
      pool["lowPriority"].add(lease2);
      pool["lowPriority"].add(lease3);

      const leaseProcess = await pool.acquire();
      expect(pool.getBorrowedSize()).toBe(1);
      expect(pool.getAvailableSize()).toBe(2);
      expect([lease1, lease2, lease3]).toContain(leaseProcess);
    });
    it("prioritizes lease processes from high priority pool", async () => {
      const pool = getLeasePool({ min: 3 });
      const lease1 = getMockLeaseProcess();
      const lease2 = getMockLeaseProcess();
      const lease3 = getMockLeaseProcess();
      pool["lowPriority"].add(lease1);
      pool["highPriority"].add(lease2);
      pool["lowPriority"].add(lease3);

      const leaseProcess = await pool.acquire();
      expect(pool.getBorrowedSize()).toBe(1);
      expect(pool.getAvailableSize()).toBe(2);
      expect(leaseProcess).toBe(lease2);
    });
    it("creates a new lease process if none are available", async () => {
      const pool = getLeasePool({ min: 3 });
      pool["createNewLeaseProcess"] = jest.fn(() => Promise.resolve(getMockLeaseProcess()));

      expect(pool.getSize()).toBe(0);
      await pool.acquire();
      expect(pool.getSize()).toBe(1);
      expect(pool.getBorrowedSize()).toBe(1);
      expect(pool.getAvailableSize()).toBe(0);
    });
    it("waits for a lease to become available when the pool is full", async () => {
      const pool = getLeasePool({ min: 3, max: 3 });
      const lease1 = getMockLeaseProcess();
      const lease2 = getMockLeaseProcess();
      const lease3 = getMockLeaseProcess();
      pool["lowPriority"].add(lease1);
      pool["lowPriority"].add(lease2);
      pool["lowPriority"].add(lease3);

      const acquiredLease1 = await pool.acquire();
      await pool.acquire();
      await pool.acquire();

      expect(pool.getAvailableSize()).toBe(0);
      expect(pool.getBorrowedSize()).toBe(3);
      const acquiredLeasePromise = pool.acquire();
      // go to the next tick
      await Promise.resolve();
      expect(pool["acquireQueue"].length).toBe(1);
      pool.release(acquiredLease1);
      await acquiredLeasePromise;
      expect(pool.getAvailableSize()).toBe(0);
      expect(pool.getBorrowedSize()).toBe(3);
      expect(pool["acquireQueue"].length).toBe(0);
    });
    it("validates the lease process before returning it", async () => {
      const pool = getLeasePool({ min: 3 });
      const newlyCreatedLease = getMockLeaseProcess();
      jest.spyOn(pool, "destroy");
      pool["createNewLeaseProcess"] = jest.fn(() => Promise.resolve(newlyCreatedLease));

      const lease1 = getMockLeaseProcess();
      lease1.fetchAgreementState = jest.fn().mockResolvedValue("Expired");
      const lease2 = getMockLeaseProcess();
      lease2.fetchAgreementState = jest.fn().mockResolvedValue("Expired");
      pool["lowPriority"].add(lease1);
      pool["lowPriority"].add(lease2);

      expect(pool.getBorrowedSize()).toBe(0);
      expect(pool.getAvailableSize()).toBe(2);
      const leaseProcess = await pool.acquire();
      expect(pool.getBorrowedSize()).toBe(1);
      expect(pool.getAvailableSize()).toBe(0);
      expect(leaseProcess).toBe(newlyCreatedLease);
      expect(pool["destroy"]).toHaveBeenCalledWith(lease1);
      expect(pool["destroy"]).toHaveBeenCalledWith(lease2);
    });
  });
  describe("release()", () => {
    it("releases a lease process back to the pool", async () => {
      const pool = getLeasePool({ min: 3 });
      const lease1 = getMockLeaseProcess();
      const lease2 = getMockLeaseProcess();
      pool["lowPriority"].add(lease1);
      pool["lowPriority"].add(lease2);

      const leaseProcess = await pool.acquire();
      expect(pool.getBorrowedSize()).toBe(1);
      expect(pool.getAvailableSize()).toBe(1);
      await pool.release(leaseProcess);
      expect(pool.getBorrowedSize()).toBe(0);
      expect(pool.getAvailableSize()).toBe(2);
      expect(pool["lowPriority"].has(lease1)).toBe(true);
      expect(pool["lowPriority"].has(lease2)).toBe(true);
    });
    it("releases a lease process back to the high priority pool if it has an activity", async () => {
      const pool = getLeasePool({ min: 3 });
      const lease1 = getMockLeaseProcess();
      const lease2 = getMockLeaseProcess();
      const lease3 = getMockLeaseProcess();
      pool["lowPriority"].add(lease1);
      pool["lowPriority"].add(lease2);
      pool["lowPriority"].add(lease3);

      const leaseProcess = await pool.acquire();
      expect(pool.getBorrowedSize()).toBe(1);
      expect(pool.getAvailableSize()).toBe(2);
      leaseProcess.hasActivity = () => true;
      await pool.release(leaseProcess);
      expect(pool.getBorrowedSize()).toBe(0);
      expect(pool.getAvailableSize()).toBe(3);
      expect(pool["highPriority"].size).toBe(1);
      expect(pool["lowPriority"].size).toBe(2);
    });
    it("destroys the lease process if the pool is full", async () => {
      const pool = getLeasePool({ max: 2 });
      jest.spyOn(pool, "destroy");
      const lease1 = getMockLeaseProcess();
      const lease2 = getMockLeaseProcess();
      const lease3 = getMockLeaseProcess();

      pool["lowPriority"].add(lease1);
      pool["lowPriority"].add(lease2);

      const acquiredLease1 = await pool.acquire();
      expect(pool.getBorrowedSize()).toBe(1);
      expect(pool.getAvailableSize()).toBe(1);

      pool["lowPriority"].add(lease3);

      await pool.release(acquiredLease1);
      expect(pool.getBorrowedSize()).toBe(0);
      expect(pool.getAvailableSize()).toBe(2);
      expect(pool["lowPriority"].has(lease2)).toBe(true);
      expect(pool["lowPriority"].has(lease3)).toBe(true);
      expect(pool["destroy"]).toHaveBeenCalledWith(lease1);
    });
    it("destroys the lease process if it is invalid", async () => {
      const pool = getLeasePool({ max: 1 });
      jest.spyOn(pool, "destroy");
      const lease1 = getMockLeaseProcess();

      pool["lowPriority"].add(lease1);

      const acquiredLease1 = await pool.acquire();
      expect(pool.getBorrowedSize()).toBe(1);
      expect(pool.getAvailableSize()).toBe(0);

      acquiredLease1.fetchAgreementState = jest.fn().mockResolvedValue("Expired");

      await pool.release(acquiredLease1);
      expect(pool.getBorrowedSize()).toBe(0);
      expect(pool.getAvailableSize()).toBe(0);
      expect(pool["destroy"]).toHaveBeenCalledWith(lease1);
    });
  });
  describe("destroy()", () => {
    it("removes the lease process from the pool", async () => {
      const pool = getLeasePool({ max: 1 });
      const lease1 = getMockLeaseProcess();
      pool["lowPriority"].add(lease1);

      const leaseProcess = await pool.acquire();
      expect(pool.getBorrowedSize()).toBe(1);
      expect(pool.getAvailableSize()).toBe(0);
      pool.destroy(leaseProcess);
      expect(pool.getBorrowedSize()).toBe(0);
      expect(pool.getAvailableSize()).toBe(0);
    });
  });
  describe("drainAndClear", () => {
    it("destroys all lease processes in the pool", async () => {
      const pool = getLeasePool({ max: 3 });
      jest.spyOn(pool, "destroy");
      const lease1 = getMockLeaseProcess();
      const lease2 = getMockLeaseProcess();
      const lease3 = getMockLeaseProcess();
      pool["lowPriority"].add(lease1);
      pool["lowPriority"].add(lease2);
      pool["lowPriority"].add(lease3);

      await pool.acquire();
      await pool.acquire();
      expect(pool.getBorrowedSize()).toBe(2);
      expect(pool.getAvailableSize()).toBe(1);
      await pool.drainAndClear();
      expect(pool.getBorrowedSize()).toBe(0);
      expect(pool.getAvailableSize()).toBe(0);
      expect(pool["destroy"]).toHaveBeenCalledWith(lease1);
      expect(pool["destroy"]).toHaveBeenCalledWith(lease2);
      expect(pool["destroy"]).toHaveBeenCalledWith(lease3);
    });
    it("prevents new leases from being acquired during the drain", async () => {
      const pool = getLeasePool({ max: 3 });
      const realDestroy = pool.destroy;
      jest.spyOn(pool, "destroy").mockImplementation(async (...args) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return realDestroy.apply(pool, args);
      });
      const lease1 = getMockLeaseProcess();
      const lease2 = getMockLeaseProcess();
      const lease3 = getMockLeaseProcess();
      pool["lowPriority"].add(lease1);
      pool["lowPriority"].add(lease2);
      pool["lowPriority"].add(lease3);

      await pool.acquire();
      await pool.acquire();
      expect(pool.getBorrowedSize()).toBe(2);
      expect(pool.getAvailableSize()).toBe(1);
      const drainPromise = pool.drainAndClear();
      expect(pool.acquire()).rejects.toThrow("The pool is in draining mode");
      await drainPromise;
      expect(pool.getBorrowedSize()).toBe(0);
      expect(pool.getAvailableSize()).toBe(0);
      expect(pool["destroy"]).toHaveBeenCalledWith(lease1);
      expect(pool["destroy"]).toHaveBeenCalledWith(lease2);
      expect(pool["destroy"]).toHaveBeenCalledWith(lease3);
    });
  });
});
