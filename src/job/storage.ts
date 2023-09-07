import { JobState } from "./job";

export type SerializedJob<OutputType = unknown> = {
  state: JobState;
  results?: OutputType;
  error?: string;
};

export interface JobStorage {
  setJob(jobId: string, state: JobState, results?: unknown, error?: Error): Promise<void>;
  getJob(jobId: string): Promise<SerializedJob | null>;
}

export class InMemoryJobStorage implements JobStorage {
  private readonly jobs = new Map<string, SerializedJob>();

  async setJob(jobId: string, state: JobState, results?: unknown, error?: Error): Promise<void> {
    this.jobs.set(jobId, { state, results, error: error?.message });
  }

  async getJob(jobId: string): Promise<SerializedJob | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    return job;
  }
}
