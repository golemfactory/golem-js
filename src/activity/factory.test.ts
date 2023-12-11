import { ActivityFactory } from "./factory";
import { Agreement } from "../agreement";
import { anything, imock, instance, mock, when } from "@johanblumenberg/ts-mockito";
import { YagnaApi } from "../utils";
import { RequestorControlApi } from "ya-ts-client/dist/ya-activity/api";
import { RequestorStateApi } from "ya-ts-client/dist/ya-activity/src/api/requestor-state-api";

describe("Activity Factory", () => {
  describe("Creating activities", () => {
    describe("Negative cases", () => {
      it("Correctly passes the exception thrown during activity creation to the user", async () => {
        const agreement = mock(Agreement);
        const yagnaAPi = imock<YagnaApi>();

        const controlApi = mock(RequestorControlApi);
        const stateApi = mock(RequestorStateApi);

        const components = {
          control: instance(controlApi),
          state: instance(stateApi),
        };

        when(yagnaAPi.activity).thenReturn(components);

        when(controlApi.createActivity(anything())).thenReject("Foo");

        const factory = new ActivityFactory(instance(agreement), instance(yagnaAPi));

        await expect(() => factory.create()).rejects.toThrow("Foo");
      });
    });
  });
});
