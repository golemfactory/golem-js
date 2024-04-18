import { Agreement, AgreementOptions } from "./agreement";
import { createPool, Factory, Options as GenericPoolOptions, Pool } from "generic-pool";
import { defaultLogger, Logger } from "../shared/utils";
import { DraftOfferProposalPool } from "../market/draft-offer-proposal-pool";
import { MarketModule, GolemMarketError, MarketErrorCode } from "../market";
import { AgreementDTO } from "./service";
import { EventEmitter } from "eventemitter3";
import { PaymentModule } from "../payment";

export interface AgreementPoolOptions {
  logger?: Logger;
  poolOptions?: GenericPoolOptions;
  agreementOptions?: AgreementOptions;
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

  private agreementPool: Pool<Agreement>;
  private logger: Logger;

  constructor(
    private modules: { market: MarketModule; payment: PaymentModule },
    private proposalPool: DraftOfferProposalPool,
    private options?: AgreementPoolOptions,
  ) {
    this.logger = this.logger = options?.logger || defaultLogger("agreement-pool");

    this.agreementPool = createPool<Agreement>(this.createPoolFactory(), {
      testOnBorrow: true,
      autostart: false,
      ...options?.poolOptions,
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

  async drain() {
    return this.agreementPool.drain();
  }

  private createPoolFactory(): Factory<Agreement> {
    return {
      create: async (): Promise<Agreement> => {
        this.logger.debug("Creating new agreement to add to pool");
        const proposal = await this.proposalPool.acquire();
        return this.modules.market.proposeAgreement(this.modules.payment, proposal, this.options?.agreementOptions);
      },
      destroy: async (agreement: Agreement) => {
        this.logger.debug("Destroying agreement from the pool");
        await this.modules.market.terminateAgreement(agreement);
        //@ts-expect-error TODO: make Agreement compatible with ProposalNew instead of Proposal
        await this.proposalPool.remove(agreement.proposal);
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
