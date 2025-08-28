import { PaymentApi } from "ya-ts-client";
import { YagnaApi } from "../shared/utils";
import { Numeric } from "decimal.js-light";
export type InvoiceAcceptResult = {
    invoiceId: string;
    allocation: PaymentApi.AllocationDTO;
    success: true;
    amount: string;
    dryRun: boolean;
} | {
    invoiceId: string;
    allocation: PaymentApi.AllocationDTO;
    success: false;
    amount: string;
    reason: unknown;
    dryRun: boolean;
};
/**
 * A class that provides methods for working with invoices. It interacts with the Yagna API directly.
 */
export declare class InvoiceProcessor {
    private readonly api;
    /**
     * Use `InvoiceProcessor.create()` to create an instance of this class.
     */
    constructor(api: YagnaApi);
    /**
     * Collects invoices from the Yagna API until the limit is reached or there are no more invoices.
     * @param {Object} options - The parameters for collecting invoices.
     * @param options.after Only collect invoices that were created after this date.
     * @param options.limit Maximum number of invoices to collect.
     * @param options.statuses Only collect invoices with these statuses.
     * @param options.providerIds Only collect invoices from these providers.
     * @param options.minAmount Only collect invoices with an amount greater than or equal to this.
     * @param options.maxAmount Only collect invoices with an amount less than or equal to this.
     * @param options.providerWallets Only collect invoices from these provider wallets.
     * @param options.paymentPlatforms Only collect invoices from these payment platforms.
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
    collectInvoices({ after, limit, statuses, providerIds, minAmount, maxAmount, providerWallets, paymentPlatforms, }?: {
        after?: Date;
        limit?: number;
        statuses?: string[];
        providerIds?: string[];
        minAmount?: Numeric;
        maxAmount?: Numeric;
        providerWallets?: string[];
        paymentPlatforms?: string[];
    }): Promise<{
        readonly invoiceId: string;
        readonly issuerId: string;
        readonly recipientId: string;
        readonly payeeAddr: string;
        readonly payerAddr: string;
        readonly paymentPlatform: string;
        readonly timestamp: string;
        agreementId: string;
        activityIds?: string[] | undefined;
        amount: string;
        paymentDueDate: string;
        readonly status: "ISSUED" | "RECEIVED" | "ACCEPTED" | "REJECTED" | "FAILED" | "SETTLED" | "CANCELLED";
    }[]>;
    /**
     * Fetches a single invoice from the Yagna API.
     */
    fetchSingleInvoice(invoiceId: string): Promise<PaymentApi.InvoiceDTO>;
    /**
     * Creates an allocation for the exact amount of the invoice and accepts the invoice.
     * If `dryRun` is `true`, no allocation will be created and the invoice will not be accepted.
     */
    acceptInvoice({ invoice, dryRun, }: {
        invoice: PaymentApi.InvoiceDTO;
        dryRun?: boolean;
    }): Promise<InvoiceAcceptResult>;
    /**
     * Creates an allocation for the exact amount of the invoices and accepts the invoices.
     * Since the invoices can be from different payment platforms and payer addresses,
     * multiple allocations might be created.
     * If `dryRun` is `true`, no allocation will be created and the invoices will not be accepted.
     * Please keep in mind that this method is not atomic, so if one of the invoices fails
     * to be accepted, the others will still be accepted. This is a limitation of the Yagna API.
     * Use the returned `InvoiceAcceptResult` to check which invoices were accepted successfully.
     */
    acceptManyInvoices({ invoices, dryRun, }: {
        invoices: PaymentApi.InvoiceDTO[];
        dryRun?: boolean;
    }): Promise<InvoiceAcceptResult[]>;
}
