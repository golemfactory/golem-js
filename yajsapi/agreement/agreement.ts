import { Logger } from "../utils";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { yaMarket } from "ya-ts-client";
import { Agreement as yaAgreement } from "ya-ts-client/dist/ya-market/src/models";

export enum AgreementState {
    Proposal = 'Proposal',
    Pending = 'Pending',
    Cancelled = 'Cancelled',
    Rejected = 'Rejected',
    Approved = 'Approved',
    Expired = 'Expired',
    Terminated = 'Terminated'
}

export interface AgreementOptions {
    credentials?: { apiKey?: string; basePath?: string };
    requestTimeout?: number;
    executeTimeout?: number;
    exeBatchResultsFetchInterval?: number;
    logger?: Logger;
}

export interface ProviderInfo {
    providerName: string;
    providerId: string | null;
}

export class Agreement {
    private readonly config: { apiKey: string; basePath: string };
    protected readonly api: RequestorApi;
    private readonly logger?: Logger;
    protected readonly requestTimeout: number;
    private readonly executeTimeout: number;
    private readonly exeBatchResultsFetchInterval: number;

    private agreementData: yaAgreement | undefined;

    /**
     * Create an Agreement
     * @param id - agreement ID created by Activity Factory
     * @param options - AgreementOptions
     * @param options.credentials.apiKey - Yagna Api Key
     * @param options.credentials.basePath - Yagna base path to Activity REST Api
     * @param options.requestTimeout - timeout for sending and creating batch
     * @param options.executeTimeout - timeout for executing batch
     * @param options.exeBatchResultsFetchInterval - interval for fetching batch results while polling
     * @param options.logger - logger module
     */
    constructor(public readonly id, protected readonly options?: AgreementOptions) {
        const apiKey = this.options?.credentials?.apiKey || process.env.YAGNA_APPKEY;
        const basePath = this.options?.credentials?.basePath || process.env.YAGNA_API_BASEPATH;
        if (!apiKey) throw new Error("Api key not defined");
        if (!basePath) throw new Error("Api base path not defined");
        this.config = { apiKey, basePath };
        const apiConfig = new yaMarket.Configuration({ apiKey, basePath, accessToken: apiKey });
        this.api = new RequestorApi(apiConfig);
        this.requestTimeout = options?.requestTimeout || 10000;
        this.executeTimeout = options?.executeTimeout || 240000;
        this.exeBatchResultsFetchInterval = options?.exeBatchResultsFetchInterval || 3000;
        this.logger = options?.logger;
    }

    async refreshDetails() {
        const { data } = await this.api.getAgreement(this.id, { timeout: this.requestTimeout });
        this.agreementData = data;
    }

    getProviderInfo(): ProviderInfo {
        return {
            providerName: "todo",
            providerId: this.agreementData?.offer?.providerId || null
        };
    }

    getId() {
        return this.id;
    }

    getState(): AgreementState {
        return (this.agreementData?.state || AgreementState.Proposal) as AgreementState;
    }
}