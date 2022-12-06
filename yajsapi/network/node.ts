import { IPv4 } from "ip-num";
import { NetworkInfo } from "./network";

/**
 * Describes a node in a VPN, mapping a Golem node id to an IP address
 */
export class NetworkNode {
  constructor(
    public readonly id,
    public readonly ip: IPv4,
    private getNetworkInfo: () => NetworkInfo,
    private apiUrl: string
  ) {}

  /**
   * Generate a dictionary of arguments that are required for the appropriate
   `Deploy` command of an exescript in order to pass the network configuration to the runtime
   on the provider's end.
   */
  getNetworkConfig() {
    return {
      net: [
        {
          ...this.getNetworkInfo(),
          nodeIp: this.ip.toString(),
        },
      ],
    };
  }

  /**
   * Get the websocket URI corresponding with a specific TCP port on this Node.
   * @param port TCP port of the service within the runtime
   * @return the url
   */
  getWebsocketUri(port: number) {
    const url = new URL(this.apiUrl);
    url.protocol = "ws";
    return `${url.href}/net/${this.getNetworkInfo().id}/tcp/${this.ip}/${port}`;
  }
}
