import { ActivityFactory } from "./factory";
import { Agreement } from "../agreement";
import { anything, imock, instance, mock, when } from "@johanblumenberg/ts-mockito";
import { YagnaApi } from "../utils";
import { RequestorControlApi } from "ya-ts-client/dist/ya-activity/api";
import { RequestorStateApi } from "ya-ts-client/dist/ya-activity/src/api/requestor-state-api";
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

        when(controlApi.createActivity(anything())).thenReject("Foo");

        const agreement = instance(agreementMock);
        const factory = new ActivityFactory(agreement, instance(yagnaAPi));

        await expect(() => factory.create()).rejects.toThrow(
          new GolemWorkError(
            "Unable to create activity: Foo",
            WorkErrorCode.ScriptExecutionFailed,
            agreement,
            undefined,
            agreement.getProviderInfo(),
            new Error("Foo"),
          ),
        );
      });
    });
  });
});
