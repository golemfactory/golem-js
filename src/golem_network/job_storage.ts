import { JobStatus } from "./job_on_golem";

export interface JobStorage {
  setJobStatus(jobId: string, status: JobStatus): Promise<void>;
  getJobStatus(jobId: string): Promise<JobStatus | null>;
  setJobResult(jobId: string, result: unknown): Promise<void>;
  getJobResult(jobId: string): Promise<unknown | null>;
}

export class InMemoryJobStorage implements JobStorage {
  private statuses: Map<string, JobStatus> = new Map();
  private results: Map<string, unknown> = new Map();

  async setJobStatus(jobId: string, status: JobStatus) {
    this.statuses.set(jobId, status);
  }

  async getJobStatus(jobId: string) {
    return this.statuses.get(jobId) || null;
  }

  async setJobResult(jobId: string, result: unknown) {
    this.results.set(jobId, result);
  }

  async getJobResult(jobId: string) {
    return this.results.get(jobId);
  }
}
