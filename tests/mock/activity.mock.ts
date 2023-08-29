import { Activity, ActivityConfig, ActivityStateEnum, Result, ResultState } from "../../src/activity";
import { Events, nullLogger } from "../../src";
import { ExeScriptRequest } from "../../src/activity/activity";
import { Readable } from "stream";

export class ActivityMock extends Activity {
  private _currentState: ActivityStateEnum = ActivityStateEnum.Ready;

  private results: (Result | Error)[] = [];

  static createResult(props?: Partial<Result>): Result {
    return new Result({
      result: ResultState.Ok,
      index: 1,
      eventDate: new Date().toISOString(),
      ...props,
    });
  }

  constructor(id?: string, agreementId?: string, options?: ActivityConfig) {
    super(id, agreementId, (options ?? { logger: nullLogger() }) as unknown as ActivityConfig);
  }

  async execute(script: ExeScriptRequest, stream?: boolean, timeout?: number): Promise<Readable> {
    // TODO: add more events if needed.
    const eventTarget = this.options?.eventTarget;

    const readable = new Readable({
      objectMode: true,
      read: () => {
        const result = this.results.shift();
        if (result instanceof Error) {
          readable.emit("error", result);
        } else if (result) {
          readable.push(result);
        } else {
          eventTarget?.dispatchEvent(
            new Events.ScriptExecuted({
              activityId: this.id,
              agreementId: this.agreementId,
              success: true,
            }),
          );
          readable.push(null);
        }
      },
    });

    return readable;
  }

  async stop(): Promise<boolean> {
    return true;
  }

  async getState(): Promise<ActivityStateEnum> {
    return this._currentState;
  }

  mockCurrentState(state: ActivityStateEnum) {
    this._currentState = state;
  }

  mockResults(results: Result[]) {
    this.results = results;
  }

  /**
   * Create a new execution result and add it to the list of results.
   * @param props
   */
  mockResultCreate(props: Partial<Result> = {}): Result {
    const result = ActivityMock.createResult(props);
    this.results.push(result);
    return result;
  }

  /**
   * Create a failure event, once execute will reach it, an exception will be thrown.
   *
   * This can be used to simulate various failures modes.
   */
  mockResultFailure(messageOrError: string | Error): void {
    this.results.push(typeof messageOrError === "string" ? new Error(messageOrError) : messageOrError);
  }
}
