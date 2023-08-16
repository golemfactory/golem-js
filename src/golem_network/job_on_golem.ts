import EventEmitter from "events";
import { TaskExecutor } from "../executor/executor";
import { Worker } from "../task/work";

type JobDescription = Worker;

export interface JobOnGolemConfig {
  jobId: string;
  jobDescription: JobDescription;
  executor: TaskExecutor;
}

export type JobStatus = "running" | "finished" | "failed";

export class JobOnGolem extends EventEmitter {
  public readonly jobId: string;
  public readonly jobDescription: JobDescription;
  public readonly executor: TaskExecutor;

  constructor(config: JobOnGolemConfig) {
    super();
    this.jobId = config.jobId;
    this.jobDescription = config.jobDescription;
    this.executor = config.executor;
  }

  public start() {
    this.emit("statusChange", "running");
    this.executor
      .run(this.jobDescription)
      .then((result) => {
        this.emit("statusChange", "finished");
        this.emit("success", result);
        this.stop();
      })
      .catch((error) => {
        this.emit("statusChange", "failed");
        this.emit("fail", error);
        this.stop();
      });
  }

  public async stop() {
    this.removeAllListeners();
  }

  public on(event: "statusChange", listener: (status: JobStatus) => void): this;
  public on(event: "success", listener: (result: unknown) => void): this;
  public on(event: "fail", listener: (error: unknown) => void): this;
  public on(event, listener) {
    return super.on(event, listener);
  }
}
