import { Subject } from "rxjs";
import { Allocation, CreateAllocationParams, DebitNote, Invoice, IPaymentApi } from "../../../payment";
import { IInvoiceRepository } from "../../../payment/invoice";
import { Logger, YagnaApi } from "../../utils";
import { IDebitNoteRepository } from "../../../payment/debit_note";
export declare class PaymentApiAdapter implements IPaymentApi {
    private readonly yagna;
    private readonly invoiceRepo;
    private readonly debitNoteRepo;
    private readonly logger;
    receivedInvoices$: Subject<Invoice>;
    receivedDebitNotes$: Subject<DebitNote>;
    constructor(yagna: YagnaApi, invoiceRepo: IInvoiceRepository, debitNoteRepo: IDebitNoteRepository, logger: Logger);
    connect(): Promise<void>;
    getInvoice(id: string): Promise<Invoice>;
    getDebitNote(id: string): Promise<DebitNote>;
    acceptInvoice(invoice: Invoice, allocation: Allocation, amount: string): Promise<Invoice>;
    rejectInvoice(invoice: Invoice, reason: string): Promise<Invoice>;
    acceptDebitNote(debitNote: DebitNote, allocation: Allocation, amount: string): Promise<DebitNote>;
    rejectDebitNote(debitNote: DebitNote): Promise<DebitNote>;
    getAllocation(id: string): Promise<Allocation>;
    createAllocation(params: CreateAllocationParams): Promise<Allocation>;
    releaseAllocation(allocation: Allocation): Promise<void>;
}
