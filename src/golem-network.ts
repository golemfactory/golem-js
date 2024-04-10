import { DeploymentOptions, GolemDeploymentBuilder, MarketOptions, PaymentOptions } from "./experimental";
import { Logger } from "./shared/utils";
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
  constructor(public readonly options: GolemNetworkOptions) {}

  public readonly market: MarketModule = new MarketModuleImpl();
  public readonly payment: PaymentModule = new PaymentModuleImpl();
  public readonly activity: ActivityModule = new ActivityModuleImpl();
  public readonly network: NetworkModule = new NetworkModuleImpl();

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
