import { EventEmitter } from "eventemitter3";
import { Allocation, CreateAllocationParams, DebitNote, Invoice, InvoiceProcessor, PaymentEvents } from "./index";
import { Observable } from "rxjs";
import { GolemServices } from "../golem-network";
import { PayerDetails } from "./PayerDetails";
import { AgreementPaymentProcess, PaymentProcessOptions } from "./agreement_payment_process";
import { Agreement } from "../market";
export interface PaymentModuleOptions {
    /**
     * Network used to facilitate the payment.
     * (for example: "mainnet", "holesky")
     * @default holesky
     */
    network?: string;
    /**
     * Payment driver used to facilitate the payment.
     * (for example: "erc20")
     * @default erc20
     */
    driver?: "erc20" | (string & {});
    /**
     * Token used to facilitate the payment.
     * If unset, it will be inferred from the network.
     * (for example: "glm", "tglm")
     */
    token?: "glm" | "tglm" | (string & {});
}
export interface PaymentModule {
    events: EventEmitter<PaymentEvents>;
    observeDebitNotes(): Observable<DebitNote>;
    observeInvoices(): Observable<Invoice>;
    createAllocation(params: CreateAllocationParams): Promise<Allocation>;
    releaseAllocation(allocation: Allocation): Promise<void>;
    amendAllocation(allocation: Allocation, params: CreateAllocationParams): Promise<Allocation>;
    getAllocation(id: string): Promise<Allocation>;
    acceptInvoice(invoice: Invoice, allocation: Allocation, amount: string): Promise<Invoice>;
    rejectInvoice(invoice: Invoice, reason: string): Promise<Invoice>;
    acceptDebitNote(debitNote: DebitNote, allocation: Allocation, amount: string): Promise<DebitNote>;
    rejectDebitNote(debitNote: DebitNote, reason: string): Promise<DebitNote>;
    createInvoiceProcessor(): InvoiceProcessor;
    createAgreementPaymentProcess(agreement: Agreement, allocation: Allocation, options?: Partial<PaymentProcessOptions>): AgreementPaymentProcess;
    /**
     * Get the payment platform and wallet address of the payer.
     */
    getPayerDetails(): Promise<PayerDetails>;
}
export declare class PaymentModuleImpl implements PaymentModule {
    events: EventEmitter<PaymentEvents>;
    private readonly yagnaApi;
    private readonly paymentApi;
    private readonly logger;
    private readonly options;
    constructor(deps: GolemServices, options?: PaymentModuleOptions);
    private startEmittingPaymentEvents;
    private getPaymentPlatform;
    getPayerDetails(): Promise<PayerDetails>;
    observeDebitNotes(): Observable<DebitNote>;
    observeInvoices(): Observable<Invoice>;
    createAllocation(params: CreateAllocationParams): Promise<Allocation>;
    releaseAllocation(allocation: Allocation): Promise<void>;
    getAllocation(id: string): Promise<Allocation>;
    amendAllocation(allocation: Allocation, _newOpts: CreateAllocationParams): Promise<Allocation>;
    acceptInvoice(invoice: Invoice, allocation: Allocation, amount: string): Promise<Invoice>;
    rejectInvoice(invoice: Invoice, reason: string): Promise<Invoice>;
    acceptDebitNote(debitNote: DebitNote, allocation: Allocation, amount: string): Promise<DebitNote>;
    rejectDebitNote(debitNote: DebitNote, reason: string): Promise<DebitNote>;
    /**
     * Creates an instance of utility class InvoiceProcessor that deals with invoice related use-cases
     */
    createInvoiceProcessor(): InvoiceProcessor;
    createAgreementPaymentProcess(agreement: Agreement, allocation: Allocation, options?: Partial<PaymentProcessOptions>): AgreementPaymentProcess;
}
