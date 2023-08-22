/* eslint @typescript-eslint/ban-ts-comment: 0 */
import { Yagna, YagnaApi } from "../../../src/utils";
import { RequestorControlApiMock, RequestorSateApiMock } from "./activity";
import { MarketApiMock } from "./market";
import { EventSourceMock } from "../utils/event_source";
import { PaymentApiMock } from "./payment";
import { NetworkApiMock } from "./network";
import { IdentityApiMock } from "./identity";
import { GsbApiMock } from "./gsb";

jest.mock("eventsource", () => EventSourceMock);

process.env["YAGNA_APPKEY"] = "test_key";
export class YagnaMock extends Yagna {
  protected createApi(): YagnaApi {
    return {
      // @ts-ignore
      market: new MarketApiMock(),
      activity: {
        // @ts-ignore
        control: new RequestorControlApiMock(),
        // @ts-ignore
        state: new RequestorSateApiMock(),
      },
      // @ts-ignore
      net: new NetworkApiMock(),

      // @ts-ignore
      payment: new PaymentApiMock(),
      identity: new IdentityApiMock(),
      gsb: new GsbApiMock(),
      yagnaOptions: {
        apiKey: this.apiKey,
        basePath: this.apiBaseUrl,
      },
    };
  }
}
