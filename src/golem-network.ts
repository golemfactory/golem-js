import { DeploymentOptions, GolemDeploymentBuilder, MarketOptions, PaymentOptions } from "./experimental";
import { Logger, YagnaApi } from "./shared/utils";
import { StorageProvider } from "./shared/storage";
import { MarketModule, MarketModuleImpl } from "./market/market.module";
import { PaymentModule, PaymentModuleImpl } from "./payment/payment.module";
import { ActivityModule, ActivityModuleImpl } from "./activity/activity.module";
import { NetworkModule, NetworkModuleImpl } from "./network/network.module";
import { EventEmitter } from "eventemitter3";

export interface GolemNetworkOptions {
  logger?: Logger;
  api: {
    key: string;
    url: string;
  };
  market?: Partial<MarketOptions>;
  payment?: Partial<PaymentOptions>;
  deployment?: Partial<DeploymentOptions>;
  dataTransferProtocol?: "gftp" | "ws" | StorageProvider;
}

export interface GolemNetworkEvents {
  /** Fires when all startup operations related to GN are completed */
  connected: () => void;

  /** Fires when an error will be encountered */
  error: (err: Error) => void;

  /** Fires when all shutdown operations related to GN are completed */
  disconnected: () => void;
}

/**
 * General purpose and high-level API for the Golem Network
 *
 * This class is the main entry-point for developers that would like to build on Golem Network
 * using `@golem-sdk/golem-js`. It is supposed to provide an easy access API for use 80% of use cases.
 */
export class GolemNetwork {
  public readonly events = new EventEmitter<GolemNetworkEvents>();

  private readonly yagna: YagnaApi;
  public readonly market: MarketModule;
  public readonly payment: PaymentModule;
  public readonly activity: ActivityModule;
  public readonly network: NetworkModule;

  constructor(public readonly options: GolemNetworkOptions) {
    try {
      this.yagna = new YagnaApi({
        logger: this.options.logger,
        apiKey: this.options.api.key,
        basePath: this.options.api.url,
      });

      this.market = new MarketModuleImpl(this.yagna);
      this.payment = new PaymentModuleImpl();
      this.activity = new ActivityModuleImpl();
      this.network = new NetworkModuleImpl();
    } catch (err) {
      this.events.emit("error", err);
      throw err;
    }
  }

  /**
   * "Connects" to the network by initializing the underlying components required to perform operations on Golem Network
   *
   * @return Resolves when all initialization steps are completed
   */
  async connect() {
    try {
      await this.yagna.connect();
      this.events.emit("connected");
    } catch (err) {
      this.events.emit("error", err);
      throw err;
    }
  }

  /**
   * "Disconnects" from the Golem Network
   *
   * @return Resolves when all shutdown steps are completed
   */
  async disconnect() {
    await this.yagna.disconnect();
    this.events.emit("disconnected");
  }

  /**
   * Creates a new instance of deployment builder that will be bound to this GolemNetwork instance
   *
   * @return The new instance of the builder
   */
  creteDeploymentBuilder(): GolemDeploymentBuilder {
    return new GolemDeploymentBuilder(this);
  }
}
