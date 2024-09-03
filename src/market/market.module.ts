import { EventEmitter } from "eventemitter3";
import { Agreement } from "./agreement";
import {
  Demand,
  DraftOfferProposalPool,
  GolemMarketError,
  IMarketApi,
  MarketErrorCode,
  MarketEvents,
  MarketProposalEvent,
  OfferProposalSelector,
} from "./index";
import {
  createAbortSignalFromTimeout,
  defaultLogger,
  Logger,
  runOnNextEventLoopIteration,
  YagnaApi,
} from "../shared/utils";
import { Allocation, IPaymentApi } from "../payment";
import { filter, map, Observable, OperatorFunction, switchMap, tap } from "rxjs";
import {
  OfferCounterProposal,
  OfferProposal,
  OfferProposalFilter,
  OfferProposalReceivedEvent,
  ProposalsBatch,
} from "./proposal";
import { DemandBodyBuilder, DemandSpecification, OrderDemandOptions } from "./demand";
import { IActivityApi, IFileServer } from "../activity";
import { StorageProvider } from "../shared/storage";
import { WorkloadDemandDirectorConfig } from "./demand/directors/workload-demand-director-config";
import { BasicDemandDirector } from "./demand/directors/basic-demand-director";
import { PaymentDemandDirector } from "./demand/directors/payment-demand-director";
import { WorkloadDemandDirector } from "./demand/directors/workload-demand-director";
import { WorkloadDemandDirectorConfigOptions } from "./demand/options";
import { BasicDemandDirectorConfig } from "./demand/directors/basic-demand-director-config";
import { PaymentDemandDirectorConfig } from "./demand/directors/payment-demand-director-config";
import { GolemAbortError, GolemTimeoutError, GolemUserError } from "../shared/error/golem-error";
import { MarketOrderSpec } from "../golem-network";
import { INetworkApi, NetworkModule } from "../network";
import { AgreementOptions } from "./agreement/agreement";
import { ScanDirector, ScanOptions, ScanSpecification, ScannedOffer } from "./scan";

export type DemandEngine = "vm" | "vm-nvidia" | "wasmtime";

export type PricingOptions =
  | {
      model: "linear";
      maxStartPrice: number;
      maxCpuPerHourPrice: number;
      maxEnvPerHourPrice: number;
    }
  | {
      model: "burn-rate";
      avgGlmPerHour: number;
    };

export interface OrderMarketOptions {
  /** How long you want to rent the resources in hours */
  rentHours: number;

  /** Pricing strategy that will be used to filter the offers from the market */
  pricing: PricingOptions;

  /** A user-defined filter function which will determine if the offer proposal is valid for use. */
  offerProposalFilter?: OfferProposalFilter;

  /** A user-defined function that will be used to pick the best fitting offer proposal from available ones */
  offerProposalSelector?: OfferProposalSelector;
}

export interface MarketModuleOptions {
  /**
   * Number of seconds after which the demand will be un-subscribed and subscribed again to get fresh
   * offers from the market
   *
   * @default 30 minutes
   */
  demandRefreshIntervalSec: number;
}

export interface MarketModule {
  events: EventEmitter<MarketEvents>;

  /**
   * Build a DemandSpecification based on the given options and allocation.
   * You can obtain an allocation using the payment module.
   * The method returns a DemandSpecification that can be used to publish the demand to the market,
   * for example using the `publishDemand` method.
   */
  buildDemandDetails(
    demandOptions: OrderDemandOptions,
    orderOptions: OrderMarketOptions,
    allocation: Allocation,
  ): Promise<DemandSpecification>;

  /**
   * Build a ScanSpecification that can be used to scan the market for offers.
   * The difference between this method and `buildDemandDetails` is that this method does not require an
   * allocation, doesn't inherit payment properties from `GolemNetwork` settings and doesn't provide any defaults.
   * If you wish to set the payment platform, you need to specify it in the ScanOptions.
   */
  buildScanSpecification(options: ScanOptions): ScanSpecification;

  /**
   * Publishes the demand to the market and handles refreshing it when needed.
   * Each time the demand is refreshed, a new demand is emitted by the observable.
   * Keep in mind that since this method returns an observable, nothing will happen until you subscribe to it.
   * Unsubscribing will remove the demand from the market.
   */
  publishAndRefreshDemand(demandSpec: DemandSpecification): Observable<Demand>;

  /**
   * Return an observable that will emit values representing various events related to this demand
   */
  collectMarketProposalEvents(demand: Demand): Observable<MarketProposalEvent>;

  /**
   * Subscribes to the proposals for the given demand.
   * If an error occurs, the observable will emit an error and complete.
   * Keep in mind that since this method returns an observable, nothing will happen until you subscribe to it.
   *
   * This method will just yield all the proposals that will be found for that demand without any additional logic.
   *
   * The {@link collectDraftOfferProposals} is a more specialized variant of offer collection, which includes negotiations
   *  and demand re-subscription logic
   */
  collectAllOfferProposals(demand: Demand): Observable<OfferProposal>;

  /**
   * Sends a counter-offer to the provider. Note that to get the provider's response to your
   * counter you should listen to events returned by `collectDemandOfferEvents`.
   *
   * @returns The counter-proposal that the requestor made to the Provider
   */
  negotiateProposal(
    receivedProposal: OfferProposal,
    counterDemandSpec: DemandSpecification,
  ): Promise<OfferCounterProposal>;

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
  proposeAgreement(proposal: OfferProposal): Promise<Agreement>;

  /**
   * @return The Agreement that has been terminated via Yagna
   */
  terminateAgreement(agreement: Agreement, reason?: string): Promise<Agreement>;

  /**
   * Acquire a proposal from the pool and sign an agreement with the provider. If signing the agreement fails,
   * destroy the proposal and try again with another one. The method returns an agreement that's ready to be used.
   * Optionally, you can provide a timeout in milliseconds or an AbortSignal that can be used to cancel the operation
   * early. If the operation is cancelled, the method will throw an error.
   * Note that this method will respect the acquire timeout set in the pool and will throw an error if no proposal
   * is available within the specified time.
   *
   * @example
   * ```ts
   * const agreement = await marketModule.signAgreementFromPool(draftProposalPool, 10_000); // throws TimeoutError if the operation takes longer than 10 seconds
   * ```
   * @example
   * ```ts
   * const signal = AbortSignal.timeout(10_000);
   * const agreement = await marketModule.signAgreementFromPool(draftProposalPool, signal); // throws TimeoutError if the operation takes longer than 10 seconds
   * ```
   * @param draftProposalPool - The pool of draft proposals to acquire from
   * @param agreementOptions - options used to sign the agreement such as expiration or waitingForApprovalTimeout
   * @param signalOrTimeout - The timeout in milliseconds or an AbortSignal that will be used to cancel the operation
   */
  signAgreementFromPool(
    draftProposalPool: DraftOfferProposalPool,
    agreementOptions?: AgreementOptions,
    signalOrTimeout?: number | AbortSignal,
  ): Promise<Agreement>;

  /**
   * Creates a demand for the given package and allocation and starts collecting, filtering and negotiating proposals.
   * The method returns an observable that emits a batch of draft proposals every time the buffer is full.
   * The method will automatically negotiate the proposals until they are moved to the `Draft` state.
   * Keep in mind that since this method returns an observable, nothing will happen until you subscribe to it.
   * Unsubscribing from the observable will stop the process and remove the demand from the market.
   */
  collectDraftOfferProposals(options: {
    demandSpecification: DemandSpecification;
    pricing: PricingOptions;
    filter?: OfferProposalFilter;
    minProposalsBatchSize?: number;
    proposalsBatchReleaseTimeoutMs?: number;
  }): Observable<OfferProposal>;

  /**
   * Estimate the budget for the given order and maximum numbers of agreemnets.
   * Keep in mind that this is just an estimate and the actual cost may vary.
   * The method returns the estimated budget in GLM.
   * @param params
   */
  estimateBudget({ maxAgreements, order }: { maxAgreements: number; order: MarketOrderSpec }): number;

  /**
   * Fetch the most up-to-date agreement details from the yagna
   */
  fetchAgreement(agreementId: string): Promise<Agreement>;

  /**
   * Scan the market for offers that match the given demand specification.
   */
  scan(scanSpecification: ScanSpecification): Observable<ScannedOffer>;
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
  public events = new EventEmitter<MarketEvents>();

  private readonly logger = defaultLogger("market");
  private readonly marketApi: IMarketApi;
  private fileServer: IFileServer;
  private options: MarketModuleOptions;

  constructor(
    private readonly deps: {
      logger: Logger;
      yagna: YagnaApi;
      paymentApi: IPaymentApi;
      activityApi: IActivityApi;
      marketApi: IMarketApi;
      networkApi: INetworkApi;
      networkModule: NetworkModule;
      fileServer: IFileServer;
      storageProvider: StorageProvider;
    },
    options?: Partial<MarketModuleOptions>,
  ) {
    this.logger = deps.logger;
    this.marketApi = deps.marketApi;
    this.fileServer = deps.fileServer;

    this.options = {
      ...{ demandRefreshIntervalSec: 30 * 60 },
      ...options,
    };

    this.collectAndEmitAgreementEvents();
  }

  async buildDemandDetails(
    demandOptions: OrderDemandOptions,
    orderOptions: OrderMarketOptions,
    allocation: Allocation,
  ): Promise<DemandSpecification> {
    const builder = new DemandBodyBuilder();

    // Instruct the builder what's required
    const basicConfig = new BasicDemandDirectorConfig({
      subnetTag: demandOptions.subnetTag,
    });

    const basicDirector = new BasicDemandDirector(basicConfig);
    basicDirector.apply(builder);

    const workloadOptions = demandOptions.workload
      ? await this.applyLocalGVMIServeSupport(demandOptions.workload)
      : demandOptions.workload;

    const expirationSec = orderOptions.rentHours * 60 * 60;

    /**
     * Default value on providers for MIN_AGREEMENT_EXPIRATION = 5min.
     * This means that if the user declares a rentHours time of less than 5 min,
     * offers will be rejected during negotiations with these providers.
     */
    const MIN_EXPIRATION_SEC_WARN = 5 * 60;

    if (expirationSec < MIN_EXPIRATION_SEC_WARN) {
      this.logger.warn(
        "The declared value of rentHours is less than 5 min. This may cause offers to be rejected during negotiations.",
      );
    }

    const workloadConfig = new WorkloadDemandDirectorConfig({
      ...workloadOptions,
      expirationSec,
    });
    const workloadDirector = new WorkloadDemandDirector(workloadConfig);
    await workloadDirector.apply(builder);

    const paymentConfig = new PaymentDemandDirectorConfig(demandOptions.payment);
    const paymentDirector = new PaymentDemandDirector(allocation, this.deps.marketApi, paymentConfig);
    await paymentDirector.apply(builder);

    return new DemandSpecification(builder.getProduct(), allocation.paymentPlatform);
  }

  buildScanSpecification(options: ScanOptions): ScanSpecification {
    const builder = new DemandBodyBuilder();
    const director = new ScanDirector(options);
    director.apply(builder);
    return builder.getProduct();
  }

  /**
   * Augments the user-provided options with additional logic
   *
   * Use Case: serve the GVMI from the requestor and avoid registry
   */
  private async applyLocalGVMIServeSupport(options: Partial<WorkloadDemandDirectorConfigOptions>) {
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

  /**
   * Publishes the specified demand and re-publishes it based on demandSpecification.expirationSec interval
   */
  publishAndRefreshDemand(demandSpecification: DemandSpecification): Observable<Demand> {
    return new Observable<Demand>((subscriber) => {
      let currentDemand: Demand;

      const subscribeToOfferProposals = async () => {
        try {
          currentDemand = await this.deps.marketApi.publishDemandSpecification(demandSpecification);
          subscriber.next(currentDemand);
          this.events.emit("demandSubscriptionStarted", {
            demand: currentDemand,
          });
          this.logger.debug("Subscribing for proposals matched with the demand", { demand: currentDemand });
          return currentDemand;
        } catch (err) {
          const golemMarketError = new GolemMarketError(
            `Could not publish demand on the market`,
            MarketErrorCode.SubscriptionFailed,
            err,
          );

          subscriber.error(golemMarketError);
        }
      };

      const unsubscribeFromOfferProposals = async (demand: Demand) => {
        try {
          await this.deps.marketApi.unpublishDemand(demand);
          this.logger.info("Unpublished demand", { demandId: demand.id });
          this.logger.debug("Unpublished demand", demand);
          this.events.emit("demandSubscriptionStopped", {
            demand,
          });
        } catch (err) {
          const golemMarketError = new GolemMarketError(
            `Could not publish demand on the market`,
            MarketErrorCode.SubscriptionFailed,
            err,
          );

          subscriber.error(golemMarketError);
        }
      };

      void subscribeToOfferProposals();

      const interval = setInterval(() => {
        Promise.all([unsubscribeFromOfferProposals(currentDemand), subscribeToOfferProposals()])
          .then(([, demand]) => {
            if (demand) {
              this.events.emit("demandSubscriptionRefreshed", {
                demand,
              });
              this.logger.info("Refreshed subscription for offer proposals with the new demand", { demand });
            }
          })
          .catch((err) => {
            this.logger.error("Error while re-publishing demand for offers", err);
            subscriber.error(err);
          });
      }, this.options.demandRefreshIntervalSec * 1000);

      return () => {
        clearInterval(interval);
        if (currentDemand) {
          void unsubscribeFromOfferProposals(currentDemand);
        }
      };
    });
  }

  collectMarketProposalEvents(demand: Demand): Observable<MarketProposalEvent> {
    return this.deps.marketApi.collectMarketProposalEvents(demand).pipe(
      tap((event) => this.logger.debug("Received demand offer event from yagna", { event })),
      tap((event) => this.emitMarketProposalEvents(event)),
    );
  }

  collectAllOfferProposals(demand: Demand): Observable<OfferProposal> {
    return this.collectMarketProposalEvents(demand).pipe(
      filter((event): event is OfferProposalReceivedEvent => event.type === "ProposalReceived"),
      map((event: OfferProposalReceivedEvent) => event.proposal),
    );
  }

  async negotiateProposal(
    offerProposal: OfferProposal,
    counterDemand: DemandSpecification,
  ): Promise<OfferCounterProposal> {
    try {
      const counterProposal = await this.deps.marketApi.counterProposal(offerProposal, counterDemand);
      this.logger.debug("Counter proposal sent", counterProposal);
      this.events.emit("offerCounterProposalSent", {
        offerProposal,
        counterProposal,
      });
      return counterProposal;
    } catch (error) {
      this.events.emit("errorSendingCounterProposal", {
        offerProposal,
        error,
      });
      throw error;
    }
  }

  async proposeAgreement(proposal: OfferProposal, options?: AgreementOptions): Promise<Agreement> {
    const agreement = await this.marketApi.proposeAgreement(proposal, options);

    this.logger.info("Proposed and got approval for agreement", {
      agreementId: agreement.id,
      provider: agreement.provider,
    });

    return agreement;
  }

  async terminateAgreement(agreement: Agreement, reason?: string): Promise<Agreement> {
    await this.marketApi.terminateAgreement(agreement, reason);

    this.logger.info("Terminated agreement", {
      agreementId: agreement.id,
      provider: agreement.provider,
      reason,
    });

    return agreement;
  }

  collectDraftOfferProposals(options: {
    demandSpecification: DemandSpecification;
    pricing: PricingOptions;
    filter?: OfferProposalFilter;
    minProposalsBatchSize?: number;
    proposalsBatchReleaseTimeoutMs?: number;
  }): Observable<OfferProposal> {
    return this.publishAndRefreshDemand(options.demandSpecification).pipe(
      // For each fresh demand, start to watch the related market conversation events
      switchMap((freshDemand) => this.collectMarketProposalEvents(freshDemand)),
      // Select only events for proposal received
      filter((event) => event.type === "ProposalReceived"),
      // Convert event to proposal
      map((event) => (event as OfferProposalReceivedEvent).proposal),
      // We are interested only in Initial and Draft proposals, that are valid
      filter((proposal) => (proposal.isInitial() || proposal.isDraft()) && proposal.isValid()),
      // If they are accepted by the pricing criteria
      filter((proposal) => this.filterProposalsByPricingOptions(options.pricing, proposal)),
      // If they are accepted by the user filter
      filter((proposal) => (options?.filter ? this.filterProposalsByUserFilter(options.filter, proposal) : true)),
      // Batch initial proposals and  deduplicate them by provider key, pass-though proposals in other states
      this.reduceInitialProposalsByProviderKey({
        minProposalsBatchSize: options?.minProposalsBatchSize,
        proposalsBatchReleaseTimeoutMs: options?.proposalsBatchReleaseTimeoutMs,
      }),
      // Tap-in negotiator logic and negotiate initial proposals
      tap((proposal) => {
        if (proposal.isInitial()) {
          this.negotiateProposal(proposal, options.demandSpecification).catch((err) =>
            this.logger.error("Failed to negotiate the proposal", err),
          );
        }
      }),
      // Continue only with drafts
      filter((proposal) => proposal.isDraft()),
    );
  }

  private emitMarketProposalEvents(event: MarketProposalEvent) {
    const { type } = event;
    switch (type) {
      case "ProposalReceived":
        this.events.emit("offerProposalReceived", {
          offerProposal: event.proposal,
        });
        break;
      case "ProposalRejected":
        this.events.emit("offerCounterProposalRejected", {
          counterProposal: event.counterProposal,
          reason: event.reason,
        });
        break;
      case "PropertyQueryReceived":
        this.events.emit("offerPropertyQueryReceived");
        break;
      default:
        this.logger.warn("Unsupported event type in event", { event });
        break;
    }
  }

  async signAgreementFromPool(
    draftProposalPool: DraftOfferProposalPool,
    agreementOptions?: AgreementOptions,
    signalOrTimeout?: number | AbortSignal,
  ): Promise<Agreement> {
    this.logger.info("Trying to sign an agreement...");
    const signal = createAbortSignalFromTimeout(signalOrTimeout);

    const getProposal = async () => {
      try {
        signal.throwIfAborted();
        this.logger.debug("Acquiring proposal from draft proposal pool", {
          draftPoolCounters: {
            total: draftProposalPool.count(),
            available: draftProposalPool.availableCount(),
          },
        });
        const proposal = await draftProposalPool.acquire(signal);
        this.logger.debug("Acquired proposal from the pool", { proposal });
        if (signal.aborted) {
          draftProposalPool.release(proposal);
          signal.throwIfAborted();
        }
        return proposal;
      } catch (error) {
        if (signal.aborted) {
          throw signal.reason.name === "TimeoutError"
            ? new GolemTimeoutError("Could not sign any agreement in time")
            : new GolemAbortError("The signing of the agreement has been aborted", error);
        }
        throw error;
      }
    };

    const tryProposing = async (): Promise<Agreement> => {
      const proposal = await getProposal();
      try {
        const agreement = await this.proposeAgreement(proposal, agreementOptions);
        // agreement is valid, proposal can be destroyed
        draftProposalPool.remove(proposal);
        return agreement;
      } catch (error) {
        this.logger.debug("Failed to propose agreement, retrying", { error });
        // We failed to propose the agreement, destroy the proposal and try again with another one
        draftProposalPool.remove(proposal);
        return runOnNextEventLoopIteration(tryProposing);
      }
    };
    return tryProposing();
  }

  /**
   * Reduce initial proposals to a set grouped by the provider's key to avoid duplicate offers
   */
  private reduceInitialProposalsByProviderKey(options?: {
    minProposalsBatchSize?: number;
    proposalsBatchReleaseTimeoutMs?: number;
  }): OperatorFunction<OfferProposal, OfferProposal> {
    return (input) =>
      new Observable((observer) => {
        let isCancelled = false;
        const proposalsBatch = new ProposalsBatch({
          minBatchSize: options?.minProposalsBatchSize,
          releaseTimeoutMs: options?.proposalsBatchReleaseTimeoutMs,
        });
        const subscription = input.subscribe((proposal) => {
          if (proposal.isInitial()) {
            proposalsBatch
              .addProposal(proposal)
              .catch((err) => this.logger.error("Failed to add the initial proposal to the batch", err));
          } else {
            observer.next(proposal);
          }
        });

        const batch = async () => {
          if (isCancelled) {
            return;
          }
          try {
            await proposalsBatch.waitForProposals();
            const proposals = await proposalsBatch.getProposals();
            if (proposals.length > 0) {
              this.logger.debug("Received batch of proposals", { count: proposals.length });
              proposals.forEach((proposal) => observer.next(proposal));
            }
          } catch (error) {
            observer.error(error);
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

  estimateBudget({ order, maxAgreements }: { order: MarketOrderSpec; maxAgreements: number }): number {
    const pricingModel = order.market.pricing.model;

    // TODO: Don't assume for the user, at least not on pure golem-js level
    const minCpuThreads = order.demand.workload?.minCpuThreads ?? 1;

    const { rentHours } = order.market;

    switch (pricingModel) {
      case "linear": {
        const { maxCpuPerHourPrice, maxStartPrice, maxEnvPerHourPrice } = order.market.pricing;

        const threadCost = maxAgreements * rentHours * minCpuThreads * maxCpuPerHourPrice;
        const startCost = maxAgreements * maxStartPrice;
        const envCost = maxAgreements * rentHours * maxEnvPerHourPrice;

        return startCost + envCost + threadCost;
      }
      case "burn-rate":
        return maxAgreements * rentHours * order.market.pricing.avgGlmPerHour;
      default:
        throw new GolemUserError(`Unsupported pricing model ${pricingModel}`);
    }
  }

  async fetchAgreement(agreementId: string): Promise<Agreement> {
    return this.marketApi.getAgreement(agreementId);
  }

  /**
   * Subscribes to an observable that maps yagna events into our domain events
   * and emits these domain events via EventEmitter
   */
  private collectAndEmitAgreementEvents() {
    this.marketApi.collectAgreementEvents().subscribe((event) => {
      switch (event.type) {
        case "AgreementApproved":
          this.events.emit("agreementApproved", {
            agreement: event.agreement,
          });
          break;
        case "AgreementCancelled":
          this.events.emit("agreementCancelled", {
            agreement: event.agreement,
          });
          break;
        case "AgreementTerminated":
          this.events.emit("agreementTerminated", {
            agreement: event.agreement,
            reason: event.reason,
            terminatedBy: event.terminatedBy,
          });
          break;
        case "AgreementRejected":
          this.events.emit("agreementRejected", {
            agreement: event.agreement,
            reason: event.reason,
          });
          break;
      }
    });
  }

  private filterProposalsByUserFilter(filter: OfferProposalFilter, proposal: OfferProposal) {
    try {
      const result = filter(proposal);

      if (!result) {
        this.events.emit("offerProposalRejectedByProposalFilter", {
          offerProposal: proposal,
        });
        this.logger.debug("The offer was rejected by the user filter", { id: proposal.id });
      }

      return result;
    } catch (err) {
      this.logger.error("Executing user provided proposal filter resulted with an error", err);
      throw err;
    }
  }

  private filterProposalsByPricingOptions(pricing: PricingOptions, proposal: OfferProposal) {
    let isPriceValid = true;
    if (pricing.model === "linear") {
      isPriceValid =
        proposal.pricing.cpuSec <= pricing.maxCpuPerHourPrice / 3600 &&
        proposal.pricing.envSec <= pricing.maxEnvPerHourPrice / 3600 &&
        proposal.pricing.start <= pricing.maxStartPrice;
    } else if (pricing.model === "burn-rate") {
      isPriceValid =
        proposal.pricing.start + proposal.pricing.envSec * 3600 + proposal.pricing.cpuSec * 3600 <=
        pricing.avgGlmPerHour;
    }
    if (!isPriceValid) {
      this.events.emit("offerProposalRejectedByPriceFilter", {
        offerProposal: proposal,
      });
      this.logger.debug("The offer was ignored because the price was too high", {
        id: proposal.id,
        pricing: proposal.pricing,
      });
    }
    return isPriceValid;
  }

  scan(scanSpecification: ScanSpecification): Observable<ScannedOffer> {
    return this.deps.marketApi.scan(scanSpecification);
  }
}
