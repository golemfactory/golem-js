import { JobState } from "./job";

export type SerializedJob<OutputType = unknown> = {
  state: JobState;
  results?: OutputType;
  error?: string;
};

export interface JobStorage {
  setJob(taskId: string, state: JobState, results?: unknown, error?: Error): Promise<void>;
  getJob(taskId: string): Promise<SerializedJob | null>;
}

export class InMemoryJobStorage implements JobStorage {
  private readonly jobs = new Map<string, SerializedJob>();

  async setJob(jobId: string, state: JobState, results?: unknown, error?: Error): Promise<void> {
    this.jobs.set(jobId, { state, results, error: error?.message });
  }

  async getJob(taskId: string): Promise<SerializedJob | null> {
    const task = this.jobs.get(taskId);
    if (!task) return null;
    return task;
  }
}
