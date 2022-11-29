import { YagnaOptions } from "../executor";
import { AgreementOptions } from "./agreement";
import { AgreementServiceOptions } from "./agreement_pool_service";

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

  constructor({
    subnetTag,
    requestTimeout,
    executeTimeout,
    yagnaOptions,
    waitingForApprovalTimeout,
  }: AgreementOptions) {
    const basePath = (yagnaOptions?.basePath || process.env.YAGNA_URL) + "/market-api/v1",
      apiKey = yagnaOptions?.apiKey || process.env.YAGNA_APPKEY;

    if (!basePath || !apiKey) {
      throw new Error("No yagna Credentials provided");
    }

    this.yagnaOptions = {
      basePath,
      apiKey,
    };

    this.requestTimeout = requestTimeout || DEFAULT_OPTIONS.REQUEST_TIMEOUT;
    this.executeTimeout = executeTimeout || DEFAULT_OPTIONS.EXECUTE_TIMEOUT;
    this.waitingForApprovalTimeout = waitingForApprovalTimeout || DEFAULT_OPTIONS.WAITING_FOR_APPROVAL_TIMEOUT;
    this.subnetTag = subnetTag || DEFAULT_OPTIONS.SUBNET_TAG;
  }
}

export class AgreementServiceConfig extends AgreementConfig {
  private eventPoolingInterval?: number;
  private eventPoolingMaxEventsPerRequest?: number;

  constructor(options: AgreementServiceOptions) {
    super(options);
    const { eventPoolingInterval, eventPoolingMaxEventsPerRequest } = options;
    this.eventPoolingInterval = eventPoolingInterval || DEFAULT_OPTIONS.EVENT_POOLING_INT;
    this.eventPoolingMaxEventsPerRequest = eventPoolingMaxEventsPerRequest || DEFAULT_OPTIONS.EVENT_POOLING_MAX_EVENTS;
  }
}
