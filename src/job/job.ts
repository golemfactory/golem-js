import { SerializedJob, JobStorage } from "./storage";
import { TaskState as JobState } from "../task/task";
export { TaskState as JobState } from "../task/task";
/**
 * State of a computation unit.
 *
 * @description Represents the state of some computation unit. The purpose of this class is to provide a way to check the state, results and error of a computation unit knowing only its id.
 */
export class Job<Output = unknown> {
  constructor(
    public readonly id: string,
    private jobStorage: JobStorage,
  ) {}

  async saveInitialState(): Promise<void> {
    await this.saveState(JobState.New);
  }

  async saveState(state: JobState, results?: Output, error?: Error): Promise<void> {
    await this.jobStorage.setJob(this.id, state, results, error);
  }

  private async fetchFromStorage(): Promise<SerializedJob<Output>> {
    const state = await this.jobStorage.getJob(this.id);
    if (!state) {
      throw new Error(`Job ${this.id} not found in storage`);
    }
    return state as SerializedJob<Output>;
  }

  async fetchState(): Promise<JobState> {
    const { state } = await this.fetchFromStorage();
    return state;
  }
  async fetchResults(): Promise<Output | undefined> {
    const { results } = await this.fetchFromStorage();
    return results;
  }
  async fetchError(): Promise<Error | undefined> {
    const { error } = await this.fetchFromStorage();
    return error ? new Error(error) : undefined;
  }
}
