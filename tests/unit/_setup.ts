import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiUuid from "chai-uuid";
import quibble from "quibble";
import { RequestorControlApiMock, RequestorSateApiMock } from "../mock/rest/activity";
import { MarketApiMock } from "../mock/rest/market";
import EventSourceMock from "../mock/utils/event_source";
import { PaymentApiMock } from "../mock/rest/payment";
import { NetworkApiMock } from "../mock/rest/network";
await quibble.esm("ya-ts-client/dist/ya-payment/api.js", { RequestorApi: PaymentApiMock });
await quibble.esm("ya-ts-client/dist/ya-net/api.js", { RequestorApi: NetworkApiMock });
await quibble.esm("ya-ts-client/dist/ya-market/api.js", { RequestorApi: MarketApiMock });
await quibble.esm("ya-ts-client/dist/ya-activity/api.js", {
  RequestorControlApi: RequestorControlApiMock,
  RequestorStateApi: RequestorSateApiMock,
});
await quibble.esm("eventsource", null, EventSourceMock);

process.env["YAGNA_APPKEY"] = "test_key";
chai.use(chaiAsPromised);
chai.use(chaiUuid);
