import { ActivityPool } from "./service";
import { Activity } from "./activity";
import { YagnaApi } from "../utils";
import { Agreement, AgreementPoolService } from "../agreement";
import { PaymentService } from "../payment";
import { anything, instance, mock, reset, verify, when } from "@johanblumenberg/ts-mockito";
import * as YaTsClient from "ya-ts-client";

const mockYagna = mock(YagnaApi);
const mockActivityControl = mock(YaTsClient.ActivityApi.RequestorControlService);
const mockActivityState = mock(YaTsClient.ActivityApi.RequestorStateService);

const mockAgreementPool = mock(AgreementPoolService);
const mockPaymentService = mock(PaymentService);

const mockAgreement = mock(Agreement);

describe("Activity Pool Service", () => {
  let activityService: ActivityPool;

  const yagnaApi = instance(mockYagna);

  beforeEach(() => {
    activityService = new ActivityPool(yagnaApi, instance(mockAgreementPool), instance(mockPaymentService));

    // Reset mocks
    reset(mockYagna);
    reset(mockAgreementPool);
    reset(mockPaymentService);
    reset(mockActivityControl);
    reset(mockActivityState);

    // Set them up
    when(mockYagna.activity).thenReturn({
      control: instance(mockActivityControl),
      state: instance(mockActivityState),
    });

    when(mockAgreementPool.getAgreement()).thenResolve(instance(mockAgreement));

    when(mockActivityControl.createActivity(anything())).thenResolve({ activityId: "example-activity-id" });
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
      const spyActivity = jest.spyOn(activity, "stop");
      await activityService.releaseActivity(activity, { reuse: false });
      expect(spyActivity).toHaveBeenCalled();
      await activityService.end();

      verify(mockAgreementPool.releaseAgreement(activity.agreement.id, false)).once();
    });
  });
});
