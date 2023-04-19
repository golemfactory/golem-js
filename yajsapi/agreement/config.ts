import { AgreementOptions } from "./agreement.js";
import { AgreementServiceOptions } from "./service.js";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api.js";
import { Configuration } from "ya-ts-client/dist/ya-market/index.js";
import { Logger } from "../utils/index.js";
import { Agent } from "http";
import { MarketStrategy, DummyMarketStrategy } from "../market/strategy.js";

const DEFAULTS = {
  basePath: "http://127.0.0.1:7465",
  agreementRequestTimeout: 30000,
  agreementEventPoolingInterval: 5,
  agreementEventPoolingMaxEventsPerRequest: 100,
  agreementWaitingForProposalTimout: 10000,
  agreementWaitingForApprovalTimeout: 60,
  marketStrategy: new DummyMarketStrategy(),
};

/**
 * @internal
 */
export class AgreementConfig {
  readonly agreementRequestTimeout: number;
  readonly agreementWaitingForApprovalTimeout: number;
  readonly api: RequestorApi;
  readonly logger?: Logger;
  readonly eventTarget?: EventTarget;

  constructor(public readonly options?: AgreementOptions) {
    const apiKey = options?.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY;
    if (!apiKey) throw new Error("Api key not defined");
    const basePath = options?.yagnaOptions?.basePath || process.env.YAGNA_API_URL || DEFAULTS.basePath;
    const apiConfig = new Configuration({
      apiKey,
      basePath: `${basePath}/market-api/v1`,
      accessToken: apiKey,
      baseOptions: { httpAgent: new Agent({ keepAlive: true }) },
    });
    this.api = new RequestorApi(apiConfig);
    this.agreementRequestTimeout = options?.agreementRequestTimeout || DEFAULTS.agreementRequestTimeout;
    this.agreementWaitingForApprovalTimeout =
      options?.agreementWaitingForApprovalTimeout || DEFAULTS.agreementWaitingForApprovalTimeout;
    this.logger = options?.logger;
    this.eventTarget = options?.eventTarget;
  }
}

/**
 * @internal
 */
export class AgreementServiceConfig extends AgreementConfig {
  readonly agreementEventPoolingInterval: number;
  readonly agreementEventPoolingMaxEventsPerRequest: number;
  readonly agreementWaitingForProposalTimout: number;
  readonly marketStrategy: MarketStrategy;

  constructor(options?: AgreementServiceOptions) {
    super(options);
    this.agreementWaitingForProposalTimout =
      options?.agreementWaitingForProposalTimout || DEFAULTS.agreementWaitingForProposalTimout;
    this.agreementEventPoolingInterval =
      options?.agreementEventPoolingInterval || DEFAULTS.agreementEventPoolingInterval;
    this.agreementEventPoolingMaxEventsPerRequest =
      options?.agreementEventPoolingMaxEventsPerRequest || DEFAULTS.agreementEventPoolingMaxEventsPerRequest;
    this.marketStrategy = options?.marketStrategy || DEFAULTS.marketStrategy;
  }
}
