import { Logger } from "../utils";
import { Allocation, AllocationOptions } from "./allocation";
import { PaymentConfig } from "./config";

export type PaymentOptions = AllocationOptions;

export class PaymentService {
  private isRunning = false;
  private options: PaymentConfig;
  private logger?: Logger;
  private allocations: Allocation[] = [];

  constructor(options?: PaymentOptions) {
    this.options = new PaymentConfig(options);
    this.logger = this.options.logger;
  }
  async run() {
    this.logger?.debug("Payment Service has started");
  }

  async end() {
    for (const allocation of this.allocations) {
      await allocation.release();
    }
    this.logger?.debug("All allocations has benn released");
    this.logger?.debug("Payment service has been stopped");
  }

  async createAllocations(): Promise<Allocation[]> {
    const { data: accounts } = await this.options.api.getRequestorAccounts().catch((e) => {
      throw new Error("Requestor accounts cannot be retrieved. " + e.response?.data?.message || e.response?.data || e);
    });
    for (const account of accounts) {
      if (
        account.driver !== this.options.payment.driver.toLowerCase() ||
        account.network !== this.options.payment.network.toLowerCase()
      ) {
        this.logger?.debug(
          `Not using payment platform ${account.platform}, platform's driver/network ` +
            `${account.driver}/${account.network} is different than requested ` +
            `driver/network ${this.options.payment.driver}/${this.options.payment.network}`
        );
        continue;
      }
      this.logger?.debug(`Creating allocation using payment platform ${account.platform}`);
      this.allocations.push(await Allocation.create({ ...this.options.options, account }));
    }
    return this.allocations;
  }

  acceptPayments(agreementId: string) {
    // todo
  }
}
