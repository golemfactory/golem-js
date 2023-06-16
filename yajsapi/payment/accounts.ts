import { Account } from "ya-ts-client/dist/ya-payment/src/models";
import { AccountConfig, BasePaymentOptions } from "./config.js";

/**
 * @category Mid-level
 */
export type AccountsOptions = BasePaymentOptions

/**
 * Accounts module - an object that provides information about the requestor's accounts.
 * @category Mid-level
 */
export class Accounts {
  static async create(options?: AccountsOptions): Promise<Accounts> {
    return new Accounts(new AccountConfig(options));
  }
  private constructor(private options: AccountConfig) {}
  async list(): Promise<Account[]> {
    const { data: accounts } = await this.options.api.getRequestorAccounts();
    return accounts;
  }
}
