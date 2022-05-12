import { Script, Command, Results } from "./script";
import { RequestorControlApi, RequestorStateApi } from "ya-ts-client/dist/ya-activity/api";
import { executeMock, stateApi } from "./mock";
import EventEmitter from "events";
import { ActivityStateStateEnum } from "ya-ts-client/dist/ya-activity/src/models/activity-state";

enum ActivityEvents {
  StateChanged = "StateChanged",
  ScriptSent = "ScriptSent",
  ScriptExecuted = "ScriptExecuted",
}

export class Activity extends EventEmitter {
  private state: ActivityStateStateEnum;
  private api: RequestorControlApi;
  // private stateApi: RequestorStateApi;
  private stateApi;

  constructor(public readonly id) {
    super();
    this.state = ActivityStateStateEnum.New;
    this.api = new RequestorControlApi();
    // this.stateApi = new RequestorStateApi();
    this.stateApi = new stateApi();
  }

  async execute(script: Script): Promise<Results> {
    const results = executeMock(script);
    this.emit(ActivityEvents.ScriptSent, 11);
    results.on("end", () => this.emit(ActivityEvents.ScriptExecuted));
    await this.checkState();
    return results;
  }

  async stop(): Promise<boolean> {
    // TODO
    await this.checkState();
    return true;
  }

  private async checkState() {
    const { data } = await this.stateApi.getActivityState(this.id);
    // TODO: catch and check error
    if (data?.state?.[0] !== this.state) {
      this.state = data.state[0];
      this.emit(ActivityEvents.StateChanged, this.state);
    }
  }
}

export { Script, Results, Command };
