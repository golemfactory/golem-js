import { EventEmitter } from "eventemitter3";
import { Agreement } from "./agreement";
import {
  Demand,
  DraftOfferProposalPool,
  GolemMarketError,
  IMarketApi,
  IMarketEvents,
  MarketErrorCode,
  NewProposalEvent,
} from "./index";
import {
  createAbortSignalFromTimeout,
  defaultLogger,
  Logger,
  runOnNextEventLoopIteration,
  YagnaApi,
} from "../shared/utils";
import { Allocation, IPaymentApi } from "../payment";
import { catchError, filter, map, mergeMap, Observable, of, OperatorFunction, switchMap, tap } from "rxjs";
import { IProposalRepository, OfferProposal, ProposalFilter } from "./offer-proposal";
import { DemandBodyBuilder } from "./demand/demand-body-builder";
import { BuildDemandOptions, DemandSpecification, IDemandRepository } from "./demand";
import { ProposalsBatch } from "./proposals_batch";
import { IActivityApi, IFileServer } from "../activity";
import { StorageProvider } from "../shared/storage";
import { WorkloadDemandDirectorConfig } from "./demand/directors/workload-demand-director-config";
import { BasicDemandDirector } from "./demand/directors/basic-demand-director";
import { PaymentDemandDirector } from "./demand/directors/payment-demand-director";
import { WorkloadDemandDirector } from "./demand/directors/workload-demand-director";
import { WorkloadDemandDirectorConfigOptions } from "./demand/options";
import { BasicDemandDirectorConfig } from "./demand/directors/basic-demand-director-config";
import { PaymentDemandDirectorConfig } from "./demand/directors/payment-demand-director-config";
import { GolemUserError } from "../shared/error/golem-error";
import { MarketOrderSpec } from "../golem-network";
import { INetworkApi, NetworkModule } from "../network";

export interface IOfferProposalEvents {
  offerProposalSubscriptionRefreshed: (demand: Demand) => void;

  subscribedForOfferProposals: (demand: Demand) => void;
  unsubscribedForOfferProposals: (demand: Demand) => void;

  /** Fired when a proposal is received from yagna, and it passes the validation and de-duplication implemented by golem-js */
  offerProposalReceived: (offerProposal: OfferProposal) => void;
}

/**
 * Use by legacy demand publishing code
 */
export interface DemandBuildParams {
  demand: BuildDemandOptions;
  market: MarketOptions;
}

export type DemandEngine = "vm" | "vm-nvidia" | "wasmtime";

export interface MarketOptions {
  /** The maximum number of agreements that you want to make with the market */
  maxAgreements: number;

  /** How long you want to rent the resources in hours */
  rentHours: number;

  /** Pricing strategy that will be used to filter the offers from the market */
  pricing:
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

  /** An optional filter that can filter proposals from the market before signing an agreement */
  proposalFilter?: ProposalFilter;
}

export interface MarketModule {
  events: EventEmitter<IMarketEvents>;

  /**
   * Build a DemandSpecification based on the given options and allocation.
   * You can obtain an allocation using the payment module.
   * The method returns a DemandSpecification that can be used to publish the demand to the market,
   * for example using the `publishDemand` method.
   */
  buildDemandDetails(options: BuildDemandOptions, allocation: Allocation): Promise<DemandSpecification>;

  /**
   * Publishes the demand to the market and handles refreshing it when needed.
   * Each time the demand is refreshed, a new demand is emitted by the observable.
   * Keep in mind that since this method returns an observable, nothing will happen until you subscribe to it.
   * Unsubscribing will remove the demand from the market.
   */
  publishAndRefreshDemand(demandSpec: DemandSpecification): Observable<Demand>;

  /**
   * Subscribes to the proposals for the given demand.
   * If an error occurs, the observable will emit an error and complete.
   * Keep in mind that since this method returns an observable, nothing will happen until you subscribe to it.
   */
  observeOfferProposals(demand: Demand): Observable<OfferProposal>;

  /**
   * Sends a counter-offer to the provider. Note that to get the provider's response to your
   * counter you should listen to proposals sent to yagna using `subscribeForProposals`.
   *
   * @returns The counter-proposal that the requestor made to the Provider
   */
  negotiateProposal(receivedProposal: OfferProposal, counterDemandSpec: DemandSpecification): Promise<OfferProposal>;

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
   * @param timeout - The timeout in milliseconds or an AbortSignal that will be used to cancel the operation
   */
  signAgreementFromPool(
    draftProposalPool: DraftOfferProposalPool,
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
    filter?: ProposalFilter;
    minProposalsBatchSize?: number;
    proposalsBatchReleaseTimeoutMs?: number;
  }): Observable<OfferProposal>;

  /**
   * Provides a simple estimation of the budget that's required for given demand specification
   * @param params
   */
  estimateBudget(params: MarketOrderSpec): number;

  /**
   * Fetch the most up-to-date agreement details from the yagna
   */
  fetchAgreement(agreementId: string): Promise<Agreement>;
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
  public events = new EventEmitter<IMarketEvents>();

  private readonly logger = defaultLogger("market");
  private readonly marketApi: IMarketApi;
  private readonly proposalRepo: IProposalRepository;
  private readonly demandRepo: IDemandRepository;
  private fileServer: IFileServer;

  constructor(
    private readonly deps: {
      logger: Logger;
      yagna: YagnaApi;
      proposalRepository: IProposalRepository;
      demandRepository: IDemandRepository;
      paymentApi: IPaymentApi;
      activityApi: IActivityApi;
      marketApi: IMarketApi;
      networkApi: INetworkApi;
      networkModule: NetworkModule;
      fileServer: IFileServer;
      storageProvider: StorageProvider;
    },
  ) {
    this.logger = deps.logger;
    this.marketApi = deps.marketApi;
    this.proposalRepo = deps.proposalRepository;
    this.demandRepo = deps.demandRepository;
    this.fileServer = deps.fileServer;

    this.observeAndEmitAgreementEvents();
  }

  async buildDemandDetails(options: BuildDemandOptions, allocation: Allocation): Promise<DemandSpecification> {
    const builder = new DemandBodyBuilder();

    // Instruct the builder what's required
    const basicConfig = new BasicDemandDirectorConfig({
      expirationSec: options.expirationSec,
      subnetTag: options.subnetTag,
    });

    const basicDirector = new BasicDemandDirector(basicConfig);
    basicDirector.apply(builder);

    const workloadOptions = options.workload
      ? await this.applyLocalGVMIServeSupport(options.workload)
      : options.workload;

    const workloadConfig = new WorkloadDemandDirectorConfig(workloadOptions);
    const workloadDirector = new WorkloadDemandDirector(workloadConfig);
    await workloadDirector.apply(builder);

    const paymentConfig = new PaymentDemandDirectorConfig(options.payment);
    const paymentDirector = new PaymentDemandDirector(allocation, this.deps.marketApi, paymentConfig);
    await paymentDirector.apply(builder);

    return new DemandSpecification(builder.getProduct(), allocation.paymentPlatform, basicConfig.expirationSec);
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
          this.demandRepo.add(currentDemand);
          subscriber.next(currentDemand);
          this.events.emit("subscribedToOfferProposals", currentDemand);
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
          this.logger.info("Demand unpublished from the market", { demand });
          this.events.emit("unsubscribedFromOfferProposals", demand);
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
              this.events.emit("refreshedOfferProposalSubscription", demand);
              this.logger.info("Refreshed subscription for offer proposals with the new demand", { demand });
            }
          })
          .catch((err) => {
            this.logger.error("Error while re-publishing demand for offers", err);
            subscriber.error(err);
          });
      }, demandSpecification.expirationSec * 1000);

      return () => {
        clearInterval(interval);
        if (currentDemand) {
          void unsubscribeFromOfferProposals(currentDemand);
        }
      };
    });
  }

  /** @deprecated Will be removed, and is replaced by observeDraftOfferProposal */
  observeOfferProposals(demand: Demand): Observable<OfferProposal> {
    return this.deps.marketApi.observeProposalEvents(demand).pipe(
      tap((event) => this.logger.debug("Received proposal event from yagna", { event })),
      // filter out proposal rejection events
      filter((event) => !("reason" in event)),
      // try to map the events to proposal entity, but be ready for validation errors
      mergeMap((event) => {
        return of(event).pipe(
          map((event) => new OfferProposal((event as NewProposalEvent).proposal, "Provider", demand)),
          // in case of a validation error return a null value from the pipe
          catchError((err) => {
            this.logger.error("Failed to map the yagna proposal event to Proposal entity", err);
            return of();
          }),
        );
      }),
    );
  }

  async negotiateProposal(offerProposal: OfferProposal, counterDemand: DemandSpecification): Promise<OfferProposal> {
    const counterProposal = await this.deps.marketApi.counterProposal(offerProposal, counterDemand);

    this.logger.debug("Counter proposal sent", counterProposal);

    return counterProposal;
  }

  async proposeAgreement(proposal: OfferProposal): Promise<Agreement> {
    const agreement = await this.marketApi.proposeAgreement(proposal);

    this.logger.info("Proposed and got approval for agreement", {
      agreementId: agreement.id,
      provider: agreement.getProviderInfo(),
    });

    return agreement;
  }

  async terminateAgreement(agreement: Agreement, reason?: string): Promise<Agreement> {
    await this.marketApi.terminateAgreement(agreement, reason);

    this.logger.info("Terminated agreement", {
      agreementId: agreement.id,
      provider: agreement.getProviderInfo(),
      reason,
    });

    return agreement;
  }

  /**
   * @inheritDoc
   *
   * ---
   *
   * NOTE: This method actually implements a negotiator that produces acceptable draft offers
   */
  collectDraftOfferProposals(options: {
    demandSpecification: DemandSpecification;
    filter?: ProposalFilter;
    minProposalsBatchSize?: number;
    proposalsBatchReleaseTimeoutMs?: number;
  }): Observable<OfferProposal> {
    // Utility predicates
    const acceptByUserFilter = (proposal: OfferProposal) => {
      if (options.filter) {
        try {
          const result = options.filter(proposal);

          if (!result) {
            this.events.emit("offerProposalRejectedByFilter", proposal);
          }

          return result;
        } catch (err) {
          this.logger.error("Executing user provided proposal filter resulted with an error", err);
          throw err;
        }
      }

      return true;
    };
    const rememberProposal = (proposal: OfferProposal) => this.proposalRepo.add(proposal);

    // Initialize the process of continuous demand re-subscription for fresh offers from the market
    // Oder of transformation = Demand -> OfferProposal(status=Draft)[]

    return this.publishAndRefreshDemand(options.demandSpecification).pipe(
      // For each fresh demand, start to watch the related market conversation events
      switchMap((freshDemand) => this.marketApi.observeDemandResponse(freshDemand)),
      // Pluck the proposal received events, notify about the rest
      switchMap(
        (event) =>
          // Negotiator Observable who has side effects and its main product: acceptable draft offers
          new Observable<OfferProposal>((observer) => {
            const { type } = event;
            switch (type) {
              case "ProposalReceived":
                this.events.emit("offerProposalReceived", event.proposal);
                observer.next(event.proposal);
                break;
              case "ProposalRejected":
                this.events.emit("counterProposalRejectedByProvider", event.proposal, event.reason);
                break;
              case "PropertyQueryReceived":
                this.events.emit("propertyQueryReceived");
                break;
              default:
                this.logger.warn("Unsupported event type", type);
                break;
            }
          }),
      ),
      // Always memorize the proposals that we got, then execute further processing
      tap(rememberProposal),
      // We are interested only in Initial and Draft proposals
      filter((proposal) => proposal.isInitial() || proposal.isDraft()),
      // for each proposal -> deduplicate them by provider key
      this.reduceInitialProposalsByProviderKey({
        minProposalsBatchSize: options?.minProposalsBatchSize,
        proposalsBatchReleaseTimeoutMs: options?.proposalsBatchReleaseTimeoutMs,
      }),
      // Tap-in negotiator logic and negotiate initials
      tap((proposal) => {
        if (proposal.isInitial()) {
          this.negotiateProposal(proposal, options.demandSpecification).catch((err) =>
            this.logger.error("Failed to negotiate the proposal", err),
          );
        }
      }),
      // Continue only with drafts
      filter((proposal) => proposal.isDraft()),
      // If they are accepted by the user filter
      filter(acceptByUserFilter),
    );
  }

  async signAgreementFromPool(
    draftProposalPool: DraftOfferProposalPool,
    signalOrTimeout?: number | AbortSignal,
  ): Promise<Agreement> {
    const signal = createAbortSignalFromTimeout(signalOrTimeout);

    const tryProposing = async (): Promise<Agreement> => {
      signal.throwIfAborted();
      const proposal = await draftProposalPool.acquire();
      if (signal.aborted) {
        await draftProposalPool.release(proposal);
        signal.throwIfAborted();
      }

      try {
        const agreement = await this.proposeAgreement(proposal);
        // agreement is valid, proposal can be destroyed
        await draftProposalPool.remove(proposal).catch((error) => {
          this.logger.warn("Signed the agreement but failed to remove the proposal from the pool", { error });
        });
        return agreement;
      } catch (error) {
        this.logger.debug("Failed to propose agreement, retrying", { error });
        // We failed to propose the agreement, destroy the proposal and try again with another one
        await draftProposalPool.remove(proposal).catch((error) => {
          this.logger.warn("Failed to remove the proposal from the pool after unsuccessful agreement proposal", {
            error,
          });
        });
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
          this.logger.debug("Waiting for reduced proposals...");
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

  estimateBudget(params: MarketOrderSpec): number {
    const pricingModel = params.market.pricing.model;

    // TODO: Don't assume for the user, at least not on pure golem-js level
    const minCpuThreads = params.demand.workload?.minCpuThreads ?? 1;

    const { rentHours, maxAgreements } = params.market;

    switch (pricingModel) {
      case "linear": {
        const { maxCpuPerHourPrice, maxStartPrice, maxEnvPerHourPrice } = params.market.pricing;

        const threadCost = maxAgreements * rentHours * minCpuThreads * maxCpuPerHourPrice;
        const startCost = maxAgreements * maxStartPrice;
        const envCost = maxAgreements * rentHours * maxEnvPerHourPrice;

        return startCost + envCost + threadCost;
      }
      case "burn-rate":
        return maxAgreements * rentHours * params.market.pricing.avgGlmPerHour;
      default:
        throw new GolemUserError(`Unsupported pricing model ${pricingModel}`);
    }
  }

  async fetchAgreement(agreementId: string): Promise<Agreement> {
    return this.marketApi.getAgreement(agreementId);
  }

  private observeAndEmitAgreementEvents() {
    this.marketApi.observeAgreementEvents().subscribe((event) => {
      switch (event.type) {
        case "AgreementConfirmed":
          this.events.emit("agreementConfirmed", event.agreement);
          break;
        case "AgreementCancelled":
          this.events.emit("agreementCancelled", event.agreement);
          break;
        case "AgreementTerminated":
          this.events.emit("agreementTerminated", event.agreement, event.terminatedBy, event.reason);
          break;
        case "AgreementRejected":
          this.events.emit("agreementRejected", event.agreement, event.reason);
          break;
      }
    });
  }
}
