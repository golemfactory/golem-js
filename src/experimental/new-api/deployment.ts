import { GolemAbortError, GolemUserError } from "../../error/golem-error";
import { defaultLogger, Logger, YagnaApi } from "../../utils";
import { EventEmitter } from "eventemitter3";
import { ActivityPool } from "./pool";
import { ActivityPoolOptions, MarketOptions, PaymentOptions } from "./types";
import { Network, NetworkOptions } from "../../network";
import { GftpStorageProvider, StorageProvider, WebSocketBrowserStorageProvider } from "../../storage";
import { validateDeployment } from "./validate-deployment";

export enum DeploymentState {
  INITIAL = "INITIAL",
  STARTING = "STARTING",
  READY = "READY",
  STOPPING = "STOPPING",
  STOPPED = "STOPPED",
  ERROR = "ERROR",
}

export interface DeploymentEvents {
  /**
   * Fires when backend is started.
   */
  ready: () => void;

  /**
   * Fires when a new instance encounters an error during initialization.
   * @param error
   */
  // activityInitError: (error: ActivityInitError) => void;

  /**
   * Fires when backend is about to be stopped.
   */
  beforeEnd: () => void;

  /**
   * Fires when backend is completely terminated.
   */
  end: () => void;
}

export type DeploymentComponents = {
  activityPools: { name: string; options: ActivityPoolOptions }[];
  networks: { name: string; options: NetworkOptions }[];
};

export interface DeploymentOptions {
  logger?: Logger;
  api: {
    key: string;
    url: string;
  };
  market?: Partial<MarketOptions>;
  payment?: Partial<PaymentOptions>;
  dataTransferProtocol?: "gftp" | "ws" | StorageProvider;
}

/**
 * @experimental This feature is experimental!!!
 */
export class Deployment {
  readonly events = new EventEmitter<DeploymentEvents>();

  private state: DeploymentState = DeploymentState.INITIAL;

  private readonly logger: Logger;
  private readonly abortController = new AbortController();

  private readonly yagnaApi: YagnaApi;

  private readonly activityPools = new Map<string, ActivityPool>();
  private readonly networks = new Map<string, Network>();
  private readonly dataTransferProtocol: StorageProvider;

  constructor(
    private readonly components: DeploymentComponents,
    private readonly options: DeploymentOptions,
  ) {
    validateDeployment(components);
    this.logger = options.logger ?? defaultLogger("deployment");

    this.yagnaApi = new YagnaApi({
      apiKey: options.api.key,
      basePath: options.api.url,
    });

    this.dataTransferProtocol = this.getDataTransferProtocol(options, this.yagnaApi);

    this.abortController.signal.addEventListener("abort", () => {
      this.logger.info("Abort signal received");
      this.stop().catch((e) => {
        this.logger.error("stop() error on abort", { error: e });
        // TODO: should the error be sent to event listener?
      });
    });
  }

  private getDataTransferProtocol(options: DeploymentOptions, yagnaApi: YagnaApi): StorageProvider {
    if (!options.dataTransferProtocol || options.dataTransferProtocol === "gftp") {
      return new GftpStorageProvider();
    }
    if (options.dataTransferProtocol === "ws") {
      return new WebSocketBrowserStorageProvider(yagnaApi, {});
    }
    return options.dataTransferProtocol;
  }

  getState(): DeploymentState {
    return this.state;
  }

  async start() {
    if (this.abortController.signal.aborted) {
      throw new GolemAbortError("Calling start after abort signal received");
    }

    if (this.state != DeploymentState.INITIAL) {
      throw new GolemUserError(`Cannot start backend, expected backend state INITIAL, current state is ${this.state}`);
    }

    await this.dataTransferProtocol.init();

    for (const network of this.components.networks) {
      const networkInstance = await Network.create(this.yagnaApi, network.options);
      this.networks.set(network.name, networkInstance);
    }
    // TODO: add pool to network
    // TODO: pass dataTransferProtocol to pool
    for (const pool of this.components.activityPools) {
      const activityPool = new ActivityPool(pool.options);
      this.activityPools.set(pool.name, activityPool);
    }

    this.events.emit("ready");
  }

  async stop() {
    if (this.state === DeploymentState.STOPPING || this.state === DeploymentState.STOPPED) {
      return;
    }

    this.state = DeploymentState.STOPPING;
    this.events.emit("beforeEnd");

    try {
      this.abortController.abort();

      this.dataTransferProtocol.close();

      const stopPools: Promise<void>[] = Array.from(this.activityPools.values()).map((pool) => pool.stop());
      await Promise.allSettled(stopPools);

      const stopNetworks: Promise<void>[] = Array.from(this.networks.values()).map((network) => network.remove());
      await Promise.allSettled(stopNetworks);

      this.state = DeploymentState.STOPPED;
    } catch (e) {
      this.state = DeploymentState.ERROR;
      throw e;
    }

    this.events.emit("end");
  }

  getActivityPool(name: string): ActivityPool {
    const pool = this.activityPools.get(name);
    if (!pool) {
      throw new GolemUserError(`ActivityPool ${name} not found`);
    }
    return pool;
  }

  getNetwork(name: string): Network {
    const network = this.networks.get(name);
    if (!network) {
      throw new GolemUserError(`Network ${name} not found`);
    }
    return network;
  }
}
