/* eslint @typescript-eslint/ban-ts-comment: 0 */
import { RequestorControlApi } from "ya-ts-client/dist/ya-activity/src/api/requestor-control-api";
import { ExeScriptCommandResult, ExeScriptRequest } from "ya-ts-client/dist/ya-activity/src/models";
import { AxiosRequestConfig, AxiosResponse } from "axios";
import { v4 as uuidv4 } from "uuid";
import { ExeScriptCommandResultResultEnum } from "ya-ts-client/dist/ya-activity/src/models/exe-script-command-result";

export class RequestorControlApiMock extends RequestorControlApi {
  private expectedResults: ExeScriptCommandResult[] = [];
  private mockedResults: ExeScriptCommandResult[] = [];
  private exampleResult = {
    index: 0,
    eventDate: new Date().toISOString(),
    result: "Ok" as ExeScriptCommandResultResultEnum,
    stdout: "test_result",
    stderr: "",
    message: "",
    isBatchFinished: true,
  };

  constructor() {
    super();
  }

  setExpectedResult(results) {
    results.forEach((result, i) => {
      this.expectedResults[i] = Object.assign({}, this.exampleResult);
      this.expectedResults[i][result[0]] = result[1];
    });
  }
  // @ts-ignore
  async exec(
    activityId: string,
    script: ExeScriptRequest,
    options?: AxiosRequestConfig
  ): Promise<AxiosResponse<string>> {
    return new Promise((res) => res({ data: uuidv4() } as AxiosResponse));
  }
  // @ts-ignore
  async getExecBatchResults(
    activityId: string,
    batchId: string,
    commandIndex?: number,
    timeout?: number,
    options?: AxiosRequestConfig
  ): Promise<AxiosResponse<ExeScriptCommandResult[]>> {
    // console.log(this.expectedResults);
    if (this.expectedResults?.length) {
      this.mockedResults.push(this.expectedResults?.shift() as ExeScriptCommandResult);
    }
    await new Promise((res) => setTimeout(res, 1000));
    return new Promise((res) =>
      res({ data: this.mockedResults.length ? this.mockedResults : [this.exampleResult] } as AxiosResponse)
    );
  }
}
