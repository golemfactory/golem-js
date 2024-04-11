import { Logger } from "../../shared/utils";

export enum ActivityPoolState {
  INITIAL = "INITIAL",
  STARTING = "STARTING",
  READY = "READY",
  STOPPING = "STOPPING",
  STOPPED = "STOPPED",
  ERROR = "ERROR",
}

export interface Resources {
  /** The minimum CPU requirement for each service instance. */
  minCpu?: number;
  /* The minimum memory requirement (in Gibibyte) for each service instance. */
  minMemGib?: number;
  /** The minimum storage requirement (in Gibibyte) for each service instance. */
  minStorageGib?: number;
}

export interface MarketOptions {
  /** How long you want to rent the resources in hours */
  rentHours: number;

  pricing: {
    maxStartPrice: number;
    maxCpuPerHourPrice: number;
    maxEnvPerHourPrice: number;
  };

  /** The payment network that should be considered while looking for providers and where payments will be done */
  paymentNetwork?: string;

  /**
   * List of provider Golem Node IDs that should be considered
   *
   * If not provided, the list will be pulled from: https://provider-health.golem.network/v1/provider-whitelist
   */
  withProviders?: string[];
  withoutProviders?: string[];
  withOperators?: string[];
  withoutOperators?: string[];
}

export interface PaymentOptions {
  // TODO
}

export interface ActivityPoolOptions {
  image: string;
  logger?: Logger;
  api?: {
    key: string;
    url: string;
  };
  abortController?: AbortController;
  resources?: Resources;
  replicas?: number;
  market: MarketOptions;
  network?: string;
  payment?: PaymentOptions;
  // networking?: string | Network[];
}

export interface ActivityPoolEvents {
  /**
   * Fires when backend is started.
   */
  ready: () => void;

  /**
   * Fires when a new instance encounters an error during initialization.
   * @param error
   */
  // activityInitError: (error: ActivityInitError) => void;

  /**
   * Fires when backend is about to be stopped.
   */
  beforeEnd: () => void;

  /**
   * Fires when backend is completely terminated.
   */
  end: () => void;
}
