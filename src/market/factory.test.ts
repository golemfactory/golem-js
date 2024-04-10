import { DemandFactory } from "./factory";
import { anything, capture, instance, mock, reset, when } from "@johanblumenberg/ts-mockito";
import { Package } from "../package";
import { Allocation } from "../payment";
import { YagnaApi } from "../utils";
import { MarketApi } from "ya-ts-client";

const mockPackage = mock(Package);
const mockAllocation = mock(Allocation);

const mockMarket = mock(MarketApi.RequestorService);
const mockYagna = mock(YagnaApi);

describe("Demand Factory", () => {
  beforeEach(() => {
    reset(mockYagna);
    reset(mockMarket);
    reset(mockPackage);
    reset(mockAllocation);

    when(mockYagna.market).thenReturn(instance(mockMarket));

    when(mockPackage.getDemandDecoration()).thenResolve({
      properties: [],
      constraints: [],
    });

    when(mockAllocation.getDemandDecoration()).thenResolve({
      properties: [],
      constraints: [],
    });

    when(mockMarket.subscribeDemand(anything())).thenResolve("subscription-id");
  });
  describe("mid-agreement payments support", () => {
    describe("default behaviour", () => {
      it("it configures mid-agreement payments by default", async () => {
        // Given
        // When

        const factory = new DemandFactory(instance(mockPackage), instance(mockAllocation), instance(mockYagna));
        const demand = await factory.create();

        // Then
        const [demandRequestBody] = capture(mockMarket.subscribeDemand).last();

        // The properties responsible for mid-agreements payments are set
        expect(demandRequestBody.properties["golem.com.payment.debit-notes.accept-timeout?"]).toBeDefined();
        expect(demandRequestBody.properties["golem.com.scheme.payu.debit-note.interval-sec?"]).toBeDefined();
        expect(demandRequestBody.properties["golem.com.scheme.payu.payment-timeout-sec?"]).toBeDefined();
        expect(demandRequestBody.properties["golem.srv.comp.expiration"]).toBeDefined();

        expect(demand).toBeDefined();
      });
    });
  });
});
