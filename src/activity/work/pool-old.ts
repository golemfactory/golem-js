import { createPool, Factory, Options as GenericPoolOptions, Pool } from "generic-pool";
import { Activity, ActivityStateEnum } from "../index";
import { defaultLogger, Logger, YagnaApi, YagnaOptions } from "../../shared/utils";
import { AgreementPoolService } from "../../agreement";
import { PaymentOptions, PaymentService } from "../../payment";
import { Package, PackageOptions } from "../../market/package";
import { MarketServiceOptions, MarketService } from "../../market";
import { ActivityDTO, WorkContext, WorkOptions } from "./work";
import { NetworkService } from "../../network";
import { createDefaultStorageProvider, StorageProvider } from "../../shared/storage";
import { EventEmitter } from "eventemitter3";
import { GolemWorkError, WorkErrorCode } from "./error";

export interface ActivityPoolOptions {
  image: string;
  logger?: Logger;
  api?: YagnaOptions;
  abortController?: AbortController;
  resources?: PackageOptions;
  pool?: GenericPoolOptions;
  market?: MarketServiceOptions;
  payment?: PaymentOptions;
  work?: WorkOptions;
  network?: string;
}

export interface ActivityPoolEvents {
  ready: () => void;
  beforeEnd: () => void;
  end: () => void;
  acquired: (activity: ActivityDTO) => void;
  destroyed: (activity: ActivityDTO) => void;
  error: (error: GolemWorkError) => void;
}

export class ActivityPool {
  readonly events = new EventEmitter<ActivityPoolEvents>();

  private readonly logger: Logger;
  public readonly pool: Pool<WorkContext>;
  private readonly yagnaApi: YagnaApi;
  private readonly marketService: MarketService;
  private readonly agreementPoolService: AgreementPoolService;
  private readonly paymentService: PaymentService;
  private readonly networkService?: NetworkService;
  private readonly storageProvider: StorageProvider;
  private identity?: string;

  constructor(private options: ActivityPoolOptions) {
    this.logger = this.logger = options?.logger || defaultLogger("work");
    this.yagnaApi = new YagnaApi(options.api);
    this.agreementPoolService = new AgreementPoolService(this.yagnaApi);
    this.marketService = new MarketService(this.agreementPoolService, this.yagnaApi, options.market);
    this.paymentService = new PaymentService(this.yagnaApi, options.payment);
    // this.networkService = options.network ? new NetworkService(this.yagnaApi, options.network) : undefined;
    this.storageProvider = createDefaultStorageProvider(this.yagnaApi, this.logger);
    this.pool = createPool<WorkContext>(this.createFactory(), {
      autostart: false,
      testOnBorrow: true,
      max: options.pool?.max ?? options.pool?.min ?? 1,
      ...options.pool,
    });
    this.pool.on("factoryCreateError", (error) =>
      this.events.emit(
        "error",
        new GolemWorkError(
          "Creating activity failed",
          WorkErrorCode.ActivityCreationFailed,
          undefined,
          undefined,
          undefined,
          error,
        ),
      ),
    );
    this.pool.on("factoryDestroyError", (error) =>
      this.events.emit(
        "error",
        new GolemWorkError(
          "Destroying activity failed",
          WorkErrorCode.ActivityCreationFailed,
          undefined,
          undefined,
          undefined,
          error,
        ),
      ),
    );
  }

  async start() {
    this.identity = (await this.yagnaApi.connect()).identity;
    const allocation = await this.paymentService.createAllocation(this.options.payment);

    const workload = Package.create({
      imageTag: this.options.image,
      minMemGib: this.options.resources?.minMemGib,
      minCpuCores: this.options.resources?.minCpuCores,
      minCpuThreads: this.options.resources?.minCpuThreads,
      minStorageGib: this.options.resources?.minStorageGib,
    });

    await Promise.all([
      this.agreementPoolService.run(),
      this.marketService.run(workload, allocation),
      this.paymentService.run(),
    ]);

    this.pool.start();
    this.logger.info("ActivityPoll started");
    await this.pool.ready();
    this.logger.info("ActivityPoll ready");
    this.events.emit("ready");
  }

  async acquire(): Promise<WorkContext> {
    const ctx = await this.pool.acquire();
    this.events.emit("acquired", ctx.getDto());
    return ctx;
  }

  async release(ctx: WorkContext) {
    return this.pool.release(ctx);
  }

  async drain() {
    return this.pool.drain();
  }

  async destroy(ctx: WorkContext) {
    await this.pool.destroy(ctx);
    this.events.emit("destroyed", ctx.getDto());
  }

  async stop() {
    this.events.emit("beforeEnd");
    await this.pool.drain();
    await Promise.allSettled([
      this.networkService?.end(),
      this.marketService.end(),
      this.agreementPoolService.end(),
      this.paymentService.end(),
    ]);
    await this.pool.clear();
    this.events.emit("end");
  }

  getSize() {
    return this.pool.size;
  }
  getBorrowed() {
    return this.pool.borrowed;
  }
  getAvailable() {
    return this.pool.available;
  }

  private createFactory(): Factory<WorkContext> {
    return {
      create: async (): Promise<WorkContext> => {
        this.logger.debug("Creating new activity to add to pool");
        const agreement = await this.agreementPoolService.getAgreement();
        this.paymentService.acceptPayments(agreement);
        const activity = await Activity.create(agreement, this.yagnaApi);
        const networkNode =
          this.networkService && this.identity ? await this.networkService?.addNode(this.identity) : undefined;
        const ctx = new WorkContext(activity, {
          storageProvider: this.storageProvider,
          networkNode,
          ...this.options?.work,
        });
        await ctx.before();
        return ctx;
      },
      destroy: async (ctx: WorkContext) => {
        this.logger.debug("Destroying activity from the pool");
        await ctx.activity.stop();
        await this.agreementPoolService.releaseAgreement(ctx.activity.agreement.id, false);
      },
      validate: async (ctx: WorkContext) => {
        try {
          const state = await ctx.activity.getState();
          const result = state !== ActivityStateEnum.Terminated;
          this.logger.debug("Validating activity in the pool.", { result, state });
          return result;
        } catch (err) {
          this.logger.error("Checking activity status failed. The activity will be removed from the pool", err);
          return false;
        }
      },
    };
  }
}
