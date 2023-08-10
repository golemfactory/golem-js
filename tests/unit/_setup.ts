import { RequestorControlApiMock, RequestorSateApiMock } from "../mock/rest/activity";
import { MarketApiMock } from "../mock/rest/market";
import { EventSourceMock } from "../mock/utils/event_source";
import { PaymentApiMock } from "../mock/rest/payment";
import { NetworkApiMock } from "../mock/rest/network";
import { IdentityMock } from "../mock/rest/identity";

jest.mock("ya-ts-client/dist/ya-payment/api", () => ({
  RequestorApi: PaymentApiMock,
}));
jest.mock("ya-ts-client/dist/ya-net/api", () => ({
  RequestorApi: NetworkApiMock,
}));
jest.mock("ya-ts-client/dist/ya-market/api", () => ({
  RequestorApi: MarketApiMock,
}));
jest.mock("ya-ts-client/dist/ya-activity/api", () => ({
  RequestorControlApi: RequestorControlApiMock,
  RequestorStateApi: RequestorSateApiMock,
}));
jest.mock("../../src/network/identity", () => IdentityMock);

jest.mock("eventsource", () => EventSourceMock);

process.env["YAGNA_APPKEY"] = "test_key";
