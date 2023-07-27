import { AgreementOptions } from "./agreement.js";
import { AgreementSelector, AgreementServiceOptions } from "./service.js";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api.js";
import { Configuration } from "ya-ts-client/dist/ya-market/index.js";
import { EnvUtils, Logger } from "../utils/index.js";
import { randomAgreementSelector } from "./strategy.js";
import { Agent } from "http";

const DEFAULTS = {
  agreementRequestTimeout: 30000,
  agreementWaitingForApprovalTimeout: 30,
  agreementSelector: randomAgreementSelector(),
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
  private readonly httpAgent: Agent;

  constructor(public readonly options?: AgreementOptions) {
    const apiKey = options?.yagnaOptions?.apiKey || EnvUtils.getYagnaAppKey();
    if (!apiKey) throw new Error("Api key not defined");
    const basePath = options?.yagnaOptions?.basePath || EnvUtils.getYagnaApiUrl();
    this.httpAgent = new Agent({ keepAlive: true });
    const apiConfig = new Configuration({
      apiKey,
      basePath: `${basePath}/market-api/v1`,
      accessToken: apiKey,
      baseOptions: { httpAgent: this.httpAgent },
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
  readonly agreementSelector: AgreementSelector;

  constructor(options?: AgreementServiceOptions) {
    super(options);
    this.agreementSelector = options?.agreementSelector ?? DEFAULTS.agreementSelector;
  }
}
