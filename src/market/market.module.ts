/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventEmitter } from "eventemitter3";
import {
  Demand,
  DraftOfferProposalPool,
  GolemMarketError,
  MarketApi,
  MarketErrorCode,
  NewProposalEvent,
} from "./index";
import { Agreement, AgreementPool, AgreementPoolOptions, IActivityApi, IPaymentApi, LeaseProcess } from "../agreement";
import { defaultLogger, Logger, YagnaApi } from "../shared/utils";
import { Allocation } from "../payment";
import { bufferTime, filter, map, Observable, OperatorFunction, switchMap, tap } from "rxjs";
import { IProposalRepository, ProposalFilterNew, ProposalNew } from "./proposal";
import { DemandBodyBuilder } from "./demand/demand-body-builder";
import { IAgreementApi } from "../agreement/agreement";
import { BuildDemandOptions, DemandSpecification, IDemandRepository } from "./demand";
import { ProposalsBatch } from "./proposals_batch";
import { PayerDetails } from "../payment/PayerDetails";
import { IFileServer } from "../activity";
import { StorageProvider } from "../shared/storage";
import { ActivityDemandDirectorConfig } from "./demand/directors/activity-demand-director-config";
import { BasicDemandDirector } from "./demand/directors/basic-demand-director";
import { PaymentDemandDirector } from "./demand/directors/payment-demand-director";
import { ActivityDemandDirector } from "./demand/directors/activity-demand-director";
import { ActivityDemandDirectorConfigOptions } from "./demand/options";
import { BasicDemandDirectorConfig } from "./demand/directors/basic-demand-director-config";
import { PaymentDemandDirectorConfig } from "./demand/directors/payment-demand-director-config";

export interface MarketEvents {}

/**
 * Use by legacy demand publishing code
 */
export interface DemandBuildParams {
  demand: BuildDemandOptions;
  market: MarketOptions;
}

type DemandEngine = "vm" | "vm-nvidia" | "wasmtime";

export type PaymentSpec = {
  network: string;
  driver: "erc20";
  token?: "glm" | "tglm";
};

/**
 * Represents the new demand specification which is accepted by GolemNetwork and MarketModule
 */
export interface DemandSpec {
  demand: BuildDemandOptions;
  market: MarketOptions;
  payment: PaymentSpec;
}

export interface MarketOptions {
  /** How long you want to rent the resources in hours */
  rentHours?: number;

  pricing?: {
    maxStartPrice: number;
    maxCpuPerHourPrice: number;
    maxEnvPerHourPrice: number;
  };

  /** The payment network that should be considered while looking for providers and where payments will be done */
  paymentNetwork?: string;

  /**
   * List of provider Golem Node IDs that should be considered
   *
   * If not provided, the list will be pulled from: https://provider-health.golem.network/v1/provider-whitelist
   */
  withProviders?: string[];
  withoutProviders?: string[];
  withOperators?: string[];
  withoutOperators?: string[];
}

export interface MarketModule {
  events: EventEmitter<MarketEvents>;

  /**
   * Build a DemandSpecification based on the given options and payer details.
   * You can obtain the payer details from the payment module.
   * The method returns a DemandSpecification that can be used to publish the demand to the market,
   * for example using the `publishDemand` method.
   */
  buildDemandDetails(options: BuildDemandOptions, payerDetails: PayerDetails): Promise<DemandSpecification>;

  /**
   * Publishes the demand to the market and handles refreshing it when needed.
   * Each time the demand is refreshed, a new demand is emitted by the observable.
   * Keep in mind that since this method returns an observable, nothing will happen until you subscribe to it.
   * Unsubscribing will remove the demand from the market.
   */
  publishDemand(demandSpec: DemandSpecification): Observable<Demand>;

  /**
   * Subscribes to the proposals for the given demand.
   * If an error occurs, the observable will emit an error and complete.
   * Keep in mind that since this method returns an observable, nothing will happen until you subscribe to it.
   */
  subscribeForProposals(demand: Demand): Observable<ProposalNew>;

  /**
   * Sends a counter-offer to the provider. Note that to get the provider's response to your
   * counter you should listen to proposals sent to yagna using `subscribeForProposals`.
   */
  negotiateProposal(receivedProposal: ProposalNew, counterDemandSpec: DemandSpecification): Promise<ProposalNew>;

  /**
   * Internally
   *
   * - ya-ts-client createAgreement
   * - ya-ts-client approveAgreement
   * - ya-ts-client "wait for approval"
   *
   * @param proposal
   *
   * @return Returns when the provider accepts the agreement, rejects otherwise. The resulting agreement is ready to create activities from.
   */
  proposeAgreement(proposal: ProposalNew): Promise<Agreement>;

  /**
   * @return The Agreement that has been terminated via Yagna
   */
  terminateAgreement(agreement: Agreement, reason?: string): Promise<Agreement>;

  /**
   * Helper method that will allow reaching an agreement for the user without dealing with manual labour of demand/subscription
   */
  getAgreement(options: MarketOptions, filter: ProposalFilterNew): Promise<Agreement>;

  getAgreements(options: MarketOptions, filter: ProposalFilterNew, count: number): Promise<Agreement[]>;

  /**
   * Creates a demand for the given package and allocation and starts collecting, filtering and negotiating proposals.
   * The method returns an observable that emits a batch of draft proposals every time the buffer is full.
   * The method will automatically negotiate the proposals until they are moved to the `Draft` state.
   * Keep in mind that since this method returns an observable, nothing will happen until you subscribe to it.
   * Unsubscribing from the observable will stop the process and remove the demand from the market.
   */
  startCollectingProposals(options: {
    demandSpecification: DemandSpecification;
    filter?: ProposalFilterNew;
    bufferSize?: number;
  }): Observable<ProposalNew[]>;

  createLease(agreement: Agreement, allocation: Allocation): LeaseProcess;

  /**
   * Factory that creates new agreement pool that's fully configured
   */
  createAgreementPool(draftPool: DraftOfferProposalPool): AgreementPool;
}

/**
 * Represents a director that can instruct DemandDetailsBuilder
 *
 * Demand is a complex concept in Golem. Requestors can place arbitrary properties and constraints on such
 * market entity. While the demand request on the Golem Protocol level is a flat list of properties (key, value) and constraints,
 * from the Requestor side they form logical groups that make sense together.
 *
 * The idea behind Directors is that you can encapsulate this grouping knowledge along with validation logic etc to prepare
 * all the final demand request body properties in a more controlled and organized manner.
 */
export interface IDemandDirector {
  apply(builder: DemandBodyBuilder): Promise<void> | void;
}

export class MarketModuleImpl implements MarketModule {
  events: EventEmitter<MarketEvents> = new EventEmitter<MarketEvents>();

  private readonly yagnaApi: YagnaApi;
  private readonly logger = defaultLogger("market");
  private readonly agreementApi: IAgreementApi;
  private readonly proposalRepo: IProposalRepository;
  private readonly demandRepo: IDemandRepository;
  private fileServer: IFileServer;

  private defaultDemandExpirationSec = 60 * 60;

  constructor(
    private readonly deps: {
      logger: Logger;
      yagna: YagnaApi;
      agreementApi: IAgreementApi;
      proposalRepository: IProposalRepository;
      demandRepository: IDemandRepository;
      paymentApi: IPaymentApi;
      activityApi: IActivityApi;
      marketApi: MarketApi;
      fileServer: IFileServer;
      storageProvider: StorageProvider;
    },
  ) {
    this.logger = deps.logger;
    this.yagnaApi = deps.yagna;
    this.agreementApi = deps.agreementApi;
    this.proposalRepo = deps.proposalRepository;
    this.demandRepo = deps.demandRepository;
    this.fileServer = deps.fileServer;
  }

  async buildDemandDetails(options: BuildDemandOptions, payerDetails: PayerDetails): Promise<DemandSpecification> {
    const builder = new DemandBodyBuilder();

    // Instruct the builder what's required
    const basicConfig = new BasicDemandDirectorConfig(options.basic);
    const basicDirector = new BasicDemandDirector(basicConfig);
    basicDirector.apply(builder);

    const workloadOptions = options.activity
      ? await this.applyLocalGVMIServeSupport(options.activity)
      : options.activity;

    const workloadConfig = new ActivityDemandDirectorConfig(workloadOptions);
    const workloadDirector = new ActivityDemandDirector(workloadConfig);
    await workloadDirector.apply(builder);

    const paymentConfig = new PaymentDemandDirectorConfig(options.payment);
    const paymentDirector = new PaymentDemandDirector(payerDetails, paymentConfig);
    paymentDirector.apply(builder);

    const spec = new DemandSpecification(
      builder.getProduct(),
      payerDetails.getPaymentPlatform(),
      basicConfig.expirationSec,
    );

    return spec;
  }

  /**
   * Augments the user-provided options with additional logic
   *
   * Use Case: serve the GVMI from the requestor and avoid registry
   */
  private async applyLocalGVMIServeSupport(options: Partial<ActivityDemandDirectorConfigOptions>) {
    if (options.imageUrl?.startsWith("file://")) {
      const sourcePath = options.imageUrl?.replace("file://", "");

      const publishInfo = this.fileServer.getPublishInfo(sourcePath) ?? (await this.fileServer.publishFile(sourcePath));
      const { fileUrl: imageUrl, fileHash: imageHash } = publishInfo;

      this.logger.debug("Applied local GVMI serve support", {
        sourcePath,
        publishInfo,
      });

      return {
        ...options,
        imageUrl,
        imageHash,
      };
    }

    return options;
  }

  publishDemand(demandSpecification: DemandSpecification): Observable<Demand> {
    return new Observable<Demand>((subscriber) => {
      let currentDemand: Demand;

      const subscribeDemand = async () => {
        currentDemand = await this.deps.marketApi.publishDemandSpecification(demandSpecification);
        subscriber.next(currentDemand);
        this.logger.debug("Subscribing for proposals matched with the demand", { demand: currentDemand });
      };

      subscribeDemand().catch((err) =>
        subscriber.error(
          new GolemMarketError(`Could not publish demand on the market`, MarketErrorCode.SubscriptionFailed, err),
        ),
      );

      const interval = setInterval(() => {
        this.deps.marketApi
          .unpublishDemand(currentDemand)
          .catch((error) => this.logger.error("Failed to unpublish demand", error));
        subscribeDemand().catch((err) =>
          subscriber.error(
            new GolemMarketError(`Could not publish demand on the market`, MarketErrorCode.SubscriptionFailed, err),
          ),
        );
      }, demandSpecification.expirationSec * 1000);

      return () => {
        clearInterval(interval);
        if (currentDemand) {
          this.deps.marketApi.unpublishDemand(currentDemand).catch((error) => {
            this.logger.error("Failed to unpublish demand", error);
          });
        }
      };
    });
  }

  subscribeForProposals(demand: Demand): Observable<ProposalNew> {
    return this.deps.marketApi.observeProposalEvents(demand).pipe(
      // filter out proposal rejection events
      filter((event) => !("reason" in event)),
      // map proposal events to proposal models
      map((event) => new ProposalNew((event as NewProposalEvent).proposal, demand)),
    );
  }

  async negotiateProposal(receivedProposal: ProposalNew, offer: DemandSpecification): Promise<ProposalNew> {
    return this.deps.marketApi.counterProposal(receivedProposal, offer);
  }

  async proposeAgreement(proposal: ProposalNew): Promise<Agreement> {
    const agreement = await this.agreementApi.proposeAgreement(proposal);

    this.logger.info("Proposed and got approval for agreement", {
      agreementId: agreement.id,
      provider: agreement.getProviderInfo(),
    });

    return agreement;
  }

  async terminateAgreement(agreement: Agreement, reason?: string): Promise<Agreement> {
    await this.agreementApi.terminateAgreement(agreement, reason);

    this.logger.info("Terminated agreement", {
      agreementId: agreement.id,
      provider: agreement.getProviderInfo(),
      reason,
    });

    return agreement;
  }

  getAgreement(options: MarketOptions, filter: ProposalFilterNew): Promise<Agreement> {
    throw new Error("Method not implemented.");
  }

  getAgreements(options: MarketOptions, filter: ProposalFilterNew, count: number): Promise<Agreement[]> {
    throw new Error("Method not implemented.");
  }

  startCollectingProposals(options: {
    demandSpecification: DemandSpecification;
    filter?: ProposalFilterNew;
    bufferSize?: number;
    bufferTimeout?: number;
    minProposalsBatchSize?: number;
    proposalsBatchReleaseTimeoutMs?: number;
  }): Observable<ProposalNew[]> {
    return this.publishDemand(options.demandSpecification).pipe(
      // for each demand created -> start collecting all proposals
      switchMap((demand) => {
        this.demandRepo.add(demand);
        return this.subscribeForProposals(demand);
      }),
      // for each proposal collected -> filter out undesired and invalid ones
      filter((proposal) => proposal.isValid()),
      filter((proposal) => !options.filter || options.filter(proposal)),
      // for each proposal -> deduplicate them by provider key
      this.reduceInitialProposalsByProviderKey({
        minProposalsBatchSize: options?.minProposalsBatchSize,
        proposalsBatchReleaseTimeoutMs: options?.proposalsBatchReleaseTimeoutMs,
      }),
      // for each valid proposal -> start negotiating if it's not in draft state yet
      tap((proposal) => {
        if (proposal.isInitial()) {
          this.negotiateProposal(proposal, options.demandSpecification);
        }
      }),
      // for each proposal -> add them to the cache
      tap((proposal) => this.proposalRepo.add(proposal)),
      // for each proposal -> filter out all states other than draft
      filter((proposal) => proposal.isDraft()),
      // for each draft proposal -> add them to the buffer
      bufferTime(options.bufferTimeout ?? 1_000, null, options.bufferSize || 10),
      // filter out empty buffers
      filter((proposals) => proposals.length > 0),
    );
  }

  createLease(agreement: Agreement, allocation: Allocation) {
    // TODO Accept the filters
    return new LeaseProcess(
      agreement,
      allocation,
      this.deps.paymentApi,
      this.deps.activityApi,
      this.agreementApi,
      this.deps.logger,
      this.yagnaApi, // TODO: Remove this dependency
      this.deps.storageProvider,
    );
  }

  public createAgreementPool(draftPool: DraftOfferProposalPool, options?: AgreementPoolOptions): AgreementPool {
    return new AgreementPool(draftPool, this.agreementApi, options);
  }

  /**
   * Reduce initial proposals to a set grouped by the provider's key to avoid duplicate offers
   */
  private reduceInitialProposalsByProviderKey(options?: {
    minProposalsBatchSize?: number;
    proposalsBatchReleaseTimeoutMs?: number;
  }): OperatorFunction<ProposalNew, ProposalNew> {
    return (source) =>
      new Observable((destination) => {
        let isCancelled = false;
        const proposalsBatch = new ProposalsBatch({
          minBatchSize: options?.minProposalsBatchSize,
          releaseTimeoutMs: options?.proposalsBatchReleaseTimeoutMs,
        });
        const subscription = source.subscribe((proposal) => {
          if (proposal.isInitial()) {
            proposalsBatch.addProposal(proposal);
          } else {
            destination.next(proposal);
          }
        });
        const batch = async () => {
          if (isCancelled) {
            return;
          }
          this.logger.debug("Waiting for reduced proposals...");
          try {
            await proposalsBatch.waitForProposals();
            const proposals = await proposalsBatch.getProposals();
            this.logger.debug("Received batch of proposals", { count: proposals.length });
            proposals.forEach((proposal) => destination.next(proposal));
          } catch (error) {
            destination.error(error);
          }
          batch();
        };
        batch();
        return () => {
          isCancelled = true;
          subscription.unsubscribe();
        };
      });
  }
}
