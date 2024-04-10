import { Agreement } from "../agreement";
import { BuildDemandParams, MarketModule } from "./market.module";
import { createPool, Factory, Options as GenericPoolOptions, Pool } from "generic-pool";
import { defaultLogger, Logger, YagnaEventSubscription } from "../utils";
import { Proposal } from "./proposal";
import { GolemUserError } from "../error/golem-error";
import { GolemMarketError, MarketErrorCode } from "./error";
import { Demand } from "./demand";

interface AgreementPoolOptions {
  logger?: Logger;
  demand: BuildDemandParams;
  marketModule: MarketModule;
  pool?: GenericPoolOptions;
}

export class AgreementPool {
  private pool: Pool<Agreement>;
  private logger: Logger;
  private subscription?: YagnaEventSubscription<Proposal>;
  private demand?: Demand;

  constructor(private options: AgreementPoolOptions) {
    this.logger = this.logger = options?.logger || defaultLogger("market");
    this.pool = createPool<Agreement>(this.createPoolFactory(), {
      autostart: false,
      testOnBorrow: true,
      ...options.pool,
    });
  }

  async start() {
    this.demand = await this.options.marketModule.buildDemand(this.options.demand);
    this.subscription = this.options.marketModule.subscribeForProposals(this.demand);
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
        if (!this.subscription) {
          throw new GolemUserError("You need to start the pool first");
        }
        const proposal = await this.subscription.waitFor(() => true, { timeout: 10_000 });
        if (!proposal) {
          throw new GolemMarketError(
            "There are no offers available at the moment",
            MarketErrorCode.NoProposalAvailable,
            this.demand,
          );
        }
        const negotiatedProposal = await this.options.marketModule.negotiateProposal(proposal, proposal);
        return this.options.marketModule.proposeAgreement(negotiatedProposal);
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
