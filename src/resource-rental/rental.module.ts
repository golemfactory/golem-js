import { ActivityModule } from "../activity";
import { Agreement, DraftOfferProposalPool, MarketModule } from "../market";
import { NetworkModule } from "../network";
import { Allocation, PaymentModule } from "../payment";
import { StorageProvider } from "../shared/storage";
import { Logger } from "../shared/utils";
import { ResourceRental, ResourceRentalOptions } from "./resource-rental";
import { ResourceRentalPool, ResourceRentalPoolOptions } from "./resource-rental-pool";

export interface RentalModule {
  /**
   * Factory that creates a new resource rental that's fully configured.
   * This method will also create the payment process for the agreement.
   *
   */
  createResourceRental(agreement: Agreement, allocation: Allocation, options?: ResourceRentalOptions): ResourceRental;
  /**
   * Factory that creates new resource rental pool that's fully configured
   */
  createResourceRentalPool(
    draftPool: DraftOfferProposalPool,
    allocation: Allocation,
    options: ResourceRentalPoolOptions,
  ): ResourceRentalPool;
}

export class RentalModuleImpl implements RentalModule {
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

  createResourceRental(agreement: Agreement, allocation: Allocation, options?: ResourceRentalOptions): ResourceRental {
    const paymentProcess = this.deps.paymentModule.createAgreementPaymentProcess(
      agreement,
      allocation,
      options?.payment,
    );
    const rental = new ResourceRental(
      agreement,
      this.deps.storageProvider,
      paymentProcess,
      this.deps.marketModule,
      this.deps.activityModule,
      this.deps.logger.child("resource-rental"),
      options,
    );
    return rental;
  }

  public createResourceRentalPool(
    draftPool: DraftOfferProposalPool,
    allocation: Allocation,
    options?: ResourceRentalPoolOptions,
  ): ResourceRentalPool {
    return new ResourceRentalPool({
      allocation,
      rentalModule: this,
      marketModule: this.deps.marketModule,
      networkModule: this.deps.networkModule,
      proposalPool: draftPool,
      resourceRentalOptions: options?.resourceRentalOptions,
      logger: this.deps.logger.child("resource-rental-pool"),
      network: options?.network,
      poolSize: options?.poolSize,
    });
  }
}
