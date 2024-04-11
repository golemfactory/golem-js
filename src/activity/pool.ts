import { defaultLogger, Logger } from "../shared/utils";
import { BuildDemandParams, MarketModule } from "../market/market.module";
import { createPool, Factory, Options as GenericPoolOptions, Pool } from "generic-pool";
import { WorkContext } from "./work";
import { ActivityStateEnum } from "./index";
import { ActivityModule } from "./activity.module";
import { AgreementPool } from "../agreement/pool";

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

export class ActivityPool {
  private agreementPool: AgreementPool;
  private pool: Pool<WorkContext>;
  private logger: Logger;

  constructor(private options: ActivityPoolOptions) {
    this.logger = this.logger = options?.logger || defaultLogger("work");
    this.agreementPool = new AgreementPool({
      demand: options.demand,
      marketModule: options.marketModule,
      pool: options.agreementPool,
    });
    this.pool = createPool<WorkContext>(this.createPoolFactory(), {
      autostart: false,
      testOnBorrow: true,
      ...options.pool,
    });
  }

  async start() {
    await this.agreementPool.start();
    this.pool.start();
    this.logger.info("Activity Poll started");
    await this.pool.ready();
    this.logger.info("Activity Poll ready");
  }

  async stop() {
    // todo
  }

  async acquire(): Promise<WorkContext> {
    return this.pool.acquire();
  }

  async release(activity: WorkContext) {
    return this.pool.release(activity);
  }

  async destroy() {
    // todo
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
