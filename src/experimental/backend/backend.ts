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
import { defaultLogger, Logger, runtimeContextChecker, Yagna, YagnaApi } from "../../utils";
import { GolemBackendConfig, GolemBackendEvents, GolemBackendState } from "./types";
import { Package } from "../../package";
import { WorkContext } from "../../task";
import { GolemInstance } from "./instance";
import { EventEmitter } from "eventemitter3";

type InstanceGroup = {
  instance: GolemInstance;
  activity: Activity;
  context: WorkContext;
};

/**
 * @experimental This feature is experimental!!!
 */
export class GolemBackend {
  readonly events = new EventEmitter<GolemBackendEvents>();

  private state: GolemBackendState = GolemBackendState.INITIAL;

  private readonly logger: Logger;
  private readonly abortController: AbortController;

  private readonly yagna: Yagna;
  private readonly api: YagnaApi;
  private readonly agreementService: AgreementPoolService;
  private readonly marketService: MarketService;
  private readonly paymentService: PaymentService;
  private readonly storageProvider: StorageProvider;

  private readonly instances = new Map<GolemInstance, InstanceGroup>();

  // private readonly networks: Network[] = [];
  // private readonly managedNetwork?: Network;

  constructor(private readonly config: GolemBackendConfig) {
    this.logger = config.logger ?? defaultLogger("backend");
    this.abortController = config.abortController ?? new AbortController();

    this.abortController.signal.addEventListener("abort", () => {
      this.logger.info("Abort signal received");
      this.stop().catch((e) => {
        this.logger.error("stop() error on abort", { error: e });
        // TODO: should the error be sent to event listener?
      });
    });

    this.yagna = new Yagna({
      apiKey: config.api.key,
      basePath: config.api.url,
    });

    this.api = this.yagna.getApi();

    this.agreementService = new AgreementPoolService(this.api, {
      logger: this.logger.child("agreement"),
    });

    this.marketService = new MarketService(this.agreementService, this.api, {
      expirationSec: this.getExpectedDurationSeconds(),
      logger: this.logger.child("market"),
      proposalFilter: this.buildProposalFilter(),
    });

    this.paymentService = new PaymentService(this.api, {
      logger: this.logger.child("payment"),
      payment: {
        network: this.config.market.paymentNetwork,
      },
    });

    if (runtimeContextChecker.isNode) {
      this.storageProvider = new GftpStorageProvider(this.logger.child("storage"));
    } else if (runtimeContextChecker.isBrowser) {
      this.storageProvider = new WebSocketBrowserStorageProvider(this.api, {
        logger: this.logger.child("storage"),
      });
    } else {
      this.storageProvider = new NullStorageProvider();
    }
  }

  getState(): GolemBackendState {
    return this.state;
  }

  async start() {
    if (this.abortController.signal.aborted) {
      throw new GolemAbortError("Calling start after abort signal received");
    }

    if (this.state != GolemBackendState.INITIAL) {
      throw new GolemUserError(`Cannot start backend, expected backend state INITIAL, current state is ${this.state}`);
    }

    this.state = GolemBackendState.STARTING;

    // FIXME: use abort controller.
    try {
      const allocation = await this.paymentService.createAllocation({
        budget: this.getBudgetEstimate(),
        expires: this.getExpectedDurationSeconds() * 1000,
      });

      if (this.abortController.signal.aborted) {
        // ignore promises
        throw new GolemAbortError("Operation aborted by user");
      }

      const workload = Package.create({
        imageTag: this.config.image,
        minMemGib: this.config.resources?.minMemGib,
        minCpuCores: this.config.resources?.minCpu,
        minCpuThreads: this.config.resources?.minCpu,
        minStorageGib: this.config.resources?.minStorageGib,
        logger: this.logger.child("package"),
      });

      await Promise.all([
        this.agreementService.run(),
        // TODO: I should be able to start the service, but pass the workload and allocation later - market.postDemand(???)
        // TODO: I should be able to specify the proposal filter here, and not on the constructor level
        this.marketService.run(workload, allocation),
        this.paymentService.run(),
      ]);
      this.state = GolemBackendState.READY;
    } catch (e) {
      this.state = GolemBackendState.ERROR;
      throw e;
    }

    this.events.emit("ready");
  }

  async stop() {
    if (this.state != GolemBackendState.READY) {
      return;
    }

    this.state = GolemBackendState.STOPPING;
    this.events.emit("beforeEnd");

    // TODO: consider if we should catch and ignore individual errors here in order to release as many resource as we can.
    try {
      // Call destroyInstance() on all active instances
      const promises: Promise<void>[] = Array.from(this.instances.values()).map((group) =>
        this.destroyInstance(group.instance),
      );
      await Promise.allSettled(promises);

      // FIXME: This component should really make sure that we accept all invoices and don't wait for payment
      //   as that's a different process executed by the payment driver. Accepted means work is done.
      await this.marketService.end();

      // Order of below is important
      await this.agreementService.end();
      await this.paymentService.end();

      // Cleanup resource allocations which are not inherently visible in the constructor
      await this.storageProvider.close();
      await this.yagna.end();

      this.state = GolemBackendState.STOPPED;
    } catch (e) {
      this.state = GolemBackendState.ERROR;
      throw e;
    }

    this.events.emit("end");
  }

  async createInstance(): Promise<GolemInstance> {
    if (this.abortController.signal.aborted) {
      throw new GolemAbortError("Operation aborted by user");
    }

    if (this.state != GolemBackendState.READY) {
      throw new GolemUserError(`Cannot create activity, backend state is ${this.state}`);
    }

    const agreement = await this.agreementService.getAgreement();
    if (this.abortController.signal.aborted) {
      // ignore promise
      this.agreementService.releaseAgreement(agreement.id, false);
      throw new GolemAbortError("Operation aborted by user");
    }

    this.paymentService.acceptPayments(agreement);
    const activity = await Activity.create(agreement, this.api);
    if (this.abortController.signal.aborted) {
      // ignore promises
      activity.stop();
      this.agreementService.releaseAgreement(agreement.id, false);
      throw new GolemAbortError("Operation aborted by user");
    }

    const context = new WorkContext(activity, {
      storageProvider: this.storageProvider,
    });

    await context.before();
    if (this.abortController.signal.aborted) {
      // ignore promises
      activity.stop();
      this.agreementService.releaseAgreement(agreement.id, false);
      throw new GolemAbortError("Operation aborted by user");
    }

    const group: InstanceGroup = {
      activity,
      context,
      instance: {
        provider: activity.getProviderInfo(),
        events: new EventEmitter(),
        run: context.run.bind(context),
        spawn: context.spawn.bind(context),
        downloadData: context.downloadData.bind(context),
        downloadFile: context.downloadFile.bind(context),
        downloadJson: context.downloadJson.bind(context),
        uploadData: context.uploadData.bind(context),
        uploadFile: context.uploadFile.bind(context),
        uploadJson: context.uploadJson.bind(context),
        transfer: context.transfer.bind(context),
        destroy: () => this.destroyInstance(group.instance),
      },
    };

    this.instances.set(group.instance, group);

    return group.instance;
  }

  async destroyInstance(instance: GolemInstance): Promise<void> {
    const group = this.instances.get(instance);
    if (!group) {
      throw new GolemUserError("Cannot destroy instance, instance not found");
    }

    instance.events.emit("end");
    await group.activity.stop();

    // FIXME #sdk Use Agreement and not string
    await this.agreementService.releaseAgreement(group.activity.agreement.id, false);

    this.instances.delete(instance);
  }

  async work<R>(worker: (instance: GolemInstance) => Promise<R>): Promise<R> {
    const instance = await this.createInstance();
    try {
      const result = await worker(instance);
      await this.destroyInstance(instance);
      return result;
    } catch (e) {
      await this.destroyInstance(instance);
      throw e;
    }
  }

  /**
   * Converts the user specified duration in hours into milliseconds
   */
  private getExpectedDurationSeconds() {
    return this.config.market.rentHours * 60 * 60;
  }

  /**
   * Estimates the spec and duration to create an allocation
   *
   * TODO: Actually, it makes more sense to create an allocation after you look through market offers, to use the actual CPU count!
   */
  private getBudgetEstimate() {
    const { rentHours, priceGlmPerHour } = this.config.market;

    return rentHours * priceGlmPerHour * (this.config.resources?.minCpu ?? 1) * this.config.market.expectedInstances;
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
        this.config.market.withProviders &&
        this.config.market.withProviders.length > 0 &&
        !this.config.market.withProviders.includes(proposal.provider.id)
      ) {
        return false;
      }

      const budget = this.getBudgetEstimate();
      const budgetPerReplica = budget / this.config.market.expectedInstances;

      const estimate = this.estimateProposal(proposal);

      return estimate <= budgetPerReplica;
    };
  }
}
