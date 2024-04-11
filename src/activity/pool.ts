import { defaultLogger, Logger } from "../shared/utils";
import { BuildDemandParams, MarketModule } from "../market/market.module";
import { createPool, Factory, Options as GenericPoolOptions, Pool } from "generic-pool";
import { GolemWorkError, WorkContext, WorkErrorCode } from "./work";
import { ActivityStateEnum } from "./index";
import { ActivityModule } from "./activity.module";
import { AgreementPool } from "../agreement/pool";
import { ActivityDTO } from "./work/work";
import { EventEmitter } from "eventemitter3";

export interface ActivityPoolOptions {
  image: string;
  logger?: Logger;
  abortController?: AbortController;
  marketModule: MarketModule;
  activityModule: ActivityModule;
  demand: BuildDemandParams;
  pool?: GenericPoolOptions;
  agreementPool?: GenericPoolOptions;
  network?: string;
}

export interface ActivityPoolEvents {
  ready: () => void;
  end: () => void;
  acquired: (activity: ActivityDTO) => void;
  destroyed: (activity: ActivityDTO) => void;
  error: (error: GolemWorkError) => void;
}

export class ActivityPool {
  public readonly events = new EventEmitter<ActivityPoolEvents>();

  private activityPool: Pool<WorkContext>;
  private agreementPool: AgreementPool;
  private logger: Logger;

  constructor(private options: ActivityPoolOptions) {
    this.logger = this.logger = options?.logger || defaultLogger("activity-pool");
    this.agreementPool = new AgreementPool({
      demandParams: options.demand,
      marketModule: options.marketModule,
      pool: options.agreementPool,
    });
    this.activityPool = createPool<WorkContext>(this.createPoolFactory(), {
      autostart: false,
      testOnBorrow: true,
      max: options.pool?.max ?? options.pool?.min ?? 1,
      ...options.pool,
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

  async start() {
    await this.agreementPool.start();
    this.activityPool.start();
    this.logger.info("Activity Poll started");
    await this.activityPool.ready();
    this.events.emit("ready");
    this.logger.info("Activity Poll ready");
  }

  async stop() {
    await this.activityPool.drain();
    await this.agreementPool.stop();
    await this.activityPool.clear();
    this.events.emit("end");
  }

  async acquire(): Promise<WorkContext> {
    const activity = await this.activityPool.acquire();
    this.events.emit("acquired", activity.getDto());
    return activity;
  }

  async release(activity: WorkContext) {
    return this.activityPool.release(activity);
  }

  async destroy(activity: WorkContext) {
    await this.activityPool.destroy(activity);
    this.events.emit("destroyed", activity.getDto());
  }

  async drain() {
    return this.activityPool.drain();
  }

  private createPoolFactory(): Factory<WorkContext> {
    return {
      create: async (): Promise<WorkContext> => {
        this.logger.debug("Creating new activity to add to pool");
        const agreement = await this.agreementPool.acquire();
        return this.options.activityModule.createActivity(agreement);
      },
      destroy: async (activity: WorkContext) => {
        this.logger.debug("Destroying activity from the pool");
        await this.options.activityModule.destroyActivity(activity.activity);
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
