import { Logger } from "../utils";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { Agreement as yaAgreement } from "ya-ts-client/dist/ya-market/src/models";
import {AgreementConfigContainer} from "./agreement_config_container";

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
    eventPoolingInterval?: number;
    eventPoolingMaxEventsPerRequest?: number;
    logger?: Logger;
}

export interface ProviderInfo {
    providerName: string;
    providerId: string | null;
}

export class Agreement {
    private readonly api: RequestorApi;
    private readonly logger?: Logger;
    private readonly requestTimeout: number;

    private agreementData: yaAgreement | undefined;

    private locked = false;

    constructor(public readonly id, private readonly configContainer: AgreementConfigContainer) {
        this.logger = configContainer.logger;
        this.api = configContainer.api;
        this.requestTimeout = configContainer.options?.requestTimeout || 10000;
    }

    async refreshDetails() {
        const { data } = await this.api.getAgreement(this.id, { timeout: this.requestTimeout });
        this.agreementData = data;
    }

    getProviderInfo(): ProviderInfo {
        return {
            providerName: this.agreementData?.offer?.properties['golem.node.id.name'] || null,
            providerId: this.agreementData?.offer?.providerId || null
        };
    }

    getId() {
        return this.id;
    }

    getState(): AgreementState {
        return (this.agreementData?.state || AgreementState.Proposal) as AgreementState;
    }

    getAgreementData(): yaAgreement | undefined {
        return this.agreementData;
    }

    async terminate() {
        try {
            await this.api.terminateAgreement(this.id);
            return true;
        } catch (error) {
            this.logger?.warn(`Can not terminate agreement: ${error}`);
            throw error;
        }
    }

    release() {
        this.locked = false;
    }

    lock() {
        this.locked = true;
    }

    isLocked() {
        return this.locked;
    }
}