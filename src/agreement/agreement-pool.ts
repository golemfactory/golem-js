import { Agreement, AgreementOptions } from "./agreement";
import { createPool, Factory, Pool } from "generic-pool";
import { defaultLogger, Logger } from "../shared/utils";
import { DraftOfferProposalPool, GolemMarketError, MarketErrorCode, MarketModule } from "../market";
import { AgreementDTO } from "./service";
import { EventEmitter } from "eventemitter3";
import { PaymentModule } from "../payment";
import { RequireAtLeastOne } from "../shared/utils/types";

export interface AgreementPoolOptions {
  logger?: Logger;
  replicas?: number | RequireAtLeastOne<{ min: number; max: number }>;
  agreementOptions?: AgreementOptions;
}

export interface AgreementPoolEvents {
  ready: () => void;
  end: () => void;
  acquired: (agreement: AgreementDTO) => void;
  released: (agreement: AgreementDTO) => void;
  created: (agreement: AgreementDTO) => void;
  destroyed: (agreement: AgreementDTO) => void;
  error: (error: GolemMarketError) => void;
}

const MAX_REPLICAS = 100;

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

    const poolOptions =
      typeof options?.replicas === "number"
        ? { min: options?.replicas, max: MAX_REPLICAS }
        : typeof options?.replicas === "object"
          ? options?.replicas
          : { min: 0, max: MAX_REPLICAS };
    this.agreementPool = createPool<Agreement>(this.createPoolFactory(), {
      testOnBorrow: true,
      autostart: false,
      ...poolOptions,
    });
    this.agreementPool.on("factoryCreateError", (error) => {
      this.events.emit(
        "error",
        new GolemMarketError("Creating agreement failed", MarketErrorCode.AgreementCreationFailed, undefined, error),
      );
      this.logger.error("Creating agreement failed", error);
    });
    this.agreementPool.on("factoryDestroyError", (error) => {
      this.events.emit(
        "error",
        new GolemMarketError(
          "Destroying agreement failed",
          MarketErrorCode.AgreementTerminationFailed,
          undefined,
          error,
        ),
      );
      this.logger.error("Destroying agreement failed", error);
    });
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
  }

  /**
   * Sets the pool into draining mode and then clears it
   *
   * When set to drain mode, no new acquires will be possible. At the same time, all agreements in the pool will be terminated with the Providers.
   *
   * @return Resolves when all agreements are terminated
   */
  async drainAndClear() {
    await this.agreementPool.drain();
    await this.agreementPool.clear();
    this.events.emit("end");
    return;
  }

  getSize() {
    return this.agreementPool.size;
  }

  getBorrowed() {
    return this.agreementPool.borrowed;
  }

  getPending() {
    return this.agreementPool.pending;
  }

  getAvailable() {
    return this.agreementPool.available;
  }

  private createPoolFactory(): Factory<Agreement> {
    return {
      create: async (): Promise<Agreement> => {
        this.logger.debug("Creating new agreement to add to pool");
        const proposal = await this.proposalPool.acquire();
        const agreement = await this.modules.market.proposeAgreement(
          this.modules.payment,
          proposal,
          this.options?.agreementOptions,
        );
        this.events.emit("created", agreement.getDto());
        return agreement;
      },
      destroy: async (agreement: Agreement) => {
        this.logger.debug("Destroying agreement from the pool");
        await this.modules.market.terminateAgreement(agreement, "Finished");
        await this.proposalPool.remove(agreement.proposal);
        this.events.emit("destroyed", agreement.getDto());
      },
      validate: async (agreement: Agreement) => {
        try {
          const state = await agreement.getState();
          const result = state === "Approved";
          this.logger.debug("Validating agreement in the pool.", { result, state });
          return result;
        } catch (err) {
          this.logger.error("Checking agreement status failed. The agreement will be removed from the pool", err);
          return false;
        }
      },
    };
  }

  /**
   * Wait till the pool is ready to use (min number of items in pool are usable)
   */
  ready(): Promise<void> {
    return this.agreementPool.ready();
  }
}
