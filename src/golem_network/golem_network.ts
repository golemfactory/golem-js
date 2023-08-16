import { TaskExecutor } from "../executor/executor";
import { JobOnGolem, JobOnGolemConfig } from "./job_on_golem";
import { InMemoryJobStorage, JobStorage } from "./job_storage";
import { v4 } from "uuid";

export interface GolemNetworkConfig {
  jobStorage?: JobStorage;
  image?: string;
  enableLogging?: boolean;
  beforeEachJob?: JobOnGolemConfig["jobDescription"];
}

export class GolemNetwork {
  private readonly jobStorage: JobStorage;
  private readonly image: string;
  private readonly enableLogging: boolean;
  private readonly beforeEachJob: JobOnGolemConfig["jobDescription"];
  private executor: TaskExecutor | null = null;

  constructor(config: GolemNetworkConfig) {
    this.jobStorage = config.jobStorage || new InMemoryJobStorage();
    this.image = config.image || "golem/alpine:3.18.2";
    this.enableLogging = config.enableLogging || false;
    this.beforeEachJob = config.beforeEachJob || (async () => {});
  }

  public isInitialized() {
    return this.executor !== null;
  }

  public async init() {
    this.executor = await TaskExecutor.create({
      package: this.image,
      enableLogging: this.enableLogging,
    });
  }

  private async createJob({ jobId, jobDescription }: Omit<JobOnGolemConfig, "executor">) {
    if (this.executor === null) {
      throw new Error("GolemNetwork not initialized, please run init() first");
    }
    const job = new JobOnGolem({
      jobId,
      jobDescription: async (ctx) => {
        await this.beforeEachJob(ctx);
        return jobDescription(ctx);
      },
      executor: this.executor,
    });
    return job;
  }

  public async runJob({ jobDescription }: Pick<JobOnGolemConfig, "jobDescription">) {
    const jobId = v4();
    const job = await this.createJob({ jobId, jobDescription });
    job.on("statusChange", async (status) => {
      await this.jobStorage.setJobStatus(jobId, status);
    });
    job.on("success", async (result) => {
      await this.jobStorage.setJobResult(jobId, result);
    });
    job.on("fail", async (error) => {
      await this.jobStorage.setJobResult(jobId, error);
    });
    job.start();
    return jobId;
  }

  public async getJobStatus(jobId: string) {
    const status = await this.jobStorage.getJobStatus(jobId);
    if (status === null) {
      throw new Error(`Job ${jobId} not found`);
    }
    return status;
  }

  public async getJobResult(jobId: string) {
    const result = await this.jobStorage.getJobResult(jobId);
    return result;
  }

  public async close() {
    if (this.executor !== null) {
      await this.executor.end();
    }
  }
}
