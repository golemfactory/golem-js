import { Agreement } from "./agreement";
import { createPool, Factory, Options as GenericPoolOptions, Pool } from "generic-pool";
import { defaultLogger, Logger } from "../shared/utils";
import { ProposalPool } from "../market/pool";
import { BuildDemandParams, MarketModule, GolemMarketError, MarketErrorCode } from "../market";
import { AgreementDTO } from "./service";
import { EventEmitter } from "eventemitter3";
import { GolemUserError } from "../shared/error/golem-error";

export interface AgreementPoolOptions {
  logger?: Logger;
  marketModule: MarketModule;
  demandParams: BuildDemandParams;
  pool?: GenericPoolOptions;
}

export interface AgreementPoolEvents {
  ready: () => void;
  end: () => void;
  acquired: (agreement: AgreementDTO) => void;
  released: (agreement: AgreementDTO) => void;
  destroyed: (agreement: AgreementDTO) => void;
  error: (error: GolemMarketError) => void;
}

export class AgreementPool {
  public readonly events = new EventEmitter<AgreementPoolEvents>();

  private market: MarketModule;
  private agreementPool: Pool<Agreement>;
  private logger: Logger;
  private collectingProposals?: { pool: ProposalPool; cancel: () => void };

  constructor(private options: AgreementPoolOptions) {
    this.market = options.marketModule;
    this.logger = this.logger = options?.logger || defaultLogger("agreement-pool");

    this.agreementPool = createPool<Agreement>(this.createPoolFactory(), {
      autostart: false,
      testOnBorrow: true,
      ...options.pool,
    });
    this.agreementPool.on("factoryCreateError", (error) =>
      this.events.emit(
        "error",
        new GolemMarketError("Creating agreement failed", MarketErrorCode.AgreementCreationFailed, undefined, error),
      ),
    );
    this.agreementPool.on("factoryDestroyError", (error) =>
      this.events.emit(
        "error",
        new GolemMarketError(
          "Destroying agreement failed",
          MarketErrorCode.AgreementTerminationFailed,
          undefined,
          error,
        ),
      ),
    );
  }

  async start() {
    this.collectingProposals = await this.market.startCollectingProposal({ demandParams: this.options.demandParams });
    this.logger.info("Agreement Poll started");
    await this.agreementPool.ready();
    this.events.emit("ready");
    this.logger.info("Agreement Poll ready");
  }

  async stop(): Promise<void> {
    await this.agreementPool.drain();
    this.collectingProposals?.cancel();
    await this.agreementPool.clear();
    this.events.emit("end");
  }

  async acquire(): Promise<Agreement> {
    const agreement = await this.agreementPool.acquire();
    this.events.emit("acquired", agreement.getDto());
    return agreement;
  }

  async release(agreement: Agreement): Promise<void> {
    await this.agreementPool.release(agreement);
    this.events.emit("released", agreement.getDto());
  }

  async destroy(agreement: Agreement): Promise<void> {
    await this.agreementPool.destroy(agreement);
    this.events.emit("destroyed", agreement.getDto());
  }

  private createPoolFactory(): Factory<Agreement> {
    return {
      create: async (): Promise<Agreement> => {
        this.logger.debug("Creating new agreement to add to pool");
        if (!this.collectingProposals?.pool) {
          throw new GolemUserError("You need to start the poll first");
        }
        const proposal = await this.collectingProposals.pool.acquire();
        return this.market.proposeAgreement(proposal);
      },
      destroy: async (agreement: Agreement) => {
        this.logger.debug("Destroying agreement from the pool");
        await this.market.terminateAgreement(agreement);
        await this.collectingProposals?.pool.destroy(agreement.proposal);
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
