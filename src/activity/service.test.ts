import { YagnaMock, agreementPoolServiceMock, paymentServiceMock } from "../../tests/mock";
import { ActivityPoolService } from "./service";
import { Activity } from "./activity";

const yagnaApi = new YagnaMock().getApi();
describe("Activity Pool Service", () => {
  let activityService: ActivityPoolService;
  beforeEach(() => {
    activityService = new ActivityPoolService(yagnaApi, agreementPoolServiceMock, paymentServiceMock);
  });

  describe("run()", () => {
    it("should start service", async () => {
      await activityService.run();
      expect(activityService.isRunning()).toEqual(true);
      await activityService.end();
    });
  });
  describe("end()", () => {
    it("should stop service", async () => {
      await activityService.run();
      await activityService.end();
      expect(activityService.isRunning()).toEqual(false);
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
      await activityService.releaseActivity(activity1, { reuse: true });
      const activity2 = await activityService.getActivity();
      expect(activity1).toEqual(activity2);
      await activityService.end();
    });
  });
  describe("releaseActivity()", () => {
    it("should return activity to the pool if allowReuse flag is true", async () => {
      await activityService.run();
      const activity = await activityService.getActivity();
      await activityService.releaseActivity(activity, { reuse: true });
      expect(activityService["pool"]).toContain(activity);
      await activityService.end();
    });

    it("should terminate activity if allowReuse flag is false", async () => {
      await activityService.run();
      const activity = await activityService.getActivity();
      const spyAgreementService = jest.spyOn(agreementPoolServiceMock, "releaseAgreement");
      const spyActivity = jest.spyOn(activity, "stop");
      await activityService.releaseActivity(activity, { reuse: false });
      expect(spyActivity).toHaveBeenCalled();
      expect(spyAgreementService).toHaveBeenCalledWith(activity.agreement.id, false);
      await activityService.end();
    });
  });
});
