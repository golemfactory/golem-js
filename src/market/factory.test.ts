import { DemandFactory } from "./factory";
import { anything, capture, imock, instance, mock, when } from "@johanblumenberg/ts-mockito";
import { Package } from "../package";
import { Allocation } from "../payment";
import { YagnaApi } from "../utils";
import { RequestorApi as MarketRequestorApi } from "ya-ts-client/dist/ya-market/src/api/requestor-api";

describe("Demand Factory", () => {
  describe("mid-agreement payments support", () => {
    describe("default behaviour", () => {
      test("it configures mid-agreement payments by default", async () => {
        // Given
        const pkg = mock(Package);
        const allocation = mock(Allocation);

        const market = mock(MarketRequestorApi);
        const api = imock<YagnaApi>();

        // When
        when(api.market).thenReturn(instance(market));

        when(pkg.getDemandDecoration()).thenResolve({
          properties: [],
          constraints: [],
        });

        when(allocation.getDemandDecoration()).thenResolve({
          properties: [],
          constraints: [],
        });

        when(market.subscribeDemand(anything())).thenResolve({
          config: {},
          headers: {},
          status: 200,
          statusText: "OK",
          data: "subscription-id",
        });

        const factory = new DemandFactory(instance(pkg), instance(allocation), instance(api));
        const demand = await factory.create();

        // Then
        const [demandRequestBody] = capture(market.subscribeDemand).last();

        // The properties responsible for mid-agreements payments are set
        expect(demandRequestBody.properties["golem.com.payment.debit-notes.accept-timeout?"]).toBeDefined();
        expect(demandRequestBody.properties["golem.com.scheme.payu.payment-timeout-sec?"]).toBeDefined();
        expect(demandRequestBody.properties["golem.srv.comp.expiration"]).toBeDefined();

        expect(demand).toBeDefined();
      });
    });
  });
});
