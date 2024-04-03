import { Activity } from "../../activity";
import { AgreementPoolService } from "../../agreement";
import { MarketService, Proposal, ProposalFilter } from "../../market";
import { PaymentService } from "../../payment";
import {
  GftpStorageProvider,
  NullStorageProvider,
  StorageProvider,
  WebSocketBrowserStorageProvider,
} from "../../storage";
import { GolemAbortError, GolemUserError } from "../../error/golem-error";
import { defaultLogger, Logger, runtimeContextChecker, YagnaApi } from "../../utils";
import { ActivityPoolOptions, ActivityPoolEvents, ActivityPoolState } from "./types";
import { Package } from "../../package";
import { WorkContext } from "../../work";
import { EventEmitter } from "eventemitter3";

/**
 * @experimental This feature is experimental!!!
 */
export class ActivityPool {
  readonly events = new EventEmitter<ActivityPoolEvents>();

  private state: ActivityPoolState = ActivityPoolState.INITIAL;

  private readonly logger: Logger;
  private readonly abortController: AbortController;

  private readonly yagnaApi: YagnaApi;
  private readonly agreementService: AgreementPoolService;
  private readonly marketService: MarketService;
  private readonly paymentService: PaymentService;
  private readonly storageProvider: StorageProvider;

  private readonly activities = new Map<string, WorkContext>();

  // private readonly networks: Network[] = [];
  // private readonly managedNetwork?: Network;

  constructor(private readonly options: ActivityPoolOptions) {
    this.logger = options.logger ?? defaultLogger("backend");
    this.abortController = options.abortController ?? new AbortController();

    this.abortController.signal.addEventListener("abort", () => {
      this.logger.info("Abort signal received");
      this.stop().catch((e) => {
        this.logger.error("stop() error on abort", { error: e });
        // TODO: should the error be sent to event listener?
      });
    });

    this.yagnaApi = new YagnaApi({
      apiKey: options.api?.key,
      basePath: options.api?.url,
    });

    this.agreementService = new AgreementPoolService(this.yagnaApi, {
      logger: this.logger.child("agreement"),
    });

    this.marketService = new MarketService(this.agreementService, this.yagnaApi, {
      expirationSec: this.getExpectedDurationSeconds(),
      logger: this.logger.child("market"),
      proposalFilter: this.buildProposalFilter(),
    });

    this.paymentService = new PaymentService(this.yagnaApi, {
      logger: this.logger.child("payment"),
      payment: {
        network: this.options.market.paymentNetwork,
      },
    });

    if (runtimeContextChecker.isNode) {
      this.storageProvider = new GftpStorageProvider(this.logger.child("storage"));
    } else if (runtimeContextChecker.isBrowser) {
      this.storageProvider = new WebSocketBrowserStorageProvider(this.yagnaApi, {
        logger: this.logger.child("storage"),
      });
    } else {
      this.storageProvider = new NullStorageProvider();
    }
  }

  getState(): ActivityPoolState {
    return this.state;
  }

  async start() {
    if (this.abortController.signal.aborted) {
      throw new GolemAbortError("Calling start after abort signal received");
    }

    if (this.state != ActivityPoolState.INITIAL) {
      throw new GolemUserError(`Cannot start backend, expected backend state INITIAL, current state is ${this.state}`);
    }

    this.state = ActivityPoolState.STARTING;

    // FIXME: use abort controller.
    try {
      const allocation = await this.paymentService.createAllocation({
        budget: this.getBudgetEstimate(),
        expirationSec: this.getExpectedDurationSeconds(),
      });

      if (this.abortController.signal.aborted) {
        // ignore promises
        throw new GolemAbortError("Operation aborted by user");
      }

      const workload = Package.create({
        imageTag: this.options.image,
        minMemGib: this.options.resources?.minMemGib,
        minCpuCores: this.options.resources?.minCpu,
        minCpuThreads: this.options.resources?.minCpu,
        minStorageGib: this.options.resources?.minStorageGib,
        logger: this.logger.child("package"),
      });

      await Promise.all([
        this.agreementService.run(),
        // TODO: I should be able to start the service, but pass the workload and allocation later - market.postDemand(???)
        // TODO: I should be able to specify the proposal filter here, and not on the constructor level
        this.marketService.run(workload, allocation),
        this.paymentService.run(),
      ]);
      this.state = ActivityPoolState.READY;
    } catch (e) {
      this.state = ActivityPoolState.ERROR;
      throw e;
    }

    this.events.emit("ready");
  }

  async stop() {
    if (this.state != ActivityPoolState.READY) {
      return;
    }

    this.state = ActivityPoolState.STOPPING;
    this.events.emit("beforeEnd");

    // TODO: consider if we should catch and ignore individual errors here in order to release as many resource as we can.
    try {
      // Call destroyInstance() on all active instances
      const promises: Promise<void>[] = Array.from(this.activities.values()).map((ctx) => this.release(ctx));
      await Promise.allSettled(promises);

      // FIXME: This component should really make sure that we accept all invoices and don't wait for payment
      //   as that's a different process executed by the payment driver. Accepted means work is done.
      await this.marketService.end();

      // Order of below is important
      await this.agreementService.end();
      await this.paymentService.end();

      // Cleanup resource allocations which are not inherently visible in the constructor
      await this.storageProvider.close();

      this.state = ActivityPoolState.STOPPED;
    } catch (e) {
      this.state = ActivityPoolState.ERROR;
      throw e;
    }

    this.events.emit("end");
  }

  async acquire(): Promise<WorkContext> {
    if (this.abortController.signal.aborted) {
      throw new GolemAbortError("Operation aborted by user");
    }

    if (this.state != ActivityPoolState.READY) {
      throw new GolemUserError(`Cannot create activity, backend state is ${this.state}`);
    }

    const agreement = await this.agreementService.getAgreement();
    if (this.abortController.signal.aborted) {
      // ignore promise
      this.agreementService.releaseAgreement(agreement.id, false);
      throw new GolemAbortError("Operation aborted by user");
    }

    this.paymentService.acceptPayments(agreement);
    const activity = await Activity.create(agreement, this.yagnaApi);
    if (this.abortController.signal.aborted) {
      // ignore promises
      activity.stop();
      this.agreementService.releaseAgreement(agreement.id, false);
      throw new GolemAbortError("Operation aborted by user");
    }

    const ctx = new WorkContext(activity, {
      storageProvider: this.storageProvider,
    });

    await ctx.before();
    if (this.abortController.signal.aborted) {
      // ignore promises
      activity.stop();
      this.agreementService.releaseAgreement(agreement.id, false);
      throw new GolemAbortError("Operation aborted by user");
    }

    this.activities.set(activity.id, ctx);

    return ctx;
  }

  async release(ctx: WorkContext): Promise<void> {
    if (!this.activities.has(ctx.activity.id)) {
      throw new GolemUserError("Cannot destroy instance, instance not found");
    }

    await ctx.activity.stop();

    // FIXME #sdk Use Agreement and not string
    await this.agreementService.releaseAgreement(ctx.activity.agreement.id, false);

    this.activities.delete(ctx.activity.id);
  }

  async runOnce<R>(worker: (ctx: WorkContext) => Promise<R>): Promise<R> {
    const ctx = await this.acquire();
    try {
      const result = await worker(ctx);
      await this.release(ctx);
      return result;
    } catch (e) {
      await this.release(ctx);
      throw e;
    }
  }

  /**
   * Converts the user specified duration in hours into milliseconds
   */
  private getExpectedDurationSeconds() {
    return this.options.market.rentHours * 60 * 60;
  }

  /**
   * Estimates the spec and duration to create an allocation
   *
   * TODO: Actually, it makes more sense to create an allocation after you look through market offers, to use the actual CPU count!
   */
  private getBudgetEstimate() {
    const { rentHours, pricing } = this.options.market;

    return (
      rentHours * pricing.maxCpuPerHourPrice * (this.options.resources?.minCpu ?? 1) * (this.options?.replicas ?? 1)
    );
  }

  private estimateProposal(proposal: Proposal): number {
    const budgetSeconds = this.getExpectedDurationSeconds();
    // TODO #sdk Have a nice property access to this
    const threadsNo = proposal.properties["golem.inf.cpu.threads"];

    return (
      proposal.pricing.start +
      proposal.pricing.cpuSec * threadsNo * budgetSeconds +
      proposal.pricing.envSec * budgetSeconds
    );
  }

  private buildProposalFilter(): ProposalFilter {
    return (proposal: Proposal) => {
      if (
        this.options.market.withProviders &&
        this.options.market.withProviders.length > 0 &&
        !this.options.market.withProviders.includes(proposal.provider.id)
      ) {
        return false;
      }

      const budget = this.getBudgetEstimate();
      const budgetPerReplica = budget / (this.options?.replicas ?? 1);

      const estimate = this.estimateProposal(proposal);

      return estimate <= budgetPerReplica;
    };
  }
}
