import { MarketService } from "../market";
import { Agreement, AgreementPoolService } from "../agreement";
import { PaymentOptions, PaymentService } from "../payment";
import { MarketOptions } from "../market/service";
import { AgreementServiceOptions } from "../agreement/service";
import { Yagna, YagnaOptions } from "../utils/yagna/yagna";
import { Package, PackageOptions } from "../package";
import { WorkContext } from "../task";
import { Activity, ActivityOptions } from "../activity";
import { NetworkService, NetworkServiceOptions } from "../network";
import { defaultLogger, Logger, nullLogger } from "../utils";
import { isBrowser } from "../utils/runtimeContextChecker";
import { WebSocketBrowserStorageProvider, GftpStorageProvider, StorageProvider } from "../storage";

export type RuntimeOptions = { storageProvider?: StorageProvider; enableLogging?: boolean } & YagnaOptions &
  MarketOptions &
  AgreementServiceOptions &
  PaymentOptions &
  NetworkServiceOptions &
  PackageOptions &
  ActivityOptions;

export class GolemRuntime {
  private readonly options: RuntimeOptions;
  private readonly yagna: Yagna;
  private readonly marketService: MarketService;
  private readonly agreementService: AgreementPoolService;
  private readonly paymentService: PaymentService;
  private readonly networkService: NetworkService;
  private activity?: Activity;
  private logger: Logger;
  constructor(options?: RuntimeOptions) {
    this.logger = options?.logger || options?.enableLogging ? defaultLogger() : nullLogger();
    this.options = { logger: this.logger, imageTag: "golem/node:20-alpine", capabilities: ["vpn"], ...options };
    this.yagna = new Yagna(this.options.yagnaOptions);
    const yagnaApi = this.yagna.getApi();
    this.agreementService = new AgreementPoolService(yagnaApi, this.options);
    this.marketService = new MarketService(this.agreementService, yagnaApi, this.options);
    this.networkService = new NetworkService(yagnaApi, this.options);
    this.paymentService = new PaymentService(yagnaApi, this.options);
  }

  async init(): Promise<WorkContext> {
    try {
      await this.yagna.connect();
      const taskPackage = Package.create(this.options);
      const allocation = await this.paymentService.createAllocation();
      await this.marketService.run(taskPackage, allocation);
      await this.agreementService.run();
      await this.paymentService.run();
      await this.networkService.run();
      const agreement = await this.agreementService.getAgreement();
      this.paymentService.acceptPayments(agreement);
      await this.marketService.end();
      return this.createWorkContext(agreement);
    } catch (error) {
      // TODO
      this.logger.error(error);
      throw error;
    }
  }

  async end() {
    try {
      await this.activity?.stop?.();
      await this.agreementService.end();
      await this.networkService.end();
      await this.paymentService.end();
    } catch (error) {
      // TODO
      this.logger.error(error);
      throw error;
    }
  }

  private async createWorkContext(agreement: Agreement): Promise<WorkContext> {
    try {
      this.activity = await Activity.create(agreement.id, this.yagna.getApi(), this.options);
      const networkNode = await this.networkService.addNode(agreement.provider.id);
      const storageProvider = isBrowser
        ? new WebSocketBrowserStorageProvider(this.yagna.getApi(), {})
        : new GftpStorageProvider();
      const ctx = new WorkContext(this.activity, {
        provider: agreement.provider,
        networkNode,
        storageProvider,
      });
      await ctx.before();
      return ctx;
    } catch (error) {
      // TODO
      this.logger.error(error);
      throw error;
    }
  }
}
