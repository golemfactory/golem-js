import { ProposalFilter } from "../../market";
import { Logger } from "../../utils";

const GOLEM_DEPLOYMENT_ACQUIRE_TIMEOUT_SEC = 10;
const GOLEM_DEPLOYMENT_DOWNSCALE_INTERVAL_SEC = 60;

export interface GolemServiceResourcesSpec {
  minCpu?: number;
  minMemGib?: number;
  minStorageGib?: number;
}

export interface GolemMarketSpec {
  rentHours: number;
  priceGlmPerHour: number;
  paymentNetwork?: string;
  proposalFilters?: ProposalFilter[];
}

export interface GolemReplicasSpec {
  min: number;
  max: number;
  // Pool options
  acquireTimeoutSec?: number;
  downscaleIntervalSec?: number;
}

export interface GolemServiceSpec {
  image: string;
  replicas?: Partial<GolemReplicasSpec>;
  resources?: GolemServiceResourcesSpec;
  market?: GolemMarketSpec;
}

export interface GolemNetworkSpec {
  network?: string; // example: 192.168.0.0/16
}

export interface GolemAPISpec {
  key: string;
  url: string;
}

export interface GolemDeploymentBuilderOptions {
  api?: GolemAPISpec;
  logger?: Logger;
}
