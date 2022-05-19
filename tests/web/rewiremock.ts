import rewiremock, { addPlugin } from "rewiremock/webpack";
import * as webpack from "webpack";

// addPlugin(new webpack.NamedModulesPlugin());
addPlugin(new webpack.HotModuleReplacementPlugin());
// eslint-disable-next-line @typescript-eslint/no-var-requires
addPlugin(new (require("rewiremock/webpack/plugin"))());
import { RequestorControlApiMock } from "../mock/requestor_control_api";
import { RequestorSateApiMock } from "../mock/requestor_state_api";
/// settings
rewiremock.overrideEntryPoint(module); // this is important
export { rewiremock };
rewiremock("ya-ts-client/dist/ya-activity/api").with({
  RequestorControlApi: RequestorControlApiMock,
  RequestorStateApi: RequestorSateApiMock,
});
rewiremock.enable();
