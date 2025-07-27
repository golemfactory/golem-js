import { IInvoiceRepository, Invoice } from "../../../payment/invoice";
import { MarketApi, PaymentApi } from "ya-ts-client";
export declare class InvoiceRepository implements IInvoiceRepository {
    private readonly paymentClient;
    private readonly marketClient;
    constructor(paymentClient: PaymentApi.RequestorService, marketClient: MarketApi.RequestorService);
    getById(id: string): Promise<Invoice>;
}
