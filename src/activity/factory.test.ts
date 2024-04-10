import { ActivityFactory } from "./factory";
import { Agreement } from "../agreement";
import { anything, instance, mock, reset, when } from "@johanblumenberg/ts-mockito";
import { YagnaApi } from "../shared/utils";
import { ActivityApi } from "ya-ts-client";
import { GolemWorkError, WorkErrorCode } from "./work";

const mockYagna = mock(YagnaApi);
const mockAgreement = mock(Agreement);

const mockActivityControl = mock(ActivityApi.RequestorControlService);
const mockActivityState = mock(ActivityApi.RequestorStateService);

describe("Activity Factory", () => {
  beforeEach(() => {
    reset(mockYagna);
    reset(mockAgreement);
    reset(mockActivityControl);
    reset(mockActivityState);
  });

  describe("Creating activities", () => {
    describe("Negative cases", () => {
      it("Correctly passes the exception thrown during activity creation to the user", async () => {
        when(mockYagna.activity).thenReturn({
          state: instance(mockActivityState),
          control: instance(mockActivityControl),
        });

        const testError = new Error("Foo");
        when(mockActivityControl.createActivity(anything())).thenReject(testError);

        const agreement = instance(mockAgreement);
        const factory = new ActivityFactory(agreement, instance(mockYagna));

        await expect(() => factory.create()).rejects.toMatchError(
          new GolemWorkError(
            "Unable to create activity: Error: Foo",
            WorkErrorCode.ActivityCreationFailed,
            agreement,
            undefined,
            agreement.getProviderInfo(),
            testError,
          ),
        );
      });
    });
  });
});
