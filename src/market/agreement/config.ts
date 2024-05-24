import { LegacyAgreementServiceOptions } from "./agreement";
import { AgreementSelector, AgreementServiceOptions } from "./service";
import { Logger } from "../../shared/utils";
import { randomAgreementSelectorWithPriorityForExistingOnes } from "./strategy";

const DEFAULTS = {
  agreementRequestTimeout: 30000,
  agreementWaitingForApprovalTimeout: 60,
  agreementSelector: randomAgreementSelectorWithPriorityForExistingOnes(),
  agreementMaxEvents: 100,
  agreementEventsFetchingIntervalSec: 5,
  agreementMaxPoolSize: 5,
};

export class AgreementApiConfig {
  readonly agreementRequestTimeout: number;
  readonly agreementWaitingForApprovalTimeout: number;
  readonly logger?: Logger;

  constructor(public readonly options?: LegacyAgreementServiceOptions) {
    this.agreementRequestTimeout = options?.agreementRequestTimeout || DEFAULTS.agreementRequestTimeout;
    this.agreementWaitingForApprovalTimeout =
      options?.agreementWaitingForApprovalTimeout || DEFAULTS.agreementWaitingForApprovalTimeout;
    this.logger = options?.logger;
  }
}

/**
 * TODO: What about this one?
 */
export class AgreementServiceConfig extends AgreementApiConfig {
  readonly agreementSelector: AgreementSelector;
  readonly agreementMaxEvents: number;
  readonly agreementMaxPoolSize: number;
  readonly agreementEventsFetchingIntervalSec: number;

  constructor(options?: AgreementServiceOptions) {
    super(options);
    this.agreementSelector = options?.agreementSelector ?? DEFAULTS.agreementSelector;
    this.agreementMaxEvents = options?.agreementMaxEvents ?? DEFAULTS.agreementMaxEvents;
    this.agreementMaxPoolSize = options?.agreementMaxPoolSize ?? DEFAULTS.agreementMaxPoolSize;
    this.agreementEventsFetchingIntervalSec =
      options?.agreementEventsFetchingIntervalSec ?? DEFAULTS.agreementEventsFetchingIntervalSec;
  }
}
