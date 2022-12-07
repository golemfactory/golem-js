import { YagnaOptions } from "../executor";
import { AgreementOptions } from "./agreement";
import { AgreementServiceOptions } from "./service";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { Configuration } from "ya-ts-client/dist/ya-market";
import { Logger } from "../utils";

const DEFAULT_OPTIONS = {
  WAITING_FOR_APPROVAL_TIMEOUT: 15,
  REQUEST_TIMEOUT: 30000,
  EXECUTE_TIMEOUT: 30000,
  EVENT_POOLING_INT: 5,
  EVENT_POOLING_MAX_EVENTS: 100,
  SUBNET_TAG: "devnet-beta",
  basePath: "http://127.0.0.1:7465",
};

export class AgreementConfig {
  readonly subnetTag: string;
  readonly requestTimeout: number;
  readonly executeTimeout: number;
  readonly waitingForApprovalTimeout: number;
  readonly api: RequestorApi;
  readonly logger?: Logger;
  readonly eventTarget?: EventTarget;

  constructor(public readonly options?: AgreementOptions) {
    const apiKey = options?.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY;
    if (!apiKey) throw new Error("Api key not defined");
    const basePath = options?.yagnaOptions?.basePath || process.env.YAGNA_API_BASEPATH || DEFAULT_OPTIONS.basePath;
    const apiConfig = new Configuration({ apiKey, basePath: `${basePath}/market-api/v1`, accessToken: apiKey });
    this.api = new RequestorApi(apiConfig);
    this.requestTimeout = options?.requestTimeout || DEFAULT_OPTIONS.REQUEST_TIMEOUT;
    this.executeTimeout = options?.executeTimeout || DEFAULT_OPTIONS.EXECUTE_TIMEOUT;
    this.waitingForApprovalTimeout = options?.waitingForApprovalTimeout || DEFAULT_OPTIONS.WAITING_FOR_APPROVAL_TIMEOUT;
    this.subnetTag = options?.subnetTag || DEFAULT_OPTIONS.SUBNET_TAG;
    this.logger = options?.logger;
    this.eventTarget = options?.eventTarget;
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
