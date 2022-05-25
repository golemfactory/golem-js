/* eslint @typescript-eslint/ban-ts-comment: 0 */
import { RequestorControlApi } from "ya-ts-client/dist/ya-activity/src/api/requestor-control-api";
import { ExeScriptCommandResult, ExeScriptRequest } from "ya-ts-client/dist/ya-activity/src/models";
import { AxiosRequestConfig, AxiosResponse } from "axios";
import { v4 as uuidv4 } from "uuid";

export class RequestorControlApiMock extends RequestorControlApi {
  private expectedResults = {
    exec: null,
    getExecBatchResults: [
      {
        index: 0,
        eventDate: new Date().toISOString(),
        result: "Ok",
        stdout: "Result 1",
        isBatchFinished: true,
      },
    ],
  };
  private expectedErrors = {};
  private mockedResults: ExeScriptCommandResult[] = [];

  constructor() {
    super();
  }

  setExpected(function_name, res, err?) {
    this.expectedResults[function_name] = res;
    this.expectedErrors[function_name] = err;
  }
  // @ts-ignore
  async exec(
    activityId: string,
    script: ExeScriptRequest,
    options?: AxiosRequestConfig
  ): Promise<AxiosResponse<string>> {
    return new Promise((res) => res({ data: this.expectedResults?.exec || uuidv4() } as AxiosResponse));
  }
  // @ts-ignore
  async getExecBatchResults(
    activityId: string,
    batchId: string,
    commandIndex?: number,
    timeout?: number,
    options?: AxiosRequestConfig
  ): Promise<AxiosResponse<ExeScriptCommandResult[]>> {
    if (this.expectedResults?.getExecBatchResults?.length) {
      this.mockedResults.push(this.expectedResults?.getExecBatchResults.pop() as ExeScriptCommandResult);
    }
    await new Promise((res) => setTimeout(res, 1000));
    return new Promise((res) => res({ data: this.mockedResults } as AxiosResponse));
  }
}
