import { Allocation, Invoice } from "ya-ts-client/dist/ya-payment";
import { Yagna } from "../utils";
import { YagnaApi, YagnaOptions } from "../utils/yagna/yagna";
import { Decimal, Numeric } from "decimal.js-light";

export type InvoiceAcceptResult =
  | {
      invoiceId: string;
      allocation: Allocation;
      success: true;
      amount: string;
      dryRun: boolean;
    }
  | {
      invoiceId: string;
      allocation: Allocation;
      success: false;
      amount: string;
      reason: unknown;
      dryRun: boolean;
    };

/**
 * A class that provides methods for working with invoices. It interacts with the Yagna API directly.
 */
export class InvoiceProcessor {
  /**
   * Use `InvoiceProcessor.create()` to create an instance of this class.
   */
  private constructor(private readonly api: YagnaApi) {}

  /**
   * Creates an instance of `InvoiceProcessor` and connects to the Yagna API.
   * @param options Options for the Yagna API.
   */
  public static async create(options?: YagnaOptions): Promise<InvoiceProcessor> {
    const yagna = new Yagna(options);
    await yagna.connect();
    const api = yagna.getApi();
    return new InvoiceProcessor(api);
  }

  /**
   * Collects invoices from the Yagna API until the limit is reached or there are no more invoices.
   * @param after Only collect invoices that were created after this date.
   * @param limit Maximum number of invoices to collect.
   * @param statuses Only collect invoices with these statuses.
   * @param providerIds Only collect invoices from these providers.
   * @param minAmount Only collect invoices with an amount greater than or equal to this.
   * @param maxAmount Only collect invoices with an amount less than or equal to this.
   * @param providerWallets Only collect invoices from these provider wallets.
   * @param paymentPlatforms Only collect invoices from these payment platforms.
   *
   * @example
   * ```typescript
   * const invoices = await invoiceProcessor.collectInvoices({
   *  after: new Date(Date.now() - 24 * 60 * 60 * 1000), // only collect invoices that were created in the last 24 hours
   *  limit: 100, // only collect 100 invoices max
   *  statuses: ["RECEIVED"], // only collect unpaid invoices
   *  providerIds: ["0x1234"], // only collect invoices from this provider
   *  minAmount: "0.1", // only collect invoices with an amount greater than or equal to 0.1 GLM
   *  maxAmount: "1", // only collect invoices with an amount less than or equal to 1 GLM
   *  providerWallets: ["0x1234"], // only collect invoices from this provider wallet
   *  paymentPlatforms: ["erc20-polygon-glm"], // only collect invoices from this payment platform
   * });
   * ```
   */
  async collectInvoices({
    after = new Date(0),
    limit = 50,
    statuses,
    providerIds,
    minAmount,
    maxAmount,
    providerWallets,
    paymentPlatforms,
  }: {
    after?: Date;
    limit?: number;
    statuses?: string[];
    providerIds?: string[];
    minAmount?: Numeric;
    maxAmount?: Numeric;
    providerWallets?: string[];
    paymentPlatforms?: string[];
  } = {}) {
    // yagna api doesn't sort invoices by timestamp, so we have to fetch all invoices and sort them ourselves
    // this is not very efficient, but it's the only way to get invoices sorted by timestamp
    // otherwise yagna returns the invoices in seemingly random order
    // FIXME: move to batched requests once yagna api supports it
    const invoices = await this.api.payment.getInvoices(after?.toISOString()).then((response) => response.data);
    const filteredInvoices = invoices.filter((invoice) => {
      if (statuses && !statuses.includes(invoice.status)) {
        return false;
      }
      if (providerIds && !providerIds.includes(invoice.issuerId)) {
        return false;
      }
      if (minAmount !== undefined && new Decimal(invoice.amount).lt(minAmount)) {
        return false;
      }
      if (maxAmount !== undefined && new Decimal(invoice.amount).gt(maxAmount)) {
        return false;
      }
      if (providerWallets && !providerWallets.includes(invoice.payeeAddr)) {
        return false;
      }
      if (paymentPlatforms && !paymentPlatforms.includes(invoice.paymentPlatform)) {
        return false;
      }
      return true;
    });
    filteredInvoices.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return filteredInvoices.slice(0, limit);
  }

  /**
   * Fetches a single invoice from the Yagna API.
   */
  async fetchSingleInvoice(invoiceId: string): Promise<Invoice> {
    return this.api.payment.getInvoice(invoiceId).then((res) => res.data);
  }

  /**
   * Creates an allocation for the exact amount of the invoice and accepts the invoice.
   * If `dryRun` is `true`, no allocation will be created and the invoice will not be accepted.
   */
  async acceptInvoice({
    invoice,
    dryRun = false,
  }: {
    invoice: Invoice;
    dryRun?: boolean;
  }): Promise<InvoiceAcceptResult> {
    let allocation: Allocation = {
      totalAmount: invoice.amount,
      paymentPlatform: invoice.paymentPlatform,
      address: invoice.payerAddr,
      timestamp: new Date().toISOString(),
      timeout: new Date(Date.now() + 60_000).toISOString(),
      makeDeposit: false,
      remainingAmount: "",
      spentAmount: "",
      allocationId: "",
    };

    if (dryRun) {
      return {
        allocation,
        amount: invoice.amount,
        invoiceId: invoice.invoiceId,
        success: true,
        dryRun,
      };
    }

    try {
      allocation = await this.api.payment.createAllocation(allocation).then((res) => res.data);

      await this.api.payment.acceptInvoice(invoice.invoiceId, {
        allocationId: allocation.allocationId,
        totalAmountAccepted: invoice.amount,
      });

      return {
        success: true,
        allocation,
        amount: invoice.amount,
        invoiceId: invoice.invoiceId,
        dryRun,
      };
    } catch (e) {
      return {
        success: false,
        allocation,
        amount: invoice.amount,
        invoiceId: invoice.invoiceId,
        reason: e,
        dryRun,
      };
    }
  }

  /**
   * Creates an allocation for the exact amount of the invoices and accepts the invoices.
   * Since the invoices can be from different payment platforms and payer addresses,
   * multiple allocations might be created.
   * If `dryRun` is `true`, no allocation will be created and the invoices will not be accepted.
   * Please keep in mind that this method is not atomic, so if one of the invoices fails
   * to be accepted, the others will still be accepted. This is a limitation of the Yagna API.
   * Use the returned `InvoiceAcceptResult` to check which invoices were accepted successfully.
   */
  async acceptManyInvoices({
    invoices,
    dryRun = false,
  }: {
    invoices: Invoice[];
    dryRun?: boolean;
  }): Promise<InvoiceAcceptResult[]> {
    /**
     * Allocations are created per payment platform and payer address.
     * So it's necessary to group invoices by payment platform and payer address
     * and create an allocation for each group.
     */
    const groupByPaymentPlatform = (invoiceDetails: Invoice[]) => {
      return invoiceDetails.reduce(
        (acc, curr) => {
          acc[curr.paymentPlatform] = acc[curr.paymentPlatform] || [];
          acc[curr.paymentPlatform].push(curr);
          return acc;
        },
        {} as Record<string, Invoice[]>,
      );
    };
    const groupByPayerAddress = (invoiceDetails: Invoice[]) => {
      return invoiceDetails.reduce(
        (acc, curr) => {
          acc[curr.payerAddr] = acc[curr.payerAddr] || [];
          acc[curr.payerAddr].push(curr);
          return acc;
        },
        {} as Record<string, Invoice[]>,
      );
    };

    const results: InvoiceAcceptResult[] = [];

    const groupedByPaymentPlatform = groupByPaymentPlatform(invoices);
    for (const [paymentPlatform, invoices] of Object.entries(groupedByPaymentPlatform)) {
      const groupedByPayerAddress = groupByPayerAddress(invoices);
      for (const [payerAddress, invoices] of Object.entries(groupedByPayerAddress)) {
        const sum = invoices.reduce((acc, curr) => acc.plus(curr.amount), new Decimal(0));
        let allocation: Allocation = {
          totalAmount: sum.toFixed(18),
          paymentPlatform,
          address: payerAddress,
          timestamp: new Date().toISOString(),
          timeout: new Date(Date.now() + 60_000).toISOString(),
          makeDeposit: false,
          remainingAmount: "",
          spentAmount: "",
          allocationId: "",
        };
        if (!dryRun) {
          allocation = await this.api.payment.createAllocation(allocation).then((res) => res.data);
        }
        for (const invoice of invoices) {
          if (dryRun) {
            results.push({
              invoiceId: invoice.invoiceId,
              allocation,
              success: true,
              amount: invoice.amount,
              dryRun,
            });
            continue;
          }

          try {
            await this.api.payment.acceptInvoice(invoice.invoiceId, {
              allocationId: allocation.allocationId,
              totalAmountAccepted: invoice.amount,
            });
            results.push({
              invoiceId: invoice.invoiceId,
              allocation,
              success: true,
              amount: invoice.amount,
              dryRun,
            });
          } catch (e) {
            results.push({
              invoiceId: invoice.invoiceId,
              allocation,
              success: false,
              amount: invoice.amount,
              reason: e,
              dryRun,
            });
          }
        }
      }
    }
    return results;
  }
}
