import { PaymentApi } from "ya-ts-client";

export const invoiceEvents: PaymentApi.InvoiceReceivedEventDTO[] = [
  {
    invoiceId: "f2f5a229-8324-4211-973a-346e45b3d3e2",
    eventDate: "2022-12-05T08:54:31.930Z",
    eventType: "InvoiceReceivedEvent",
  },
];

export const invoices: PaymentApi.InvoiceDTO[] = [
  {
    invoiceId: "f2f5a229-8324-4211-973a-346e45b3d3e2",
    issuerId: "0xd9a4a6ba9e1800e4f61cd88dc23f082527f4ee28",
    recipientId: "0x19ee20338a4c4bf8f6aebc79d9d3af2a01434119",
    payeeAddr: "0xd9a4a6ba9e1800e4f61cd88dc23f082527f4ee28",
    payerAddr: "0x19ee20338a4c4bf8f6aebc79d9d3af2a01434119",
    paymentPlatform: "erc20-holesky-tglm",
    timestamp: "2022-12-05T08:54:31.927Z",
    agreementId: "test_agreement_id",
    activityIds: ["00f36a80a8544260acbf4b09dc46f4fc"],
    amount: "0.000869307866200000",
    paymentDueDate: "2022-12-06T08:54:31.941822231Z",
    status: "RECEIVED",
  },
];
