import { YagnaOptions } from "../executor";
import { AgreementOptions } from "./agreement";
import { AgreementServiceOptions } from "./service";

const DEFAULT_OPTIONS = {
  WAITING_FOR_APPROVAL_TIMEOUT: 15,
  REQUEST_TIMEOUT: 30000,
  EXECUTE_TIMEOUT: 30000,
  EVENT_POOLING_INT: 5,
  EVENT_POOLING_MAX_EVENTS: 100,
  SUBNET_TAG: "devnet-beta",
};

export class AgreementConfig {
  public readonly yagnaOptions: YagnaOptions;
  public readonly subnetTag: string;
  public readonly requestTimeout: number;
  public readonly executeTimeout: number;
  public readonly waitingForApprovalTimeout: number;

  constructor(options?: AgreementOptions) {
    const basePath = (options?.yagnaOptions?.basePath || process.env.YAGNA_URL) + "/market-api/v1",
      apiKey = options?.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY;

    if (!basePath || !apiKey) throw new Error("No yagna Credentials provided");
    this.yagnaOptions = { basePath, apiKey };

    this.requestTimeout = options?.requestTimeout || DEFAULT_OPTIONS.REQUEST_TIMEOUT;
    this.executeTimeout = options?.executeTimeout || DEFAULT_OPTIONS.EXECUTE_TIMEOUT;
    this.waitingForApprovalTimeout = options?.waitingForApprovalTimeout || DEFAULT_OPTIONS.WAITING_FOR_APPROVAL_TIMEOUT;
    this.subnetTag = options?.subnetTag || DEFAULT_OPTIONS.SUBNET_TAG;
  }
}

export class AgreementServiceConfig extends AgreementConfig {
  private eventPoolingInterval?: number;
  private eventPoolingMaxEventsPerRequest?: number;

  constructor(options?: AgreementServiceOptions) {
    super(options);
    this.eventPoolingInterval = options?.eventPoolingInterval || DEFAULT_OPTIONS.EVENT_POOLING_INT;
    this.eventPoolingMaxEventsPerRequest =
      options?.eventPoolingMaxEventsPerRequest || DEFAULT_OPTIONS.EVENT_POOLING_MAX_EVENTS;
  }
}
