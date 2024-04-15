import { defaultLogger, Logger } from "../shared/utils";
import { createPool, Factory, Options as GenericPoolOptions, Pool } from "generic-pool";
import { GolemWorkError, WorkContext, WorkErrorCode } from "./work";
import { ActivityOptions, ActivityStateEnum } from "./index";
import { ActivityModule } from "./activity.module";
import { AgreementPool } from "../agreement";
import { ActivityDTO } from "./work/work";
import { EventEmitter } from "eventemitter3";
import { PaymentModule } from "../payment";

/**
 * TODO: specify clear and user-friendly options
 */
export interface ActivityPoolOptions {
  logger?: Logger;
  replicas?: GenericPoolOptions;
  activityOptions?: ActivityOptions;
}

export interface ActivityPoolEvents {
  ready: () => void;
  end: () => void;
  acquired: (activity: ActivityDTO) => void;
  released: (activity: ActivityDTO) => void;
  destroyed: (activity: ActivityDTO) => void;
  error: (error: GolemWorkError) => void;
}

export type Worker<OutputType> = (ctx: WorkContext) => Promise<OutputType>;

export class ActivityPool {
  public readonly events = new EventEmitter<ActivityPoolEvents>();

  private activityPool: Pool<WorkContext>;
  private logger: Logger;

  constructor(
    private modules: { activity: ActivityModule; payment: PaymentModule },
    private agreementPool: AgreementPool,
    private options?: ActivityPoolOptions,
  ) {
    this.logger = this.logger = options?.logger || defaultLogger("activity-pool");
    this.activityPool = createPool<WorkContext>(this.createPoolFactory(), {
      testOnBorrow: true,
      ...options?.replicas,
    });
    this.activityPool.on("factoryCreateError", (error) =>
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
      ),
    );
    this.activityPool.on("factoryDestroyError", (error) =>
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
      ),
    );
  }

  async acquire(): Promise<WorkContext> {
    const activity = await this.activityPool.acquire();
    this.events.emit("acquired", activity.getDto());
    return activity;
  }

  async release(activity: WorkContext) {
    await this.activityPool.release(activity);
    this.events.emit("released", activity.getDto());
  }

  async destroy(activity: WorkContext) {
    await this.activityPool.destroy(activity);
    this.events.emit("destroyed", activity.getDto());
  }

  async drain() {
    return this.activityPool.drain();
  }

  async runOnce<OutputType>(worker: Worker<OutputType>): Promise<OutputType> {
    const activity = await this.acquire();
    const result = await worker(activity);
    await this.release(activity);
    return result;
  }

  getSize() {
    return this.activityPool.size;
  }

  getBorrowed() {
    return this.activityPool.borrowed;
  }

  getAvailable() {
    return this.activityPool.available;
  }

  private createPoolFactory(): Factory<WorkContext> {
    return {
      create: async (): Promise<WorkContext> => {
        this.logger.debug("Creating new activity to add to pool");
        const agreement = await this.agreementPool.acquire();
        return this.modules.activity.createActivity(this.modules.payment, agreement);
      },
      destroy: async (activity: WorkContext) => {
        this.logger.debug("Destroying activity from the pool");
        await this.modules.activity.destroyActivity(activity.activity);
        await this.agreementPool.release(activity.activity.agreement);
      },
      validate: async (activity: WorkContext) => {
        try {
          const state = await activity.getState();
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
