import { ActivityPool } from "../../src/activity/work/pool";

describe("ActivityPool", () => {
  it("should run a simple script on the activity from the pool", async () => {
    const pool = new ActivityPool({
      image: "golem/alpine:latest",
    });
    await pool.start();

    const activity = await pool.acquire();
    expect(pool.getSize()).toEqual(1);
    expect(pool.getAvailable()).toEqual(0);
    expect(pool.getBorrowed()).toEqual(1);
    const result = await activity.run("echo Hello World");
    expect(result.stdout?.toString().trim()).toEqual("Hello World");
    await pool.destroy(activity);
    await pool.stop();
  });

  it("should prepare two activity ready to use", async () => {
    const pool = new ActivityPool({
      image: "golem/alpine:latest",
      pool: { min: 2 },
    });
    await pool.start();
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
    await pool.stop();
  });

  it("should release the activity and reuse it again", async () => {
    const pool = new ActivityPool({
      image: "golem/alpine:latest",
      pool: { min: 1 },
    });
    await pool.start();
    const activity = await pool.acquire();
    const result1 = await activity.run("echo result-1");
    expect(result1.stdout?.toString().trim()).toEqual("result-1");
    await pool.release(activity);
    const activityAfterRelease = await pool.acquire();
    const result2 = await activityAfterRelease.run("echo result-2");
    expect(result2.stdout?.toString().trim()).toEqual("result-2");
    await pool.destroy(activityAfterRelease);
    expect(activity.activity.id).toEqual(activityAfterRelease.activity.id);
    await pool.stop();
  });
});
