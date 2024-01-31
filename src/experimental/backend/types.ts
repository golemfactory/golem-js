import { Logger } from "../../utils";

export enum GolemBackendState {
  INITIAL = "INITIAL",
  STARTING = "STARTING",
  READY = "READY",
  STOPPING = "STOPPING",
  STOPPED = "STOPPED",
  ERROR = "ERROR",
}

export interface GolemBackendResources {
  /** The minimum CPU requirement for each service instance. */
  minCpu?: number;
  /* The minimum memory requirement (in Gibibyte) for each service instance. */
  minMemGib?: number;
  /** The minimum storage requirement (in Gibibyte) for each service instance. */
  minStorageGib?: number;
}

export interface GolemMarketConfig {
  /** How long you want to rent the resources in hours */
  rentHours: number;

  /** How many concurrent instances you want to run */
  expectedInstances: number;

  /** What's the desired hourly rate spend in GLM/hour */
  priceGlmPerHour: number;

  /** The payment network that should be considered while looking for providers and where payments will be done */
  paymentNetwork?: string;

  /**
   * List of provider Golem Node IDs that should be considered
   *
   * If not provided, the list will be pulled from: https://provider-health.golem.network/v1/provider-whitelist
   */
  withProviders?: string[];
}

export interface GolemBackendConfig {
  image: string;
  logger?: Logger;
  abortController?: AbortController;
  api: {
    key: string;
    url: string;
  };
  resources?: GolemBackendResources;
  market: GolemMarketConfig;
}

export interface GolemBackendEvents {
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

export interface GolemInstanceEvents {
  /**
   * Fires when instance is destroyed.
   */
  end: () => void;
}
