import { NetworkOptions } from "./network";
import { Logger } from "../utils";

const DEFAULTS = {
  networkIp: "192.168.0.0/24",
};

/**
 * @internal
 */
export class NetworkConfig {
  public readonly mask?: string;
  public readonly ip: string;
  public readonly ownerId: string;
  public readonly ownerIp?: string;
  public readonly gateway?: string;
  public readonly logger?: Logger;

  constructor(options: NetworkOptions) {
    this.ip = options?.networkIp || DEFAULTS.networkIp;
    this.mask = options?.networkMask;
    this.ownerId = options.networkOwnerId;
    this.ownerIp = options?.networkOwnerIp;
    this.gateway = options?.networkGateway;
    this.logger = options?.logger;
  }
}
