import { Allocation } from "../../yajsapi/payment/allocation";
import { MarketDecoration, RequestorApi, Allocation as Model } from "ya-ts-client/dist/ya-payment";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const allocationMock: Allocation = {
  timeout: "",
  paymentPlatform: "erc20-rinkeby-tglm",
  address: "",
  allocationId: "test_id",
  makeDeposit: false,
  remainingAmount: "",
  spentAmount: "",
  timestamp: "",
  totalAmount: "",
  model: {} as Model,
  api: {} as RequestorApi,
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
  // async create(): Promise<Allocation> {
  //   return {} as Allocation;
  // },
};
