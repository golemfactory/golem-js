import { DebitNote } from "./debit_note";
import { imock, instance, mock, reset, when } from "@johanblumenberg/ts-mockito";
import { YagnaApi } from "../shared/utils";
import { MarketApi, PaymentApi } from "ya-ts-client";
import Decimal from "decimal.js-light";
import { ProviderInfo } from "../agreement";

const mockYagna = mock(YagnaApi);
const mockPayment = mock(PaymentApi.RequestorService);
const mockMarket = mock(MarketApi.RequestorService);
const mockDebitNote = imock<PaymentApi.DebitNoteDTO>();
const mockAgreement = imock<MarketApi.AgreementDTO>();

const dto: PaymentApi.DebitNoteDTO = {
  activityId: "activity-id",
  agreementId: "agreement-id",
  debitNoteId: "debit-note-id",
  issuerId: "provider-node-id",
  payeeAddr: "0xRequestorWallet",
  payerAddr: "0xProviderWallet",
  paymentPlatform: "erc20-polygon-glm",
  recipientId: "requestor-node-id",
  status: "RECEIVED",
  timestamp: "2024-01-01T00.00.000Z",
  totalAmountDue: "1",
};

const TEST_PROVIDER_INFO: ProviderInfo = {
  name: "provider-name",
  id: "provider-id",
  walletAddress: "0xProviderWallet",
};

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
    when(mockDebitNote.totalAmountDue).thenReturn("1");

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
      const debitNote = new DebitNote(dto, TEST_PROVIDER_INFO);
      expect(debitNote.id).toEqual(dto.debitNoteId);
    });

    it("should crete debit note with a big number amount", async () => {
      const debitNote = new DebitNote({ ...dto, totalAmountDue: "0.009551938349900001" }, TEST_PROVIDER_INFO);
      expect(new Decimal("0.009551938349900001").eq(new Decimal(debitNote.totalAmountDue))).toEqual(true);
    });
  });
});
