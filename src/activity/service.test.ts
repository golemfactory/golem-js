import { LoggerMock, YagnaMock, agreementPoolServiceMock, paymentServiceMock } from "../../tests/mock";
import { ActivityPoolService } from "./service";
import { Activity } from "./activity";

const logger = new LoggerMock();
const yagnaApi = new YagnaMock().getApi();
describe("Activity Pool Service", () => {
  let activityService: ActivityPoolService;
  beforeEach(() => {
    activityService = new ActivityPoolService(yagnaApi, agreementPoolServiceMock, paymentServiceMock, {
      logger,
    });
    logger.clear();
  });

  describe("run()", () => {
    it("should start service", async () => {
      await activityService.run();
      expect(logger.logs).toContain("Activity Pool Service has started");
      await activityService.end();
    });
  });
  describe("end()", () => {
    it("should stop service", async () => {
      await activityService.run();
      await activityService.end();
      expect(logger.logs).toContain("Activity Pool Service has been stopped");
    });
  });
  describe("getActivity()", () => {
    it("should create and return activity", async () => {
      await activityService.run();
      const activity = await activityService.getActivity();
      expect(activity).toBeInstanceOf(Activity);
      await activityService.end();
    });
    it("should return activity if is available in the pool", async () => {
      await activityService.run();
      const activity1 = await activityService.getActivity();
      await activityService.releaseActivity(activity1, true);
      const activity2 = await activityService.getActivity();
      expect(activity1).toEqual(activity2);
      await activityService.end();
    });
  });
  describe("releaseActivity()", () => {
    it("should return activity to the pool if allowReuse flag is true", async () => {
      await activityService.run();
      const activity = await activityService.getActivity();
      await activityService.releaseActivity(activity, true);
      expect(logger.logs).toContain(`Activity ${activity.id} has been released for reuse`);
      await activityService.end();
    });

    it("should terminate activity if allowReuse flag is false", async () => {
      await activityService.run();
      const activity = await activityService.getActivity();
      await activityService.releaseActivity(activity, false);
      expect(logger.logs).toContain(`Activity ${activity.id} has been released and will be terminated`);
      expect(logger.logs).toContain(`Activity ${activity.id} destroyed`);
      await activityService.end();
    });
  });
});
