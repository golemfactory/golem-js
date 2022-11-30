/* eslint @typescript-eslint/ban-ts-comment: 0 */
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import {
  Agreement as yaAgreement
} from "ya-ts-client/dist/ya-market/src/models";
import { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { AgreementProposal } from "ya-ts-client/dist/ya-market/src/models/agreement-proposal";
import { AgreementStateEnum } from "ya-ts-client/dist/ya-market/src/models/agreement";

const genRanHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');

type MockOfferAgreementSet = {
  proposal: AgreementProposal | {
    timestamp: number,
    providerId: string,
    providerName: string
  },
  agreement: {
    id: string,
    timestamp: number,
    validTo: number,
    state: AgreementStateEnum
  }
}

const _mockOfferAgreementSets: MockOfferAgreementSet[] = [];

export class RequestorApiMock extends RequestorApi {

  constructor() {
    super();
  }

  private findIndexByAgreementId(id) {
    return _mockOfferAgreementSets.findIndex((i) => i.agreement.id === id)
  }

  private _createAgreementUsingProposal(proposal) {
    const id = genRanHex(64);
    const set = {
      proposal: {
        ...proposal,
        providerName: 'someProviderName_' + _mockOfferAgreementSets.length + 1,
        providerId: (_mockOfferAgreementSets.length+1).toString(16),
        timestamp: Date.now(),
      },
      agreement: {
        id,
        timestamp: Date.now(),
        validTo: Date.now() + 10000,
        state: AgreementStateEnum.Proposal
      }
    }
    _mockOfferAgreementSets.push(set);
    return set;
  }

  // @ts-ignore
  async createAgreement(
    createAgreementRequest: AgreementProposal,
    options?: AxiosRequestConfig
  ): Promise<AxiosResponse<string>> {
    const { agreement } = this._createAgreementUsingProposal(createAgreementRequest);
    return new Promise((res) => res({ data: agreement.id } as AxiosResponse));
  }

  private _buildAgreementResponse(set) {
    return {
      "agreementId": set.agreement.id,
      "demand": {
        "properties": {},
        "demandId": "11ed39f6246a4b4fbe4657cd69aa551f-3669d52b420b3ffc92e88e64a4936ca878ecf73b4922521331abcf44fc83fc3a",
        "requestorId": "0xdc9b51c37a6f45a5fdc9af6ea04e00f7c64a2b6f",
        "timestamp": (new Date(Date.now()).toISOString()).toString()
      },
      "offer": {
        "properties": {
          "golem.node.id.name": set.proposal.providerName
        },
        "offerId": set.proposal.proposalId,
        "providerId": set.proposal.providerId,
        "timestamp": (new Date(set.proposal.timestamp).toISOString()).toString()
      },
      "validTo": (new Date(set.agreement.validTo).toISOString()).toString(),
      "state": set.agreement.state,
      "timestamp": (new Date(set.agreement.timestamp).toISOString()).toString()
    }
  }

  // @ts-ignore
  async getAgreement(
      agreementId: string,
      options?: AxiosRequestConfig
  ): Promise<AxiosResponse<string | yaAgreement>|AxiosError<string>> {
    const index = this.findIndexByAgreementId(agreementId);
    if(index >= 0) {
      const set = _mockOfferAgreementSets[index];
      return new Promise((res) => res({
        data: this._buildAgreementResponse(set)
      } as AxiosResponse));
    } else {
      return new Promise((res, rej) => rej({
        code: '404'
      } as AxiosError<string>));
    }
  }

  // @ts-ignore
  async terminateAgreement(agreementId: string) {

  }

  // // @ts-ignore
  // async exec(
  //   activityId: string,
  //   script: ExeScriptRequest,
  //   options?: AxiosRequestConfig
  // ): Promise<AxiosResponse<string>> {
  //   return new Promise((res) => res({ data: uuidv4() } as AxiosResponse));
  // }
  // // @ts-ignore
  // async getExecBatchResults(
  //   activityId: string,
  //   batchId: string,
  //   commandIndex?: number,
  //   timeout?: number,
  //   options?: AxiosRequestConfig
  // ): Promise<AxiosResponse<ExeScriptCommandResult[]>> {
  //   if (this.expectedErrors.length) {
  //     const mockError = this.expectedErrors.shift();
  //     const error = new Error(mockError!.message) as AxiosError;
  //     error.response = {
  //       data: { message: mockError!.message },
  //       status: mockError!.status,
  //     } as AxiosResponse;
  //     throw error;
  //   }
  //   if (this.expectedResults?.length) {
  //     this.mockedResults.push(this.expectedResults?.shift() as ExeScriptCommandResult);
  //   }
  //   await new Promise((res) => setTimeout(res, 100));
  //   return new Promise((res) =>
  //     res({ data: this.mockedResults.length ? this.mockedResults : [this.exampleResult] } as AxiosResponse)
  //   );
  // }
  //
  // // @ts-ignore
  // async destroyActivity(
  //   activityId: string,
  //   timeout?: number,
  //   options?: AxiosRequestConfig
  // ): Promise<import("axios").AxiosResponse<void>> {
  //   return new Promise((res) => res({ data: null } as AxiosResponse));
  // }
}
