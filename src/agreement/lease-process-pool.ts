import type { IAgreementApi, LegacyAgreementServiceOptions } from "./agreement";
import type { Logger } from "../shared/utils";
import { defaultLogger } from "../shared/utils";
import type { DraftOfferProposalPool, MarketModule } from "../market";
import { GolemMarketError, MarketErrorCode } from "../market";
import type { AgreementDTO } from "./service";
import { EventEmitter } from "eventemitter3";
import type { RequireAtLeastOne } from "../shared/utils/types";
import type { Allocation } from "../payment";
import type { IPaymentApi, LeaseProcess } from "./lease-process";

export interface LeaseProcessPoolDependencies {
  agreementApi: IAgreementApi;
  paymentApi: IPaymentApi;
  allocation: Allocation;
  proposalPool: DraftOfferProposalPool;
  marketModule: MarketModule;
  logger?: Logger;
}

export interface LeaseProcessPoolOptions {
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

  /**
   * Pool of lease processes that do not have an activity
   */
  private lowPriority = new Set<LeaseProcess>();
  /**
   * Pool of lease processes that have an activity
   */
  private highPriority = new Set<LeaseProcess>();
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
      this.logger.error("Creating lease process failed", error);
      throw error;
    }
  }

  private async validate(leaseProcess: LeaseProcess) {
    try {
      const state = await leaseProcess.fetchAgreementState();
      const result = state === "Approved";
      this.logger.debug("Validated lease process in the pool", { result, state });
      return result;
    } catch (err) {
      this.logger.error("Something went wrong while validating lease process, it will be destroyed", err);
      return false;
    }
  }

  private canCreateMoreLeaseProcesses() {
    return this.getSize() < this.maxPoolSize;
  }

  /**
   * Take the first valid lease process from the pool
   * If there is no valid lease process, return null
   */
  private async takeValidLeaseProcess(): Promise<LeaseProcess | null> {
    let leaseProcess: LeaseProcess | null = null;
    if (this.highPriority.size > 0) {
      leaseProcess = this.highPriority.values().next().value as LeaseProcess;
      this.highPriority.delete(leaseProcess);
    } else if (this.lowPriority.size > 0) {
      leaseProcess = this.lowPriority.values().next().value as LeaseProcess;
      this.lowPriority.delete(leaseProcess);
    }
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

  private async enqueueAcquire(): Promise<LeaseProcess> {
    return new Promise((resolve) => {
      this.acquireQueue.push((leaseProcess) => {
        this.borrowed.add(leaseProcess);
        this.events.emit("acquired", leaseProcess.agreement.getDto());
        resolve(leaseProcess);
      });
    });
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
        return this.enqueueAcquire();
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
  private passLeaseProcessToWaitingAcquireOrBackToPool(leaseProcess: LeaseProcess) {
    if (this.acquireQueue.length > 0) {
      const acquire = this.acquireQueue.shift()!;
      acquire(leaseProcess);
      return;
    }
    if (leaseProcess.hasActivity()) {
      this.highPriority.add(leaseProcess);
    } else {
      this.lowPriority.add(leaseProcess);
    }
  }

  async release(leaseProcess: LeaseProcess): Promise<void> {
    if (this.getAvailableSize() >= this.maxPoolSize) {
      return this.destroy(leaseProcess);
    }
    this.borrowed.delete(leaseProcess);
    const isValid = await this.validate(leaseProcess);
    if (!isValid) {
      return this.destroy(leaseProcess);
    }
    this.events.emit("released", leaseProcess.agreement.getDto());
    this.passLeaseProcessToWaitingAcquireOrBackToPool(leaseProcess);
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
    const allLeaseProcesses = Array.from(this.borrowed)
      .concat(Array.from(this.lowPriority))
      .concat(Array.from(this.highPriority));
    await Promise.allSettled(allLeaseProcesses.map((leaseProcess) => this.destroy(leaseProcess)));
    this.lowPriority.clear();
    this.highPriority.clear();
    this.borrowed.clear();
    this.isDraining = false;
    this.events.emit("end");
    return;
  }

  /**
   * Total size (available + borrowed)
   */
  getSize() {
    return this.getAvailableSize() + this.getBorrowedSize();
  }

  /**
   * Available size (how many lease processes are ready to be borrowed)
   */
  getAvailableSize() {
    return this.lowPriority.size + this.highPriority.size;
  }

  /**
   * Borrowed size (how many lease processes are currently out of the pool)
   */
  getBorrowedSize() {
    return this.borrowed.size;
  }

  /**
   * Wait till the pool is ready to use (min number of items in pool are usable).
   * Optionally, you can pass an AbortSignal to cancel the operation.
   * By default, this method will wait for 10 seconds before throwing an error.
   */
  async ready(abortSignal?: AbortSignal): Promise<void> {
    if (this.minPoolSize <= this.getAvailableSize()) {
      return;
    }
    const signal = abortSignal || AbortSignal.timeout(10_000);
    while (this.minPoolSize > this.getAvailableSize()) {
      if (signal.aborted) {
        break;
      }
      await Promise.allSettled(
        new Array(this.minPoolSize - this.getAvailableSize()).fill(0).map(() =>
          this.createNewLeaseProcess().then(
            (leaseProcess) => this.lowPriority.add(leaseProcess),
            (error) => this.logger.error("Creating lease process failed", error),
          ),
        ),
      );
    }

    if (this.minPoolSize > this.getAvailableSize()) {
      throw new Error("Could not create enough lease processes to reach the minimum pool size in time");
    }
    this.events.emit("ready");
  }
}
