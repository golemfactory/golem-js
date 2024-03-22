import { DebitNote } from "./debit_note";
import { anything, imock, instance, mock, verify, when } from "@johanblumenberg/ts-mockito";
import { YagnaApi } from "../utils";
import { DebitNote as DebitNoteModel } from "ya-ts-client/dist/ya-payment/src/models";
import { Agreement as AgreementModel } from "ya-ts-client/dist/ya-market/src/models";
import { RequestorApi as PaymentRequestorApi } from "ya-ts-client/dist/ya-payment/api";
import { RequestorApi as MarketRequestorApi } from "ya-ts-client/dist/ya-market/api";
import { GolemPaymentError, PaymentErrorCode } from "./error";
import { Decimal } from "decimal.js-light";

const yagnaApiMock = imock<YagnaApi>();
const paymentApiMock = mock(PaymentRequestorApi);
const marketApiMock = mock(MarketRequestorApi);
when(yagnaApiMock.payment).thenReturn(instance(paymentApiMock));
when(yagnaApiMock.market).thenReturn(instance(marketApiMock));

function creteAxiosResponseMock<T>(data: T, status = 200) {
  return {
    data,
    status,
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
    it("should crete debit note with a big number amount", async () => {
      when(paymentApiMock.getDebitNote(anything())).thenResolve(
        creteAxiosResponseMock({
          debitNoteId: "testId",
          payeeAddr: "0x12345",
          issuerId: "0x123",
          totalAmountDue: "0.009551938349900001",
        } as DebitNoteModel),
      );
      when(marketApiMock.getAgreement(anything())).thenResolve(
        creteAxiosResponseMock({
          agreementId: "testId",
          offer: { properties: { ["golem.node.id.name"]: "testProvider" } },
        } as AgreementModel),
      );
      const debitNote = await DebitNote.create("testId", instance(yagnaApiMock));
      expect(new Decimal("0.009551938349900001").eq(new Decimal(debitNote.totalAmountDuePrecise))).toEqual(true);
    });
  });
  describe("accepting", () => {
    it("should accept debit note", async () => {
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
      await debitNote.accept("1", "testId");
      verify(paymentApiMock.acceptDebitNote("testId", anything())).called();
    });
    it("should throw GolemPaymentError if debit note cannot be accepted", async () => {
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
      const errorYagnaApiMock = new Error("test error");
      when(paymentApiMock.acceptDebitNote("testId", anything())).thenReject(errorYagnaApiMock);
      const debitNote = await DebitNote.create("testId", instance(yagnaApiMock));
      await expect(debitNote.accept("1", "testId")).rejects.toMatchError(
        new GolemPaymentError(
          `Unable to accept debit note testId. ${errorYagnaApiMock}`,
          PaymentErrorCode.DebitNoteAcceptanceFailed,
          undefined,
          {
            id: "0x123",
            name: "testProvider",
            walletAddress: "0x12345",
          },
          errorYagnaApiMock,
        ),
      );
    });
  });
});
