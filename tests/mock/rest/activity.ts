/* eslint @typescript-eslint/ban-ts-comment: 0 */
import { RequestorControlApi } from "ya-ts-client/dist/ya-activity/src/api/requestor-control-api";
import {
  ActivityState,
  ActivityStateStateEnum,
  CreateActivityRequest,
  CreateActivityResult,
  ExeScriptCommandResult,
  ExeScriptRequest,
} from "ya-ts-client/dist/ya-activity/src/models";
import { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { v4 as uuidv4 } from "uuid";
import {
  ExeScriptCommandResultResultEnum
} from "ya-ts-client/dist/ya-activity/src/models/exe-script-command-result";
import { RequestorStateApi } from "ya-ts-client/dist/ya-activity/src/api/requestor-state-api";

const exampleExeResult = {
  index: 0,
  eventDate: new Date().toISOString(),
  result: "Ok" as ExeScriptCommandResultResultEnum,
  stdout: "test_result",
  stderr: "",
  message: "",
  isBatchFinished: true,
};
global.expectedExeResults = [];
export const setExpectedExeResults = (results) =>
  results.forEach((result, i) => {
    global.expectedExeResults[i] = Object.assign({}, exampleExeResult);
    global.expectedExeResults[i] = Object.assign(global.expectedExeResults[i], result);
    global.expectedExeResults[i].index = i;
    global.expectedExeResults[i].isBatchFinished = i === results.length - 1;
  });

global.expectedErrors = [];
export const setExpectedErrors = (errors) => (global.expectedErrors = errors);

global.expectedStates = [];
export const setExpectedStates = (states) => (global.expectedStates = states);

export const clear = () => {
  global.expectedExeResults = [];
  global.expectedErrors = [];
  global.expectedStates = [];
};

export class RequestorControlApiMock extends RequestorControlApi {
  constructor() {
    super();
  }
  // @ts-ignore
  async createActivity(
    stringCreateActivityRequest: string | CreateActivityRequest,
    timeout?: number,
    options?: AxiosRequestConfig
  ): Promise<import("axios").AxiosResponse<string | CreateActivityResult>> {
    return new Promise((res) => res({ data: { activityId: uuidv4() } } as AxiosResponse));
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
    if (global.expectedErrors.length) {
      const mockError = global.expectedErrors.shift();
      const error = new Error(mockError!.message) as AxiosError;
      error.response = {
        data: { message: mockError!.message },
        status: mockError!.status,
      } as AxiosResponse;
      throw error;
    }
    await new Promise((res) => setTimeout(res, 100));
    return new Promise((res) =>
      res({ data: global.expectedExeResults?.length ? global.expectedExeResults : [exampleExeResult] } as AxiosResponse)
    );
  }

  // @ts-ignore
  async destroyActivity(
    activityId: string,
    timeout?: number,
    options?: AxiosRequestConfig
  ): Promise<import("axios").AxiosResponse<void>> {
    return new Promise((res) => res({ data: null } as AxiosResponse));
  }
}

export class RequestorSateApiMock extends RequestorStateApi {
  private exampleStates = [
    [ActivityStateStateEnum.Initialized, ActivityStateStateEnum.Ready],
    [ActivityStateStateEnum.Ready, ActivityStateStateEnum.Ready],
    [ActivityStateStateEnum.Ready, ActivityStateStateEnum.Ready],
    [ActivityStateStateEnum.Ready, ActivityStateStateEnum.Ready],
    [ActivityStateStateEnum.Ready, ActivityStateStateEnum.Ready],
    [ActivityStateStateEnum.Ready, ActivityStateStateEnum.Ready],
    [ActivityStateStateEnum.Ready, ActivityStateStateEnum.Ready],
    [ActivityStateStateEnum.Ready, ActivityStateStateEnum.Ready],
    [ActivityStateStateEnum.Ready, ActivityStateStateEnum.Ready],
  ];
  constructor() {
    super();
  }

  // @ts-ignore
  getActivityState(activityId: string, options?: AxiosRequestConfig): Promise<AxiosResponse<ActivityState>> {
    return new Promise((res) =>
      res({
        data: {
          state: global.expectedStates.length ? global.expectedStates : this.exampleStates.shift(),
          reason: "test",
          errorMessage: "test",
        },
      } as AxiosResponse)
    );
  }
}
