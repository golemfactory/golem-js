import { DeploymentOptions, GolemDeploymentBuilder, MarketOptions, PaymentOptions } from "./experimental";
import { Logger, YagnaApi } from "./shared/utils";
import { StorageProvider } from "./shared/storage";
import { MarketModule, MarketModuleImpl } from "./market/market.module";
import { PaymentModule, PaymentModuleImpl } from "./payment/payment.module";
import { ActivityModule, ActivityModuleImpl } from "./activity/activity.module";
import { NetworkModule, NetworkModuleImpl } from "./network/network.module";

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

export class GolemNetwork {
  private readonly yagna: YagnaApi;
  public readonly market: MarketModule;
  public readonly payment: PaymentModule;
  public readonly activity: ActivityModule;
  public readonly network: NetworkModule;

  constructor(public readonly options: GolemNetworkOptions) {
    this.yagna = new YagnaApi();
    this.market = new MarketModuleImpl(this.yagna);
    this.payment = new PaymentModuleImpl();
    this.activity = new ActivityModuleImpl();
    this.network = new NetworkModuleImpl();
  }

  async connect() {
    // todo
  }

  async disconnect() {
    // todo
  }

  createBuilder(): GolemDeploymentBuilder {
    return new GolemDeploymentBuilder(this);
  }
}
