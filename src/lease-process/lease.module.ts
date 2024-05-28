import { ActivityModule } from "../activity";
import { Agreement, DraftOfferProposalPool, MarketModule } from "../market";
import { NetworkModule } from "../network";
import { Allocation, PaymentModule } from "../payment";
import { StorageProvider } from "../shared/storage";
import { Logger } from "../shared/utils";
import { LeaseProcess, LeaseProcessOptions } from "./lease-process";
import { LeaseProcessPool, LeaseProcessPoolOptions } from "./lease-process-pool";

export interface LeaseModule {
  /**
   * Factory that creates a new lease process that's fully configured.
   * This method will also create and start the payment process for the agreement.
   *
   */
  createLease(agreement: Agreement, allocation: Allocation, options?: LeaseProcessOptions): LeaseProcess;
  /**
   * Factory that creates new lease process pool that's fully configured
   */
  createLeaseProcessPool(
    draftPool: DraftOfferProposalPool,
    allocation: Allocation,
    options?: LeaseProcessPoolOptions,
  ): LeaseProcessPool;
}

export class LeaseModuleImpl implements LeaseModule {
  constructor(
    private readonly deps: {
      marketModule: MarketModule;
      paymentModule: PaymentModule;
      activityModule: ActivityModule;
      networkModule: NetworkModule;
      storageProvider: StorageProvider;
      logger: Logger;
    },
  ) {}

  createLease(agreement: Agreement, allocation: Allocation, options?: LeaseProcessOptions): LeaseProcess {
    const paymentProcess = this.deps.paymentModule.createAgreementPaymentProcess(
      agreement,
      allocation,
      options?.payment,
    );
    const lease = new LeaseProcess(
      agreement,
      this.deps.storageProvider,
      paymentProcess,
      this.deps.marketModule,
      this.deps.activityModule,
      this.deps.logger.child("lease-process"),
      options,
    );
    paymentProcess.start();
    lease.events.once("finalized", () => {
      paymentProcess.stop();
    });
    return lease;
  }

  public createLeaseProcessPool(
    draftPool: DraftOfferProposalPool,
    allocation: Allocation,
    options?: LeaseProcessPoolOptions,
  ): LeaseProcessPool {
    return new LeaseProcessPool({
      allocation,
      leaseModule: this,
      marketModule: this.deps.marketModule,
      networkModule: this.deps.networkModule,
      proposalPool: draftPool,
      leaseProcessOptions: options?.leaseProcessOptions,
      logger: this.deps.logger.child("lease-process-pool"),
      network: options?.network,
      replicas: options?.replicas,
    });
  }
}
