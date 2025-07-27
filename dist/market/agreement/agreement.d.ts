import { MarketApi } from "ya-ts-client";
import { Demand } from "../demand";
/**
 * * `Proposal` - newly created by a Requestor (draft based on Proposal)
 * * `Pending` - confirmed by a Requestor and send to Provider for approval
 * * `Cancelled` by a Requestor
 * * `Rejected` by a Provider
 * * `Approved` by both sides
 * * `Expired` - not approved, rejected nor cancelled within validity period
 * * `Terminated` - finished after approval.
 *
 */
export type AgreementState = "Proposal" | "Pending" | "Cancelled" | "Rejected" | "Approved" | "Expired" | "Terminated";
export interface ProviderInfo {
    name: string;
    id: string;
    walletAddress: string;
}
export interface AgreementOptions {
    expirationSec?: number;
    waitingForApprovalTimeoutSec?: number;
}
export interface IAgreementRepository {
    getById(id: string): Promise<Agreement>;
}
/**
 * Agreement module - an object representing the contract between the requestor and the provider.
 */
export declare class Agreement {
    readonly id: string;
    private readonly model;
    readonly demand: Demand;
    /**
     * @param id
     * @param model
     * @param demand
     */
    constructor(id: string, model: MarketApi.AgreementDTO, demand: Demand);
    /**
     * Return agreement state
     * @return state
     */
    getState(): "Proposal" | "Pending" | "Cancelled" | "Rejected" | "Approved" | "Expired" | "Terminated";
    get provider(): ProviderInfo;
    /**
     * Returns flag if the agreement is in the final state
     * @description if the final state is true, agreement will not change state further anymore
     * @return boolean
     */
    isFinalState(): boolean;
}
