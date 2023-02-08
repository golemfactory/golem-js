import rewiremock from "rewiremock";
import { RequestorControlApiMock, RequestorSateApiMock } from "../mock/rest/activity";
import { MarketApiMock } from "../mock/rest/market";
import EventSourceMock from "../mock/utils/event_source";
import { PaymentApiMock } from "../mock/rest/payment";
import { NetworkApiMock } from "../mock/rest/network";
rewiremock("ya-ts-client/dist/ya-net/api").with({ RequestorApi: NetworkApiMock });
rewiremock("ya-ts-client/dist/ya-payment/api").with({ RequestorApi: PaymentApiMock });
rewiremock("ya-ts-client/dist/ya-market/api").with({ RequestorApi: MarketApiMock });
rewiremock("ya-ts-client/dist/ya-activity/api").with({
  RequestorControlApi: RequestorControlApiMock,
  RequestorStateApi: RequestorSateApiMock,
});
rewiremock("eventsource").with(EventSourceMock);
process.env["YAGNA_APPKEY"] = "test_key";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiUuid from "chai-uuid";
chai.use(chaiAsPromised);
chai.use(chaiUuid);
rewiremock.overrideEntryPoint(module);
rewiremock.enable();
