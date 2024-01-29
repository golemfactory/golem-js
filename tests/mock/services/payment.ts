import { Allocation } from "../../../src/payment";
import { PaymentService } from "../../../src";
import { allocationMock } from "../../mock";
import { Agreement } from "../../../src/agreement";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const paymentServiceMock: PaymentService = {
  async createAllocation(
    budget?,
    payment?: { driver: string; network: string },
    timeout?: number,
  ): Promise<Allocation> {
    return Promise.resolve(allocationMock);
  },
  acceptPayments(agreement: Agreement) {
    return true;
  },
};
