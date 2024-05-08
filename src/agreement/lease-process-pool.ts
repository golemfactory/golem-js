import { IAgreementApi, LegacyAgreementServiceOptions } from "./agreement";
import { defaultLogger, Logger } from "../shared/utils";
import { DraftOfferProposalPool, GolemMarketError, MarketErrorCode, MarketModule } from "../market";
import { AgreementDTO } from "./service";
import { EventEmitter } from "eventemitter3";
import { RequireAtLeastOne } from "../shared/utils/types";
import { Allocation } from "../payment";
import { IPaymentApi, LeaseProcess } from "./lease-process";
import { PriorityQueue } from "../shared/utils/PriorityQueue";

export interface LeaseProcessPoolDependencies {
  agreementApi: IAgreementApi;
  paymentApi: IPaymentApi;
  allocation: Allocation;
  proposalPool: DraftOfferProposalPool;
  marketModule: MarketModule;
}

export interface LeaseProcessPoolOptions {
  logger?: Logger;
  replicas?: number | RequireAtLeastOne<{ min: number; max: number }>;
  agreementOptions?: LegacyAgreementServiceOptions;
}

export interface LeaseProcessPoolEvents {
  ready: () => void;
  end: () => void;
  acquired: (agreement: AgreementDTO) => void;
  released: (agreement: AgreementDTO) => void;
  created: (agreement: AgreementDTO) => void;
  destroyed: (agreement: AgreementDTO) => void;
  error: (error: GolemMarketError) => void;
}

const MAX_REPLICAS = 100;

export class LeaseProcessPool {
  public readonly events = new EventEmitter<LeaseProcessPoolEvents>();

  private leaseProcessQueue: PriorityQueue<LeaseProcess>;
  private borrowed = new Set<LeaseProcess>();
  /**
   * Queue of functions that are waiting for a lease process to be available
   */
  private acquireQueue: Array<(lease: LeaseProcess) => void> = [];
  private isDraining = false;
  private logger: Logger;

  private allocation: Allocation;
  private agreementApi: IAgreementApi;
  private proposalPool: DraftOfferProposalPool;
  private marketModule: MarketModule;
  private readonly minPoolSize: number;
  private readonly maxPoolSize: number;

  constructor(options: LeaseProcessPoolOptions & LeaseProcessPoolDependencies) {
    this.agreementApi = options.agreementApi;
    this.allocation = options.allocation;
    this.proposalPool = options.proposalPool;
    this.marketModule = options.marketModule;

    this.logger = this.logger = options?.logger || defaultLogger("lease-process-pool");

    this.minPoolSize =
      (() => {
        if (typeof options?.replicas === "number") {
          return options?.replicas;
        }
        if (typeof options?.replicas === "object") {
          return options?.replicas.min;
        }
      })() || 0;

    this.maxPoolSize =
      (() => {
        if (typeof options?.replicas === "object") {
          return options?.replicas.max;
        }
      })() || MAX_REPLICAS;

    this.leaseProcessQueue = new PriorityQueue<LeaseProcess>((a, b) =>
      a.hasActivity() ? -1 : b.hasActivity() ? 1 : 0,
    );
  }

  private async createNewLeaseProcess() {
    this.logger.debug("Creating new lease process to add to pool");
    try {
      const proposal = await this.proposalPool.acquire();
      const agreement = await this.agreementApi.proposeAgreement(proposal);
      // After reaching an agreement, the proposal is useless
      await this.proposalPool.remove(proposal);
      const leaseProcess = this.marketModule.createLease(agreement, this.allocation);
      this.events.emit("created", agreement.getDto());
      return leaseProcess;
    } catch (error) {
      this.events.emit(
        "error",
        new GolemMarketError("Creating lease process failed", MarketErrorCode.LeaseProcessCreationFailed, error),
      );
      this.logger.error("Creating agreement failed", error);
      throw error;
    }
  }

  private async validate(leaseProcess: LeaseProcess) {
    try {
      // Reach for the most recent state in Yagna (source of truth)
      const state = await this.agreementApi
        .getAgreement(leaseProcess.agreement.id)
        .then((agreement) => agreement.getState());
      const result = state === "Approved";
      this.logger.debug("Validating lease process in the pool", { result, state });
      return result;
    } catch (err) {
      this.logger.error("Checking agreement status failed. The agreement will be removed from the pool", err);
      return false;
    }
  }

  private canCreateMoreLeaseProcesses() {
    return this.leaseProcessQueue.size() + this.borrowed.size < this.maxPoolSize;
  }

  /**
   * Take the first valid lease process from the pool
   * If there is no valid lease process, return null
   */
  private async takeValidLeaseProcess(): Promise<LeaseProcess | null> {
    const leaseProcess = this.leaseProcessQueue.pop();
    if (!leaseProcess) {
      return null;
    }
    const isValid = await this.validate(leaseProcess);
    if (!isValid) {
      await this.destroy(leaseProcess);
      return this.takeValidLeaseProcess();
    }
    return leaseProcess;
  }

  /**
   * Borrow a lease process from the pool. If there is no valid lease process a new one will be created.
   */
  async acquire(): Promise<LeaseProcess> {
    if (this.isDraining) {
      throw new Error("The pool is in draining mode");
    }
    let leaseProcess = await this.takeValidLeaseProcess();
    if (!leaseProcess) {
      if (!this.canCreateMoreLeaseProcesses()) {
        return new Promise((resolve) => {
          this.acquireQueue.push(resolve);
        });
      }
      leaseProcess = await this.createNewLeaseProcess();
    }
    this.borrowed.add(leaseProcess);
    this.events.emit("acquired", leaseProcess.agreement.getDto());
    return leaseProcess;
  }

  /**
   * If there are any acquires waiting in the queue, the lease process will be passed to the first one.
   * Otherwise, the lease process will be added to the queue.
   */
  private addLeaseProcessToQueue(leaseProcess: LeaseProcess) {
    if (this.acquireQueue.length > 0) {
      const acquire = this.acquireQueue.shift()!;
      acquire(leaseProcess);
      return;
    }
    this.leaseProcessQueue.push(leaseProcess);
  }

  async release(leaseProcess: LeaseProcess): Promise<void> {
    if (this.leaseProcessQueue.size() >= this.maxPoolSize) {
      return this.destroy(leaseProcess);
    }
    this.borrowed.delete(leaseProcess);
    const isValid = await this.validate(leaseProcess);
    if (!isValid) {
      return this.destroy(leaseProcess);
    }
    this.events.emit("released", leaseProcess.agreement.getDto());
    this.addLeaseProcessToQueue(leaseProcess);
  }

  async destroy(leaseProcess: LeaseProcess): Promise<void> {
    try {
      this.borrowed.delete(leaseProcess);
      this.logger.debug("Destroying lease process from the pool", { agreementId: leaseProcess.agreement.id });
      await leaseProcess.finalize();
      this.events.emit("destroyed", leaseProcess.agreement.getDto());
    } catch (error) {
      this.events.emit(
        "error",
        new GolemMarketError("Destroying lease process failed", MarketErrorCode.LeaseProcessTerminationFailed, error),
      );
      this.logger.error("Destroying lease process failed", error);
    }
  }

  /**
   * Sets the pool into draining mode and then clears it
   *
   * When set to drain mode, no new acquires will be possible. At the same time, all agreements in the pool will be terminated with the Providers.
   *
   * @return Resolves when all agreements are terminated
   */
  async drainAndClear() {
    this.isDraining = true;
    this.acquireQueue = [];
    const allLeaseProcesses = Array.from(this.borrowed).concat(this.leaseProcessQueue.toArray());
    await Promise.allSettled(allLeaseProcesses.map((leaseProcess) => this.destroy(leaseProcess)));
    this.leaseProcessQueue.clear();
    this.isDraining = false;
    this.events.emit("end");
    return;
  }

  getSize() {
    return this.leaseProcessQueue.size() + this.borrowed.size;
  }

  getAvailable() {
    return this.leaseProcessQueue.size();
  }

  getBorrowed() {
    return this.borrowed.size;
  }

  /**
   * Wait till the pool is ready to use (min number of items in pool are usable).
   * Optionally, you can pass an AbortSignal to cancel the operation.
   */
  async ready(abortSignal?: AbortSignal): Promise<void> {
    if (this.minPoolSize <= this.leaseProcessQueue.size()) {
      return;
    }
    const signal = abortSignal || AbortSignal.timeout(10_000);
    while (this.minPoolSize > this.leaseProcessQueue.size()) {
      if (signal.aborted) {
        break;
      }
      await Promise.allSettled(
        new Array(this.minPoolSize - this.leaseProcessQueue.size()).fill(0).map(() =>
          this.createNewLeaseProcess().then(
            (leaseProcess) => this.leaseProcessQueue.push(leaseProcess),
            (error) => this.logger.error("Creating lease process failed", error),
          ),
        ),
      );
    }

    if (this.minPoolSize > this.leaseProcessQueue.size()) {
      throw new Error("Could not create enough lease processes to reach the minimum pool size in time");
    }
    this.events.emit("ready");
  }
}
