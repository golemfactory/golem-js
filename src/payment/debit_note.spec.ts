import { DebitNote } from "./debit_note";
import { anything, imock, instance, mock, objectContaining, reset, verify, when } from "@johanblumenberg/ts-mockito";
import { YagnaApi } from "../utils";
import { MarketApi, PaymentApi } from "ya-ts-client";
import { GolemPaymentError, PaymentErrorCode } from "./error";

const mockYagna = mock(YagnaApi);
const mockPayment = mock(PaymentApi.RequestorService);
const mockMarket = mock(MarketApi.RequestorService);
const mockDebitNote = imock<PaymentApi.DebitNoteDTO>();
const mockAgreement = imock<MarketApi.AgreementDTO>();

describe("Debit Notes", () => {
  beforeEach(() => {
    reset(mockYagna);
    reset(mockPayment);
    reset(mockMarket);
    reset(mockDebitNote);

    when(mockYagna.payment).thenReturn(instance(mockPayment));
    when(mockYagna.market).thenReturn(instance(mockMarket));

    when(mockDebitNote.debitNoteId).thenReturn("testId");
    when(mockDebitNote.payeeAddr).thenReturn("0x12345");
    when(mockDebitNote.issuerId).thenReturn("0x123");
    when(mockDebitNote.agreementId).thenReturn("agreementId");

    when(mockAgreement.agreementId).thenReturn("agreementId");
    when(mockAgreement.offer).thenReturn({
      offerId: "offerId",
      providerId: "providerId",
      timestamp: new Date().toISOString(),
      properties: { ["golem.node.id.name"]: "testProvider" },
      constraints: "",
    });

    when(mockPayment.getDebitNote("testId")).thenResolve(instance(mockDebitNote));

    when(mockMarket.getAgreement("agreementId")).thenResolve(instance(mockAgreement));
  });

  describe("creating", () => {
    it("should crete debit note", async () => {
      const debitNote = await DebitNote.create("testId", instance(mockYagna));
      expect(debitNote).toBeDefined();
    });
  });

  describe("accepting", () => {
    it("should accept debit note", async () => {
      const debitNote = await DebitNote.create("testId", instance(mockYagna));
      await debitNote.accept(1, "testId");
      verify(mockPayment.acceptDebitNote("testId", objectContaining({ totalAmountAccepted: "1" }))).once();
    });

    it("should throw GolemPaymentError if debit note cannot be accepted", async () => {
      const errorYagnaApiMock = new Error("test error");
      when(mockPayment.acceptDebitNote("testId", anything())).thenReject(errorYagnaApiMock);

      const debitNote = await DebitNote.create("testId", instance(mockYagna));

      await expect(debitNote.accept(1, "testId")).rejects.toMatchError(
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
