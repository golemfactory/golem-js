import { Allocation } from "../../../yajsapi/payment/allocation.js";
import { PaymentService } from "../../../yajsapi/payment/index.js";
import { allocationMock } from "../../mock/index.js";
import { Agreement } from "../../../yajsapi/agreement/index.js";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const paymentServiceMock: PaymentService = {
  async createAllocations(
    budget?,
    payment?: { driver: string; network: string },
    timeout?: number
  ): Promise<Allocation[]> {
    return Promise.resolve([allocationMock]);
  },
  acceptPayments(agreement: Agreement) {
    return true;
  },
  acceptDebitNotes(agreementId: string) {
    return true;
  },
};
