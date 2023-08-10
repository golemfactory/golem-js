import { Allocation } from "../../../yajsapi/payment/allocation";
import { PaymentService } from "../../../yajsapi/payment";
import { allocationMock } from "../../mock";
import { Agreement } from "../../../yajsapi/agreement";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const paymentServiceMock: PaymentService = {
  async createAllocations(
    budget?,
    payment?: { driver: string; network: string },
    timeout?: number,
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
