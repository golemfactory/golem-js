import { Allocation } from "../../yajsapi/payment/allocation";
import { MarketDecoration } from "ya-ts-client/dist/ya-payment";

export const allocationMock: Allocation = {
  allocationId: "test_id",
  makeDeposit: false,
  remainingAmount: "",
  spentAmount: "",
  timestamp: "",
  totalAmount: "",
  async getDemandDecoration(): Promise<MarketDecoration> {
    return Promise.resolve({
      properties: [
        {
          key: "golem.com.payment.platform.erc20-rinkeby-tglm.address",
          value: "0x19ee20338a4c4bf8f6aebc79d9d3af2a01434119",
        },
      ],
      constraints: ["(golem.com.payment.platform.erc20-rinkeby-tglm.address=*)"],
    });
  },
  async releaseAllocation(): Promise<void> {
    return Promise.resolve(undefined);
  },
};
