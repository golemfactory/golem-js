/* eslint @typescript-eslint/ban-ts-comment: 0 */
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import {
  CreateActivityRequest,
  CreateActivityResult,
  ExeScriptCommandResult,
  ExeScriptRequest,
} from "ya-ts-client/dist/ya-activity/src/models";
import { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { ExeScriptCommandResultResultEnum } from "ya-ts-client/dist/ya-activity/src/models/exe-script-command-result";
import { AgreementProposal } from "ya-ts-client/dist/ya-market/src/models/agreement-proposal";

const genRanHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');

export class RequestorApiMock extends RequestorApi {
  private expectedResults: ExeScriptCommandResult[] = [];
  private mockedResults: ExeScriptCommandResult[] = [];
  private expectedErrors: { message: string; status: number }[] = [];
  private mockedErrors: { message: string; status: number }[] = [];
  private exampleResult = {
    index: 0,
    eventDate: new Date().toISOString(),
    result: "Ok" as ExeScriptCommandResultResultEnum,
    stdout: "test_result",
    stderr: "",
    message: "",
    isBatchFinished: false,
  };

  constructor() {
    super();
  }

  setExpectedResult(results) {
    results.forEach((result, i) => {
      this.expectedResults[i] = Object.assign({}, this.exampleResult);
      this.expectedResults[i].index = i;
      this.expectedResults[i][result[0]] = result[1];
      if (i === results.length - 1) {
        this.expectedResults[i].isBatchFinished = true;
      }
    });
  }
  setExpectedErrors(errors) {
    this.expectedErrors = errors;
  }
  // @ts-ignore
  async createAgreement(
    stringCreateActivityRequest: AgreementProposal,
    options?: AxiosRequestConfig
  ): Promise<import("axios").AxiosResponse<string | CreateActivityResult>> {
    return new Promise((res) => res({ data: genRanHex(64) } as AxiosResponse));
  }

  // @ts-ignore
  async getAgreement(
      agreementId: string,
      options?: AxiosRequestConfig
  ): Promise<import("axios").AxiosResponse<string | CreateActivityResult>> {
    return new Promise((res) => res({ data: {
        "agreementId": agreementId,
        "demand": {
          "properties": {},
          "demandId": "11ed39f6246a4b4fbe4657cd69aa551f-3669d52b420b3ffc92e88e64a4936ca878ecf73b4922521331abcf44fc83fc3a",
          "requestorId": "0xdc9b51c37a6f45a5fdc9af6ea04e00f7c64a2b6f",
          "timestamp": (new Date(Date.now()).toISOString()).toString()
        },
        "offer": {
          "properties": {},
          "offerId": "a37a34ca03844acea2cdcf1ae437e4f5-57d6f2c49abfc0de043dcd3fc47fa95f427e4821962deca23f228b443bd58fd5",
          "providerId": "0xc6871fbc0f552a8b7ba0f2f777ca40026286bc56",
          "timestamp": "2022-11-07T11:07:06.261723Z"
        },
        "validTo": (new Date(Date.now() + 10000).toISOString()).toString(),
        "state": "Proposal",
        "timestamp": (new Date(Date.now()).toISOString()).toString()
      } } as AxiosResponse));
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
