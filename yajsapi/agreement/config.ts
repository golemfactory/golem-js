import { YagnaOptions } from "../executor";
import { AgreementOptions } from "./agreement";

const DEFAULT_OPTIONS = {
  REQUEST_TIMEOUT: 30000,
  EXECUTE_TIMEOUT: 30000,
  EVENT_POOLING_INT: 5,
  EVENT_POOLING_MAX_EVENTS: 100,
  SUBNET_TAG: "devnet-beta",
};

export class AgreementConfig {
  private yagnaOptions?: YagnaOptions;
  private subnetTag?: string;
  private requestTimeout?: number;
  private executeTimeout?: number;
  private eventPoolingInterval?: number;
  private eventPoolingMaxEventsPerRequest?: number;

  constructor({
    subnetTag,
    requestTimeout,
    executeTimeout,
    eventPoolingInterval,
    eventPoolingMaxEventsPerRequest,
    yagnaOptions,
    logger,
  }: AgreementOptions) {
    this.requestTimeout = requestTimeout || DEFAULT_OPTIONS.REQUEST_TIMEOUT;
    this.executeTimeout = executeTimeout || DEFAULT_OPTIONS.EXECUTE_TIMEOUT;
    this.eventPoolingInterval = eventPoolingInterval || DEFAULT_OPTIONS.EVENT_POOLING_INT;
    this.eventPoolingMaxEventsPerRequest = eventPoolingMaxEventsPerRequest || DEFAULT_OPTIONS.EVENT_POOLING_MAX_EVENTS;
    this.subnetTag = subnetTag || DEFAULT_OPTIONS.SUBNET_TAG;
    this.yagnaOptions = yagnaOptions;
  }
}
