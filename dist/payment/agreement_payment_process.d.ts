import { Agreement } from "../market";
import { Invoice } from "./invoice";
import { DebitNote } from "./debit_note";
import { Allocation } from "./allocation";
import { Logger } from "../shared/utils";
import { Demand } from "../market";
import { PaymentModule } from "./payment.module";
export type DebitNoteFilter = (debitNote: DebitNote, context: {
    agreement: Agreement;
    allocation: Allocation;
    demand: Demand;
}) => Promise<boolean> | boolean;
export type InvoiceFilter = (invoice: Invoice, context: {
    agreement: Agreement;
    allocation: Allocation;
    demand: Demand;
}) => Promise<boolean> | boolean;
export interface PaymentProcessOptions {
    invoiceFilter: InvoiceFilter;
    debitNoteFilter: DebitNoteFilter;
}
/**
 * Process manager that controls the logic behind processing payments for an agreement (debit notes and invoices).
 * The process is started automatically and ends when the final invoice is received.
 * You can stop the process earlier by calling the `stop` method. You cannot restart the process after stopping it.
 */
export declare class AgreementPaymentProcess {
    readonly agreement: Agreement;
    readonly allocation: Allocation;
    readonly paymentModule: PaymentModule;
    private invoice;
    private debitNotes;
    /**
     * Lock used to synchronize callers and enforce important business rules
     *
     * Example of a rule: you shouldn't accept a debit note if an invoice is already in place
     */
    private lock;
    private options;
    readonly logger: Logger;
    private readonly cleanupSubscriptions;
    constructor(agreement: Agreement, allocation: Allocation, paymentModule: PaymentModule, options?: Partial<PaymentProcessOptions>, logger?: Logger);
    /**
     * Adds the debit note to the process avoiding race conditions
     */
    addDebitNote(debitNote: DebitNote): Promise<boolean>;
    /**
     * Adds the invoice to the process avoiding race conditions
     */
    addInvoice(invoice: Invoice): Promise<boolean>;
    /**
     * Tells if the process reached a point in which we can consider it as "finished"
     */
    isFinished(): boolean;
    private applyDebitNote;
    private hasProcessedDebitNote;
    private rejectDebitNote;
    private finalize;
    private applyInvoice;
    private rejectInvoice;
    private hasReceivedInvoice;
    isStarted(): boolean;
    stop(): void;
}
