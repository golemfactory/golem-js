import { defaultLogger, Logger } from "../shared/utils";
import { createPool, Factory, Pool } from "generic-pool";
import { GolemWorkError, WorkContext, WorkErrorCode } from "./work";
import { ActivityStateEnum } from "./index";
import { ActivityModule } from "./activity.module";
import { AgreementPool } from "../agreement";
import { ActivityDTO } from "./work/work";
import { EventEmitter } from "eventemitter3";
import { PaymentModule } from "../payment";

export interface ActivityPoolOptions {
  logger?: Logger;
  replicas?: number | { min: number; max: number };
}

export interface ActivityPoolEvents {
  ready: () => void;
  end: () => void;
  acquired: (activity: ActivityDTO) => void;
  released: (activity: ActivityDTO) => void;
  destroyed: (activity: ActivityDTO) => void;
  created: (activity: ActivityDTO) => void;
  error: (error: GolemWorkError) => void;
}

const MAX_REPLICAS = 100;

export type Worker<OutputType> = (ctx: WorkContext) => Promise<OutputType>;

export class ActivityPool {
  public readonly events = new EventEmitter<ActivityPoolEvents>();

  private workerPool: Pool<WorkContext>;

  private logger: Logger;

  constructor(
    private modules: { activity: ActivityModule; payment: PaymentModule },
    private readonly agreementPool: AgreementPool,
    private options?: ActivityPoolOptions,
  ) {
    this.logger = this.logger = options?.logger || defaultLogger("activity-pool");
    const poolOptions =
      typeof options?.replicas === "number"
        ? { min: options?.replicas, max: MAX_REPLICAS }
        : typeof options?.replicas === "object"
          ? options?.replicas
          : { min: 0, max: MAX_REPLICAS };
    this.workerPool = createPool<WorkContext>(this.createPoolFactory(), {
      testOnBorrow: true,
      autostart: true,
      ...poolOptions,
    });
    this.workerPool.on("factoryCreateError", (error) => {
      this.events.emit(
        "error",
        new GolemWorkError(
          "Creating activity failed",
          WorkErrorCode.ActivityCreationFailed,
          undefined,
          undefined,
          undefined,
          error,
        ),
      );
      this.logger.error("Creating activity failed", error);
    });
    this.workerPool.on("factoryDestroyError", (error) => {
      this.events.emit(
        "error",
        new GolemWorkError(
          "Destroying activity failed",
          WorkErrorCode.ActivityCreationFailed,
          undefined,
          undefined,
          undefined,
          error,
        ),
      );
      this.logger.error("Destroying activity failed", error);
    });
  }

  async acquire(): Promise<WorkContext> {
    const activity = await this.workerPool.acquire();
    this.events.emit("acquired", activity.getDto());
    return activity;
  }

  async release(activity: WorkContext) {
    await this.workerPool.release(activity);
    this.events.emit("released", activity.getDto());
  }

  async destroy(activity: WorkContext) {
    await this.workerPool.destroy(activity);
    await this.agreementPool.destroy(activity.activity.agreement);
  }

  /**
   * Sets the pool into draining mode and then clears it
   *
   * When set to drain mode, no new acquires will be possible. At the same time, all activities in the pool will be destroyed on the Provider.
   *
   * @return Resolves when all activities in the pool are destroyed
   */
  async drainAndClear() {
    await this.workerPool.drain();
    await this.workerPool.clear();
    this.events.emit("end");
    return;
  }

  async runOnce<OutputType>(worker: Worker<OutputType>): Promise<OutputType> {
    const activity = await this.acquire();
    const result = await worker(activity);
    await this.release(activity);
    return result;
  }

  getSize() {
    return this.workerPool.size;
  }

  getBorrowed() {
    return this.workerPool.borrowed;
  }

  getPending() {
    return this.workerPool.pending;
  }

  getAvailable() {
    return this.workerPool.available;
  }

  /**
   * Wait till the pool is ready to use (min number of items in pool are usable)
   */
  ready(): Promise<void> {
    return this.workerPool.ready();
  }

  private createPoolFactory(): Factory<WorkContext> {
    return {
      create: async (): Promise<WorkContext> => {
        this.logger.debug("Creating new activity to add to pool");
        const agreement = await this.agreementPool.acquire();
        const activity = await this.modules.activity.createActivity(agreement);
        const ctx = await this.modules.activity.createWorkContext(activity);
        await ctx.before();
        this.events.emit("created", ctx.getDto());
        return ctx;
      },
      destroy: async (ctx: WorkContext) => {
        this.logger.debug("Destroying activity from the pool");
        await this.modules.activity.destroyActivity(ctx.activity);
        await this.agreementPool.release(ctx.activity.agreement);
        this.events.emit("destroyed", ctx.getDto());
      },
      validate: async (ctx: WorkContext) => {
        try {
          const state = await ctx.getState();
          const result = state !== ActivityStateEnum.Terminated;
          this.logger.debug("Validating activity in the pool.", { result, state });
          return result;
        } catch (err) {
          this.logger.error("Checking activity status failed. The activity will be removed from the pool", err);
          return false;
        }
      },
    };
  }
}
