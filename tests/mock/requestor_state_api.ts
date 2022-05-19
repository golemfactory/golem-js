/* eslint @typescript-eslint/ban-ts-comment: 0 */
import { RequestorStateApi } from "ya-ts-client/dist/ya-activity/src/api/requestor-state-api";
import { ActivityState, ActivityStateStateEnum } from "ya-ts-client/dist/ya-activity/src/models";
import { AxiosRequestConfig, AxiosResponse } from "axios";

export class RequestorSateApiMock extends RequestorStateApi {
  private expectedResults = {
    getActivityState: null,
  };
  private mockStackResults = [
    [ActivityStateStateEnum.Terminated, ActivityStateStateEnum.Unresponsive],
    [ActivityStateStateEnum.Unresponsive, ActivityStateStateEnum.Deployed],
    [ActivityStateStateEnum.Deployed, ActivityStateStateEnum.Ready],
    [ActivityStateStateEnum.Ready, ActivityStateStateEnum.Initialized],
    [ActivityStateStateEnum.Initialized, ActivityStateStateEnum.New],
  ];
  private expectedErrors = {};

  constructor() {
    super();
  }

  setExpected(function_name, results, errors?) {
    this.expectedResults[function_name] = results;
    this.expectedErrors[function_name] = errors;
  }

  // @ts-ignore
  getActivityState(activityId: string, options?: AxiosRequestConfig): Promise<AxiosResponse<ActivityState>> {
    return new Promise((res) =>
      res({ data: { state: this.expectedResults?.getActivityState || this.mockStackResults.pop() } } as AxiosResponse)
    );
  }
}
