import * as YaTsClient from "ya-ts-client";
import { Logger } from "../utils";
import { Observable, Subject } from "rxjs";
import { StreamingBatchEvent } from "../../activity/results";
import { ElementOf } from "../utils/types";
export type YagnaOptions = {
    apiKey?: string;
    basePath?: string;
    logger?: Logger;
};
export declare const MIN_SUPPORTED_YAGNA = "0.15.2";
export type YagnaAgreementOperationEvent = ElementOf<Awaited<ReturnType<YaTsClient.MarketApi.RequestorService["collectAgreementEvents"]>>>;
export type YagnaInvoiceEvent = ElementOf<Awaited<ReturnType<YaTsClient.PaymentApi.RequestorService["getInvoiceEvents"]>>>;
export type YagnaDebitNoteEvent = ElementOf<Awaited<ReturnType<YaTsClient.PaymentApi.RequestorService["getDebitNoteEvents"]>>>;
export interface YagnaExeScriptObserver {
    observeBatchExecResults(activityId: string, batchId: string): Observable<StreamingBatchEvent>;
}
/**
 * Utility class that groups various Yagna APIs under a single wrapper
 *
 * This class has the following responsibilities:
 *
 * - selectively exposes services from ya-ts-client in a more user-friendly manner
 * - implements an event reader that collects events from Yagna endpoints and allows subscribing to them as Observables
 *   for agreements, debit notes and invoices. These observables emit ya-ts-client types on outputs
 *
 * End users of the SDK should not use this class and make use of {@link golem-network/golem-network.GolemNetwork} instead. This class is designed for
 * SDK developers to use.
 */
export declare class YagnaApi {
    readonly appSessionId: string;
    readonly yagnaOptions: YagnaOptions;
    /**
     * Base path used to build paths to Yagna's API
     *
     * @example http://localhost:7465
     */
    readonly basePath: string;
    readonly identity: YaTsClient.IdentityApi.DefaultService;
    market: YaTsClient.MarketApi.RequestorService;
    activity: {
        control: YaTsClient.ActivityApi.RequestorControlService;
        state: YaTsClient.ActivityApi.RequestorStateService;
        exec: YagnaExeScriptObserver;
    };
    net: YaTsClient.NetApi.RequestorService;
    payment: YaTsClient.PaymentApi.RequestorService;
    gsb: YaTsClient.GsbApi.RequestorService;
    version: YaTsClient.VersionApi.DefaultService;
    debitNoteEvents$: Subject<{
        eventType: string; /**
         * Terminates the Yagna API related activities
         */
        eventDate: string;
        debitNoteId: string;
    }>;
    private debitNoteEventsPoll;
    invoiceEvents$: Subject<{
        eventType: string;
        eventDate: string;
        invoiceId: string;
    }>;
    private invoiceEventPoll;
    agreementEvents$: Subject<{
        eventType: string;
        eventDate: string;
    } & {
        agreementId: string;
    }>;
    private agreementEventsPoll;
    private readonly logger;
    private readonly reader;
    constructor(options?: YagnaOptions);
    /**
     * Effectively starts the Yagna API client including subscribing to events exposed via rxjs subjects
     */
    connect(): Promise<{
        identity: string;
        name: string;
        role: string;
    }>;
    /**
     * Terminates the Yagna API related activities
     */
    disconnect(): Promise<void>;
    getVersion(): Promise<string>;
    private startPollingEvents;
    private stopPollingEvents;
    private assertSupportedVersion;
}
