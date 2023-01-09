import rewiremock from "rewiremock";
import * as activityMock from "../mock/rest/activity";
import { MarketApiMock } from "../mock/rest/market";
import EventSourceMock from "../mock/utils/event_source";
import { PaymentApiMock } from "../mock/rest/payment";
import { NetworkApiMock } from "../mock/rest/network";
rewiremock("ya-ts-client/dist/ya-net/api").with({ RequestorApi: NetworkApiMock });
rewiremock("ya-ts-client/dist/ya-payment/api").with({ RequestorApi: PaymentApiMock });
rewiremock("eventsource").with(EventSourceMock);
rewiremock("ya-ts-client/dist/ya-market/api").with({ RequestorApi: MarketApiMock });
rewiremock("ya-ts-client/dist/ya-activity/api").with({
  RequestorControlApi: activityMock.RequestorControlApiMock,
  RequestorStateApi: activityMock.RequestorSateApiMock,
});
rewiremock.enable();
