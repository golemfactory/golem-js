import { ActivityFactory } from "./factory";
import { Agreement } from "../agreement";
import { anything, imock, instance, mock, when } from "@johanblumenberg/ts-mockito";
import { YagnaApi } from "../utils";
import { RequestorControlApi } from "ya-ts-client/dist/ya-activity/api";
import { RequestorApi as RequestorStateApi } from "../utils/yagna/activity";
import { GolemWorkError, WorkErrorCode } from "../task/error";

describe("Activity Factory", () => {
  describe("Creating activities", () => {
    describe("Negative cases", () => {
      it("Correctly passes the exception thrown during activity creation to the user", async () => {
        const agreementMock = mock(Agreement);
        const yagnaAPi = imock<YagnaApi>();

        const controlApi = mock(RequestorControlApi);
        const stateApi = mock(RequestorStateApi);

        const components = {
          control: instance(controlApi),
          state: instance(stateApi),
        };

        when(yagnaAPi.activity).thenReturn(components);
        const testError = new Error("Foo");
        when(controlApi.createActivity(anything())).thenReject(testError);

        const agreement = instance(agreementMock);
        const factory = new ActivityFactory(agreement, instance(yagnaAPi));

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
