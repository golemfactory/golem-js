import { Subscription } from "rxjs";
import { Allocation, DraftOfferProposalPool, GolemNetwork } from "../../src";

describe("LeaseProcessPool", () => {
  const glm = new GolemNetwork();
  let proposalPool: DraftOfferProposalPool;
  let allocation: Allocation;
  let draftProposalSub: Subscription;

  beforeAll(async () => {
    await glm.connect();
    allocation = await glm.payment.createAllocation({
      budget: 5,
      // 30 minutes
      expirationSec: 60 * 30,
    });
  });

  afterAll(async () => {
    await glm.payment.releaseAllocation(allocation);
    await glm.disconnect();
  });

  beforeEach(async () => {
    proposalPool = new DraftOfferProposalPool();
    const demandSpecification = await glm.market.buildDemandDetails(
      {
        workload: {
          imageTag: "golem/alpine:latest",
        },
      },
      allocation,
    );

    const draftProposal$ = glm.market.collectDraftOfferProposals({
      demandSpecification,
      pricing: {
        model: "linear",
        maxStartPrice: 0.5,
        maxCpuPerHourPrice: 1.0,
        maxEnvPerHourPrice: 0.5,
      },
    });

    draftProposalSub = proposalPool.readFrom(draftProposal$);
  });

  afterEach(async () => {
    draftProposalSub.unsubscribe();
    await proposalPool.clear();
  });

  it("should run a simple script on the activity from the pool", async () => {
    const pool = glm.lease.createLeaseProcessPool(proposalPool, allocation, { replicas: 1 });
    pool.events.on("error", (error) => {
      throw error;
    });
    const leaseProcess = await pool.acquire();
    expect(pool.getSize()).toEqual(1);
    expect(pool.getAvailableSize()).toEqual(0);
    expect(pool.getBorrowedSize()).toEqual(1);
    const result = await leaseProcess.getExeUnit().then((exe) => exe.run("echo Hello World"));
    expect(result.stdout?.toString().trim()).toEqual("Hello World");
    await pool.destroy(leaseProcess);
    await pool.drainAndClear();
  });

  it("should prepare two activity ready to use", async () => {
    const pool = glm.lease.createLeaseProcessPool(proposalPool, allocation, { replicas: 2 });
    pool.events.on("error", (error) => {
      throw error;
    });
    await pool.ready();
    expect(pool.getSize()).toEqual(2);
    expect(pool.getAvailableSize()).toEqual(2);
    expect(pool.getBorrowedSize()).toEqual(0);
    const lease1 = await pool.acquire();
    const activity1 = await lease1.getExeUnit();
    expect(pool.getAvailableSize()).toEqual(1);
    expect(pool.getBorrowedSize()).toEqual(1);
    const lease2 = await pool.acquire();
    const activity2 = await lease2.getExeUnit();
    expect(pool.getAvailableSize()).toEqual(0);
    expect(pool.getBorrowedSize()).toEqual(2);
    expect(activity1).toBeDefined();
    expect(activity2).toBeDefined();
    expect(activity1.provider.id).not.toEqual(activity2.provider.id);
    await pool.release(lease1);
    expect(pool.getAvailableSize()).toEqual(1);
    expect(pool.getBorrowedSize()).toEqual(1);
    await pool.release(lease2);
    expect(pool.getAvailableSize()).toEqual(2);
    expect(pool.getBorrowedSize()).toEqual(0);
    await pool.drainAndClear();
  });

  it("should release the activity and reuse it again", async () => {
    const pool = glm.lease.createLeaseProcessPool(proposalPool, allocation, { replicas: 1 });
    pool.events.on("error", (error) => {
      throw error;
    });
    const lease = await pool.acquire();
    const activity = await lease.getExeUnit();
    const result1 = await activity.run("echo result-1");
    expect(result1.stdout?.toString().trim()).toEqual("result-1");
    await pool.release(lease);
    const sameLease = await pool.acquire();
    const activityAfterRelease = await sameLease.getExeUnit();
    const result2 = await activityAfterRelease.run("echo result-2");
    expect(result2.stdout?.toString().trim()).toEqual("result-2");
    await pool.destroy(sameLease);
    expect(activity.activity.id).toEqual(activityAfterRelease.activity.id);
    await pool.drainAndClear();
  });

  it("should terminate all agreements after drain and clear the poll", async () => {
    const pool = glm.lease.createLeaseProcessPool(proposalPool, allocation, { replicas: 2 });
    pool.events.on("error", (error) => {
      throw error;
    });
    const agreementTerminatedIds: string[] = [];
    pool.events.on("destroyed", (agreement) => agreementTerminatedIds.push(agreement.id));

    const lease1 = await pool.acquire();
    const lease2 = await pool.acquire();

    const activity1 = await lease1.getExeUnit();
    const activity2 = await lease2.getExeUnit();

    await activity1.run("echo result-1");
    await activity2.run("echo result-2");

    await pool.release(lease1);
    await pool.release(lease2);
    await pool.drainAndClear();
    expect(agreementTerminatedIds.sort()).toEqual(
      [activity1.activity.agreement.id, activity2.activity.agreement.id].sort(),
    );
  });

  it("should establish a connection between two activities from pool via vpn", async () => {
    const network = await glm.network.createNetwork();
    const pool = glm.lease.createLeaseProcessPool(proposalPool, allocation, { replicas: 2, network });
    pool.events.on("error", (error) => {
      throw error;
    });
    const leaseProcess1 = await pool.acquire();
    const leaseProcess2 = await pool.acquire();
    const exe1 = await leaseProcess1.getExeUnit();
    const exe2 = await leaseProcess2.getExeUnit();
    const result1 = await exe1.run(`ping ${exe2.getIp()} -c 4`);
    const result2 = await exe2.run(`ping ${exe1.getIp()} -c 4`);
    expect(result1.stdout?.toString().trim()).toMatch("4 packets transmitted, 4 packets received, 0% packet loss");
    expect(result2.stdout?.toString().trim()).toMatch("4 packets transmitted, 4 packets received, 0% packet loss");
    expect(Object.keys(network.getNetworkInfo().nodes)).toEqual(["192.168.0.1", "192.168.0.2", "192.168.0.3"]);
    await pool.destroy(leaseProcess1);
    await pool.destroy(leaseProcess2);
    await pool.drainAndClear();
    await glm.network.removeNetwork(network);
  });
});
