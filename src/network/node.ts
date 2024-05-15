import { NetworkInfo } from "./network";

/**
 * Describes a node in a VPN, mapping a Golem node id to an IP address
 */
export class NetworkNode {
  constructor(
    public readonly id: string,
    public readonly ip: string,
    public getNetworkInfo: () => NetworkInfo,
  ) {}

  /**
   * Generate a dictionary of arguments that are required for the appropriate
   *`Deploy` command of an exescript in order to pass the network configuration to the runtime
   * on the provider's end.
   */
  getNetworkConfig() {
    return {
      net: [
        {
          ...this.getNetworkInfo(),
          nodeIp: this.ip,
        },
      ],
    };
  }
}
