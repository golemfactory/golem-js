import {
  ActivityPool,
  AgreementPool,
  Allocation,
  DraftOfferProposalPool,
  GolemNetwork,
  Package,
  YagnaApi,
} from "../../src";

describe("ActivityPool", () => {
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
    allocation = await Allocation.create(yagnaApi, {
      account: {
        address: (await yagnaApi.identity.getIdentity()).identity,
        platform: "erc20-holesky-tglm",
      },
      budget: 1,
    });
  });

  afterAll(async () => {
    await allocation.release();
    await yagnaApi.disconnect();
  });

  beforeEach(async () => {
    proposalPool = new DraftOfferProposalPool();
    agreementPool = new AgreementPool(modules, proposalPool);
    const workload = Package.create({
      imageTag: "golem/alpine:latest",
    });
    const demandOffer = await modules.market.buildDemand(workload, allocation, {});
    proposalSubscription = modules.market
      .startCollectingProposals({
        demandOffer,
        paymentPlatform: "erc20-holesky-tglm",
      })
      .subscribe((proposalsBatch) => proposalsBatch.forEach((proposal) => proposalPool.add(proposal)));
  });

  afterEach(async () => {
    await proposalSubscription.unsubscribe();
    await agreementPool.drainAndClear();
    proposalPool.clear();
  });

  it("should run a simple script on the activity from the pool", async () => {
    const pool = new ActivityPool(modules, agreementPool);
    const activity = await pool.acquire();
    expect(pool.getSize()).toEqual(1);
    expect(pool.getAvailable()).toEqual(0);
    expect(pool.getBorrowed()).toEqual(1);
    const result = await activity.run("echo Hello World");
    expect(result.stdout?.toString().trim()).toEqual("Hello World");
    await pool.destroy(activity);
    await pool.drainAndClear();
  });

  it("should prepare two activity ready to use", async () => {
    const pool = new ActivityPool(modules, agreementPool, { replicas: 2 });
    await pool.ready();
    expect(pool.getSize()).toEqual(2);
    expect(pool.getAvailable()).toEqual(2);
    expect(pool.getBorrowed()).toEqual(0);
    const activity1 = await pool.acquire();
    expect(pool.getAvailable()).toEqual(1);
    expect(pool.getBorrowed()).toEqual(1);
    const activity2 = await pool.acquire();
    expect(pool.getAvailable()).toEqual(0);
    expect(pool.getBorrowed()).toEqual(2);
    expect(activity1).toBeDefined();
    expect(activity2).toBeDefined();
    expect(activity1.provider.id).not.toEqual(activity2.provider.id);
    await pool.release(activity1);
    expect(pool.getAvailable()).toEqual(1);
    expect(pool.getBorrowed()).toEqual(1);
    await pool.release(activity2);
    expect(pool.getAvailable()).toEqual(2);
    expect(pool.getBorrowed()).toEqual(0);
    await pool.drainAndClear();
  });

  it("should release the activity and reuse it again", async () => {
    const pool = new ActivityPool(modules, agreementPool, { replicas: 1 });
    const activity = await pool.acquire();
    const result1 = await activity.run("echo result-1");
    expect(result1.stdout?.toString().trim()).toEqual("result-1");
    await pool.release(activity);
    const activityAfterRelease = await pool.acquire();
    const result2 = await activityAfterRelease.run("echo result-2");
    expect(result2.stdout?.toString().trim()).toEqual("result-2");
    await pool.destroy(activityAfterRelease);
    expect(activity.activity.id).toEqual(activityAfterRelease.activity.id);
    await pool.drainAndClear();
  });

  it("should terminate all activities and agreemnets after drain and clear the poll", async () => {
    const pool = new ActivityPool(modules, agreementPool, { replicas: 2 });
    const avtivityTerminsatedIds: string[] = [];
    const agreemnetTerminatedIds: string[] = [];
    agreementPool.events.on("destroyed", (agreement) => agreemnetTerminatedIds.push(agreement.id));
    pool.events.on("destroyed", (activity) => avtivityTerminsatedIds.push(activity.id));
    const activity1 = await pool.acquire();
    const activity2 = await pool.acquire();
    await activity1.run("echo result-1");
    await activity2.run("echo result-2");
    await pool.release(activity1);
    await pool.release(activity2);
    await pool.drainAndClear();
    await agreementPool.drainAndClear();
    expect(avtivityTerminsatedIds.sort()).toEqual([activity1.activity.id, activity2.activity.id].sort());
    expect(agreemnetTerminatedIds.sort()).toEqual(
      [activity1.activity.agreement.id, activity2.activity.agreement.id].sort(),
    );
  });
});
