/* eslint @typescript-eslint/ban-ts-comment: 0 */
import { RequestorApi } from "ya-ts-client/dist/ya-market/src/api/requestor-api";
import { AgreementProposal } from "ya-ts-client/dist/ya-market/src/models";
import { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { v4 as uuidv4 } from "uuid";
import { DemandOfferBase, Event, ProposalEvent } from "ya-ts-client/dist/ya-market/src/models";
import { agreementsApproved, proposalsDraft, proposalsInitial } from "../fixtures";
import { sleep } from "../../../yajsapi/utils";

global.expectedProposals = [];
export const setExpectedProposals = (proposals) => (global.expectedProposals = proposals);
global.expectedError;
export const setExpectedError = (error) => (global.expectedError = error);

export class MarketApiMock extends RequestorApi {
  private exampleProposals = [...proposalsInitial, proposalsDraft];

  constructor() {
    super();
  }
  // @ts-ignore
  async createAgreement(
    createAgreementRequest: AgreementProposal,
    options?: AxiosRequestConfig,
  ): Promise<AxiosResponse<string>> {
    const agreementData = agreementsApproved[0];
    return new Promise((res) => res({ data: agreementData.agreementId } as AxiosResponse));
  }
  // @ts-ignore
  async getAgreement(agreementId: string, options?: AxiosRequestConfig): Promise<AxiosResponse<string>> {
    const agreementData = agreementsApproved[0];
    return new Promise((res) => res({ data: agreementData } as AxiosResponse));
  }
  // @ts-ignore
  async confirmAgreement(agreementId: string): Promise<AxiosResponse<string>> {
    return new Promise((res) => res({} as AxiosResponse));
  }
  // @ts-ignore
  async terminateAgreement(agreementId: string): Promise<AxiosResponse<string>> {
    return new Promise((res) => res({} as AxiosResponse));
  }
  // @ts-ignore
  async waitForApproval(agreementId: string): Promise<AxiosResponse<string>> {
    await sleep(1);
    return new Promise((res) => res({} as AxiosResponse));
  }

  // @ts-ignore
  async subscribeDemand(
    demandOfferBase: DemandOfferBase,
    options?: AxiosRequestConfig,
  ): Promise<import("axios").AxiosResponse<string>> {
    return new Promise((res) => res({ data: uuidv4() } as AxiosResponse));
  }
  // @ts-ignore
  async collectOffers(
    subscriptionId: string,
    timeout?: number,
    maxEvents?: number,
    options?: AxiosRequestConfig,
  ): Promise<import("axios").AxiosResponse<Event[]>> {
    if (global.expectedError) {
      const error = new Error(global.expectedError.message) as AxiosError;
      error.response = {
        data: { message: global.expectedError.message },
        status: global.expectedError.status,
      } as AxiosResponse;
      throw error;
    }
    await new Promise((res) => setTimeout(res, 10));
    return new Promise((res) => res({ data: global.expectedProposals || this.exampleProposals } as AxiosResponse));
  }
  // @ts-ignore
  unsubscribeDemand(
    subscriptionId: string,
    options?: AxiosRequestConfig,
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
    options?: AxiosRequestConfig,
  ): Promise<import("axios").AxiosResponse<void>> {
    return new Promise((res) => res({ data: true } as AxiosResponse));
  }
  // @ts-ignore
  counterProposalDemand(
    subscriptionId: string,
    proposalId: string,
    demandOfferBase: DemandOfferBase,
    options?: AxiosRequestConfig,
  ): Promise<import("axios").AxiosResponse<string>> {
    return new Promise((res) => res({ data: proposalId } as AxiosResponse));
  }
}
