/* eslint @typescript-eslint/ban-ts-comment: 0 */
import { RequestorControlApi } from "ya-ts-client/dist/ya-activity/src/api/requestor-control-api";
import { ExeScriptCommandResult, ExeScriptRequest } from "ya-ts-client/dist/ya-activity/src/models";
import { AxiosRequestConfig, AxiosResponse } from "axios";

export class RequestorControlApiMock extends RequestorControlApi {
  private expectedResults = {
    exec: "test_batch_id",
    getExecBatchResults: ["result4", "result3", "result2", "result1"],
  };
  private expectedErrors = {};
  private mockedResults: string[] = [];

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
    return new Promise((res) => res({ data: this.expectedResults?.exec } as AxiosResponse));
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
      this.mockedResults.push(this.expectedResults?.getExecBatchResults.pop() as string);
    }
    await new Promise((res) => setTimeout(res, 1000));
    return new Promise((res) => res({ data: this.mockedResults } as AxiosResponse));
  }
}
