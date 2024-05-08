import { DraftOfferProposalPool, GolemNetwork, YagnaApi } from "../../src";

describe("LeaseProcessPool", () => {
  const glm = new GolemNetwork();
  const yagnaApi = new YagnaApi();
  const modules = {
    market: glm.market,
    activity: glm.activity,
    payment: glm.payment,
  };
  let proposalPool;
  let agreementPool;
  let allocation;
  let proposalSubscription;

  beforeAll(async () => {
    await yagnaApi.connect();
    allocation = await modules.payment.createAllocation({ budget: 1 });
  });

  afterAll(async () => {
    await allocation.release();
    await yagnaApi.disconnect();
  });

  beforeEach(async () => {
    proposalPool = new DraftOfferProposalPool();
    const payerDetails = await modules.payment.getPayerDetails();
    const demandSpecification = await modules.market.buildDemand(
      {
        imageTag: "golem/alpine:latest",
      },
      payerDetails,
    );
    proposalSubscription = modules.market
      .startCollectingProposals({
        demandSpecification,
      })
      .subscribe((proposalsBatch) => proposalsBatch.forEach((proposal) => proposalPool.add(proposal)));
  });

  afterEach(async () => {
    await proposalSubscription.unsubscribe();
    await agreementPool.drainAndClear();
    await proposalPool.clear();
  });

  it("should run a simple script on the activity from the pool", async () => {
    const pool = modules.market.createLeaseProcessPool(proposalPool, allocation, { replicas: 1 });
    const leaseProcess = await pool.acquire();
    expect(pool.getSize()).toEqual(1);
    expect(pool.getAvailable()).toEqual(0);
    expect(pool.getBorrowed()).toEqual(1);
    const result = await leaseProcess.getExeUnit().then((exe) => exe.run("echo Hello World"));
    expect(result.stdout?.toString().trim()).toEqual("Hello World");
    await pool.destroy(leaseProcess);
    await pool.drainAndClear();
  });

  it("should prepare two activity ready to use", async () => {
    const pool = modules.market.createLeaseProcessPool(proposalPool, allocation, { replicas: 2 });
    await pool.ready();
    expect(pool.getSize()).toEqual(2);
    expect(pool.getAvailable()).toEqual(2);
    expect(pool.getBorrowed()).toEqual(0);
    const lease1 = await pool.acquire();
    const activity1 = await lease1.getExeUnit();
    expect(pool.getAvailable()).toEqual(1);
    expect(pool.getBorrowed()).toEqual(1);
    const lease2 = await pool.acquire();
    const activity2 = await lease2.getExeUnit();
    expect(pool.getAvailable()).toEqual(0);
    expect(pool.getBorrowed()).toEqual(2);
    expect(activity1).toBeDefined();
    expect(activity2).toBeDefined();
    expect(activity1.provider.id).not.toEqual(activity2.provider.id);
    await pool.release(lease1);
    expect(pool.getAvailable()).toEqual(1);
    expect(pool.getBorrowed()).toEqual(1);
    await pool.release(lease2);
    expect(pool.getAvailable()).toEqual(2);
    expect(pool.getBorrowed()).toEqual(0);
    await pool.drainAndClear();
  });

  it("should release the activity and reuse it again", async () => {
    const pool = modules.market.createLeaseProcessPool(proposalPool, allocation, { replicas: 1 });
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

  it("should terminate all activities and agreemnets after drain and clear the poll", async () => {
    const pool = modules.market.createLeaseProcessPool(proposalPool, allocation, { replicas: 2 });
    const activityTerminatedIds: string[] = [];
    const agreementTerminatedIds: string[] = [];
    agreementPool.events.on("destroyed", (agreement) => agreementTerminatedIds.push(agreement.id));
    pool.events.on("destroyed", (activity) => activityTerminatedIds.push(activity.id));

    const lease1 = await pool.acquire();
    const lease2 = await pool.acquire();

    const activity1 = await lease1.getExeUnit();
    const activity2 = await lease2.getExeUnit();

    await activity1.run("echo result-1");
    await activity2.run("echo result-2");

    await pool.release(lease1);
    await pool.release(lease2);
    await pool.drainAndClear();
    await agreementPool.drainAndClear();
    expect(activityTerminatedIds.sort()).toEqual([activity1.activity.id, activity2.activity.id].sort());
    expect(agreementTerminatedIds.sort()).toEqual(
      [activity1.activity.agreement.id, activity2.activity.agreement.id].sort(),
    );
  });
});
