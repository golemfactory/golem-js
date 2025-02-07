import { DebitNote, IDebitNoteRepository } from "../../../payment/debit_note";
import { MarketApi, PaymentApi } from "ya-ts-client";
export declare class DebitNoteRepository implements IDebitNoteRepository {
    private readonly paymentClient;
    private readonly marketClient;
    constructor(paymentClient: PaymentApi.RequestorService, marketClient: MarketApi.RequestorService);
    getById(id: string): Promise<DebitNote>;
}
