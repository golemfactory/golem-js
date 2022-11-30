import {
  RequestorApi,
  Configuration,
  Allocation as AllocationModel,
  MarketDecoration,
} from "ya-ts-client/dist/ya-payment";
import { Logger, dayjs } from "../utils";
import { Allocation } from "./allocation";
import { EventBus } from "../events/event_bus";
import { MarketOptions } from "../market/service";
import { DEFAULT_INVOICE_RECEIVE_TIMEOUT } from "../executor/defaults";

export class PaymentService {
  private readonly api: RequestorApi;

  constructor(
    private readonly yagnaOptions: { apiKey?: string; basePath?: string },
    private readonly eventBus: EventBus,
    private readonly logger?: Logger
  ) {
    const apiConfig = new Configuration({
      apiKey: yagnaOptions.apiKey,
      basePath: yagnaOptions.basePath + "/payment-api/v1",
      accessToken: yagnaOptions.apiKey,
    });
    this.api = new RequestorApi(apiConfig);
  }
  async run() {
    this.logger?.debug("Payment Service has started");
  }

  async getDemandDecoration({ budget, payment, timeout, subnetTag }: MarketOptions): Promise<MarketDecoration> {
    const { data: existingAllocations } = await this.api.getAllocations().catch(() => ({ data: [] }));
    // TODO: how to filter existing allocations? by budget?
    const availableAllocations = existingAllocations.filter((a) => parseFloat(a.remainingAmount) >= (budget || 1));
    const allocations = availableAllocations.length
      ? availableAllocations
      : await this.createAllocations({ budget, payment, timeout, subnetTag });
    const allocationIds = allocations.map((a) => a.allocationId);
    // TODO: bug rest api with joining ids
    const { data: decorations } = await this.api.getDemandDecorations(allocationIds.slice(0, 1)).catch((e) => {
      throw new Error(`Could not get demand decorations. ${e.response?.data || e}`);
    });
    return decorations;
  }

  async getAllocatedPaymentPlatform(): Promise<string[]> {
    const { data: allocations } = await this.api.getAllocations();
    const paymentPlatforms: string[] = [];
    allocations.forEach((a) => {
      if (a.paymentPlatform) paymentPlatforms.push(a.paymentPlatform);
    });
    return paymentPlatforms;
  }

  // TODO
  async end() {
    const { data: models } = await this.api.getAllocations();
    const allocations = models.map((model) => new Allocation(this.api, model));
    for (const allocation of allocations) await allocation.releaseAllocation();
    this.logger?.debug("All allocations has benn released");
    this.logger?.debug("Payment service has been stopped");
  }

  async createAllocations(
    budget?,
    payment?: { driver: string; network: string },
    timeout?: number
  ): Promise<Allocation[]> {
    // TODO: defaults
    if (!budget) budget = 1;
    if (!payment) payment = { driver: "erc-20", network: "rinkeby" };
    if (!timeout) timeout = 30000;
    const { data: accounts } = await this.api.getRequestorAccounts().catch((e) => {
      throw new Error("Requestor accounts cannot be retrieved. " + e.response?.data?.message || e.response?.data || e);
    });
    const allocations: Allocation[] = [];
    for (const account of accounts) {
      if (account.driver !== payment.driver.toLowerCase() || account.network !== payment.network.toLowerCase()) {
        this.logger?.debug(
          `Not using payment platform ${account.platform}, platform's driver/network ` +
            `${account.driver}/${account.network} is different than requested ` +
            `driver/network ${payment.driver}/${payment.network}`
        );
        continue;
      }
      this.logger?.debug(`Creating allocation using payment platform ${account.platform}`);
      const expires = timeout
        ? dayjs().add(timeout + DEFAULT_INVOICE_RECEIVE_TIMEOUT, "ms")
        : dayjs().add(30, "minute");
      const model: AllocationModel = {
        totalAmount: budget.toString(),
        paymentPlatform: account.platform,
        address: account.address,
        makeDeposit: false,
        remainingAmount: "",
        spentAmount: "",
        timestamp: dayjs().utc().toISOString(),
        timeout: expires.utc().toISOString(),
        allocationId: "",
      };
      const { data: newModel } = await this.api.createAllocation(model).catch((error) => {
        throw new Error(
          `Could not create new allocation. ${error.response?.data?.message || error.response?.data || error}`
        );
      });
      allocations.push(new Allocation(this.api, newModel));
      this.logger?.debug(
        `Allocation ${newModel.allocationId} has been created using payment platform ${account.platform}`
      );
    }
    return allocations;
  }

  acceptPayments(id: string) {
    // todo
  }
}
