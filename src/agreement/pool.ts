import { Agreement } from "./agreement";
import { createPool, Factory, Options as GenericPoolOptions, Pool } from "generic-pool";
import { defaultLogger, Logger } from "../shared/utils";
import { ProposalPool } from "../market/pool";
import { BuildDemandParams, MarketModule } from "../market/market.module";

interface AgreementPoolOptions {
  logger?: Logger;
  demand: BuildDemandParams;
  marketModule: MarketModule;
  pool?: GenericPoolOptions;
}

export class AgreementPool {
  private pool: Pool<Agreement>;
  private logger: Logger;
  private proposalPool: ProposalPool;

  constructor(private options: AgreementPoolOptions) {
    this.logger = this.logger = options?.logger || defaultLogger("market");
    this.proposalPool = new ProposalPool({ demand: options.demand, marketModule: options.marketModule });
    this.pool = createPool<Agreement>(this.createPoolFactory(), {
      autostart: false,
      testOnBorrow: true,
      ...options.pool,
    });
  }

  async start() {
    await this.proposalPool.start();
    this.logger.info("Agreement Poll started");
    await this.pool.ready();
    this.logger.info("Agreement Poll ready");
  }

  stop(): Promise<void> {
    return Promise.resolve(undefined);
  }

  acquire(): Promise<Agreement> {
    return this.pool.acquire();
  }

  release(agreement: Agreement): Promise<void> {
    return this.pool.release(agreement);
  }

  private createPoolFactory(): Factory<Agreement> {
    return {
      create: async (): Promise<Agreement> => {
        this.logger.debug("Creating new agreement to add to pool");
        const proposal = await this.proposalPool.acquire();
        return this.options.marketModule.proposeAgreement(proposal);
      },
      destroy: async (agreement: Agreement) => {
        this.logger.debug("Destroying agreement from the pool");
        await this.options.marketModule.terminateAgreement(agreement);
      },
      validate: async (agreement: Agreement) => {
        try {
          const state = await agreement.getState();
          const result = state !== "Approved";
          this.logger.debug("Validating agreement in the pool.", { result, state });
          return result;
        } catch (err) {
          this.logger.error("Checking agreement status failed. The agreement will be removed from the pool", err);
          return false;
        }
      },
    };
  }
}
