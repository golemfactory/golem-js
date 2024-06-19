import { Activity, ActivityStateEnum, Agreement } from "../index";
import { instance, mock } from "@johanblumenberg/ts-mockito";

const mockAgreement = mock(Agreement);

describe("Activity", () => {
  describe("Getting state", () => {
    it("should get activity state", () => {
      const activity = new Activity(
        "activity-id",
        instance(mockAgreement),
        ActivityStateEnum.Initialized,
        ActivityStateEnum.New,
        {
          currentUsage: [0.0, 0.0, 0.0],
          timestamp: Date.now(),
        },
      );
      const state = activity.getState();
      const prev = activity.getPreviousState();
      expect(state).toEqual(ActivityStateEnum.Initialized);
      expect(prev).toEqual(ActivityStateEnum.New);
    });
  });
});
