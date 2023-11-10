import { MarketService } from "../market";
import { AgreementPoolService } from "../agreement";
import { PaymentOptions, PaymentService } from "../payment";
import { MarketOptions } from "../market/service";
import { AgreementServiceOptions } from "../agreement/service";
import { Yagna, YagnaOptions } from "../utils/yagna/yagna";
import { Package, AllPackageOptions, PackageOptions } from "../package";
import { WorkContext } from "../task";
import { Activity } from "../activity";
import { NetworkService } from "../network";
import { defaultLogger, Logger, nullLogger } from "../utils";
import { isBrowser } from "../utils/runtimeContextChecker";
import { WebSocketBrowserStorageProvider, GftpStorageProvider, StorageProvider } from "../storage";
import { NetworkOptions } from "../network/network";
import { GolemWorker, GolemWorkerOptions } from "./worker";
import { GolemWorkerBrowser } from "./worker-browser";
import { GolemWorkerNode } from "./worker-node";
import { ActivityPoolService } from "../activity/service";

export type RuntimeOptions = {
  yagna?: YagnaOptions;
  market?: MarketOptions & AllPackageOptions;
  agreement?: AgreementServiceOptions;
  network?: NetworkOptions;
  payment?: PaymentOptions;
  storageProvider?: StorageProvider;
  enableLogging?: boolean;
  logger?: Logger;
};

export class GolemRuntime {
  private readonly options: RuntimeOptions;
  private readonly yagna: Yagna;
  private readonly marketService: MarketService;
  private readonly agreementService: AgreementPoolService;
  private readonly paymentService: PaymentService;
  private readonly networkService: NetworkService;
  private readonly activityService: ActivityPoolService;
  private logger: Logger;
  constructor(options?: RuntimeOptions) {
    this.logger = options?.logger || (options?.enableLogging ? defaultLogger() : nullLogger());
    this.options = this.prepareOptions(options);
    this.yagna = new Yagna(this.options.yagna);
    const yagnaApi = this.yagna.getApi();
    this.agreementService = new AgreementPoolService(yagnaApi, this.options.agreement);
    this.marketService = new MarketService(this.agreementService, yagnaApi, this.options.market);
    this.networkService = new NetworkService(yagnaApi, this.options.network);
    this.paymentService = new PaymentService(yagnaApi, this.options.payment);
    this.activityService = new ActivityPoolService(yagnaApi, this.agreementService, this.paymentService, {
      logger: this.logger,
    });
  }

  async init() {
    try {
      await this.yagna.connect();
      const taskPackage = Package.create(this.options.market as PackageOptions);
      const allocation = await this.paymentService.createAllocation();
      await this.marketService.run(taskPackage, allocation);
      await this.agreementService.run();
      await this.paymentService.run();
      await this.networkService.run();
      await this.activityService.run();
      this.logger?.info(
        `Golem Runtime has started using subnet: ${this.options.market?.subnetTag}, network: ${this.paymentService.config.payment.network}, driver: ${this.paymentService.config.payment.driver}`,
      );
    } catch (error) {
      this.logger.error(`Runtime initialization error. ${error}`);
      throw error;
    }
  }

  /**
   * Spawn a new Golem Worker.
   * Creates a new worker runtime environment on the available provider using the GolemRuntime pool.
   * @param scriptURL
   * @param options
   */
  async startWorker(scriptURL: string | URL, options?: GolemWorkerOptions): Promise<GolemWorker> {
    const Worker = isBrowser ? GolemWorkerBrowser : GolemWorkerNode;
    const activity = await this.activityService.getActivity();
    const ctx = await this.createWorkContext(activity);
    const worker = new Worker(ctx, scriptURL, { ...this.options, ...options } as GolemWorkerOptions);
    this.logger.info(`GolemWorker has been started on provider ${activity.agreement.provider.name}`);
    return worker;
  }

  /**
   * Terminate GolemWorker. Clears the runtime on the provider and returns it back to the GolemRuntime pool.
   * @param worker
   */
  async terminateWorker(worker: GolemWorker) {
    try {
      // not implemented
      // this.networkService.removeNode(worker.ctx.provider.id);
      await this.activityService.releaseActivity(worker.ctx.activity, true);
    } catch (error) {
      this.logger.warn(`Errors occurred while terminating worker. ${error}`);
    } finally {
      worker.terminate();
      this.logger.info(`GolemWorker has been terminated`);
    }
  }

  /**
   * Terminates Golem's resources and processes all payments.
   */
  async end() {
    try {
      await this.marketService.end();
      await this.activityService.end();
      await this.agreementService.end();
      await this.networkService.end();
      await this.paymentService.end();
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  private async createWorkContext(activity: Activity): Promise<WorkContext> {
    try {
      const networkNode = await this.networkService.addNode(activity.agreement.provider.id);
      const storageProvider = isBrowser
        ? new WebSocketBrowserStorageProvider(this.yagna.getApi(), {})
        : new GftpStorageProvider();
      const ctx = new WorkContext(activity, {
        provider: activity.agreement.provider,
        networkNode,
        storageProvider,
      });
      await ctx.before();
      return ctx;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  private prepareOptions(options?: RuntimeOptions) {
    return {
      ...options,
      market: {
        subnetTag: "public",
        logger: this.logger,
        // TODO: change to official golem image
        imageTag: "mgordel/worker:latest",
        ...options?.market,
        capabilities: options?.market?.capabilities ? [...options.market.capabilities, "vpn"] : ["vpn"],
      } as MarketOptions & AllPackageOptions,
      agreement: {
        logger: this.logger,
        ...options?.agreement,
      },
      network: {
        logger: this.logger,
        networkOwnerId: "",
        ...options?.network,
      },
      payment: {
        logger: this.logger,
        ...options?.payment,
      },
    };
  }
}
