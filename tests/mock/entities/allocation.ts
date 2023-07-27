import { Allocation } from "../../../yajsapi/payment/allocation";
import { MarketDecoration } from "ya-ts-client/dist/ya-payment";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const allocationMock: Allocation = {
  timeout: "",
  paymentPlatform: "erc20-goerli-tglm",
  address: "",
  id: "test_id",
  timestamp: "",
  totalAmount: "",
  async getDemandDecoration(): Promise<MarketDecoration> {
    return Promise.resolve({
      properties: [
        {
          key: "golem.com.payment.platform.erc20-goerli-tglm.address",
          value: "0x19ee20338a4c4bf8f6aebc79d9d3af2a01434119",
        },
      ],
      constraints: ["(golem.com.payment.platform.erc20-goerli-tglm.address=*)"],
    });
  },
  async release(): Promise<void> {
    return Promise.resolve(undefined);
  },
};
