import { Activity, ActivityStateEnum, Agreement } from "../../src";
import { instance, mock } from "@johanblumenberg/ts-mockito";

const mockAgreement = mock(Agreement);

describe("Activity", () => {
  describe("Getting state", () => {
    it("should get activity state", () => {
      const activity = new Activity("activity-id", instance(mockAgreement), ActivityStateEnum.New, {
        currentUsage: [0.0, 0.0, 0.0],
        timestamp: Date.now(),
      });
      const state = activity.getState();
      expect(state).toEqual(ActivityStateEnum.New);
    });
  });
});
