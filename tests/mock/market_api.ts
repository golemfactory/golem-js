/* eslint @typescript-eslint/ban-ts-comment: 0 */
import { RequestorApi } from "ya-ts-client/dist/ya-market/src/api/requestor-api";
import { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { v4 as uuidv4 } from "uuid";
import { DemandOfferBase, Event, ProposalEvent } from "ya-ts-client/dist/ya-market/src/models";
import { proposalsDraft, proposalsInitial } from "./fixtures/proposals";

export class MarketApiMock extends RequestorApi {
  private expectedProposals?: ProposalEvent[];
  private expectedError?: { message: string; status: number };
  private exampleProposals = [...proposalsInitial, proposalsDraft];

  constructor() {
    super();
  }

  setExpectedProposals(proposals) {
    return (this.expectedProposals = proposals);
  }
  setExpectedError(error) {
    this.expectedError = error;
  }
  // @ts-ignore
  async subscribeDemand(
    demandOfferBase: DemandOfferBase,
    options?: AxiosRequestConfig
  ): Promise<import("axios").AxiosResponse<string>> {
    return new Promise((res) => res({ data: uuidv4() } as AxiosResponse));
  }
  // @ts-ignore
  async collectOffers(
    subscriptionId: string,
    timeout?: number,
    maxEvents?: number,
    options?: AxiosRequestConfig
  ): Promise<import("axios").AxiosResponse<Event[]>> {
    if (this.expectedError) {
      const error = new Error(this.expectedError.message) as AxiosError;
      error.response = {
        data: { message: this.expectedError.message },
        status: this.expectedError.status,
      } as AxiosResponse;
      throw error;
    }
    await new Promise((res) => setTimeout(res, 10));
    return new Promise((res) => res({ data: this.expectedProposals || this.exampleProposals } as AxiosResponse));
  }
  // @ts-ignore
  unsubscribeDemand(
    subscriptionId: string,
    options?: AxiosRequestConfig
  ): Promise<import("axios").AxiosResponse<void>> {
    return new Promise((res) => res({ data: true } as AxiosResponse));
  }
  // @ts-ignore
  rejectProposalOffer(
    subscriptionId: string,
    proposalId: string,
    requestBody?: {
      [key: string]: object;
    },
    options?: AxiosRequestConfig
  ): Promise<import("axios").AxiosResponse<void>> {
    return new Promise((res) => res({ data: true } as AxiosResponse));
  }
  // @ts-ignore
  counterProposalDemand(
    subscriptionId: string,
    proposalId: string,
    demandOfferBase: DemandOfferBase,
    options?: AxiosRequestConfig
  ): Promise<import("axios").AxiosResponse<string>> {
    return new Promise((res) => res({ data: proposalId } as AxiosResponse));
  }
}
