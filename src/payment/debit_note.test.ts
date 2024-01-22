import { DebitNote } from "./debit_note";
import { anything, imock, instance, mock, when } from "@johanblumenberg/ts-mockito";
import { YagnaApi } from "../utils";
import { DebitNote as DebitNoteModel } from "ya-ts-client/dist/ya-payment/src/models";
import { Agreement as AgreementModel } from "ya-ts-client/dist/ya-market/src/models";
import { RequestorApi as PaymentRequestorApi } from "ya-ts-client/dist/ya-payment/api";
import { RequestorApi as MarketRequestorApi } from "ya-ts-client/dist/ya-market/api";

const yagnaApiMock = imock<YagnaApi>();
const paymentApiMock = mock(PaymentRequestorApi);
const marketApiMock = mock(MarketRequestorApi);
when(yagnaApiMock.payment).thenReturn(instance(paymentApiMock));
when(yagnaApiMock.market).thenReturn(instance(marketApiMock));

function creteAxiosResponseMock<T>(data: T) {
  return {
    data,
    status: 200,
    statusText: "ok",
    headers: [],
    config: {},
  };
}
describe("Debit Notes", () => {
  describe("creating", () => {
    it("should crete debit note", async () => {
      when(paymentApiMock.getDebitNote(anything())).thenResolve(
        creteAxiosResponseMock({
          debitNoteId: "testId",
          payeeAddr: "0x12345",
          issuerId: "0x123",
        } as DebitNoteModel),
      );
      when(marketApiMock.getAgreement(anything())).thenResolve(
        creteAxiosResponseMock({
          agreementId: "testId",
          offer: { properties: { ["golem.node.id.name"]: "testProvider" } },
        } as AgreementModel),
      );
      const debitNote = await DebitNote.create("testId", instance(yagnaApiMock));
      expect(debitNote).toBeDefined();
    });
  });
  describe("accepting", () => {
    it("should accept debit note", async () => {});
  });
});
