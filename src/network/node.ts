import { NetworkInfo } from "./network";
import { DeployArgs } from "../activity/script/command";

/**
 * Describes a node in a VPN, mapping a Golem node id to an IP address
 */
export class NetworkNode {
  constructor(
    public readonly id: string,
    public readonly ip: string,
    public getNetworkInfo: () => NetworkInfo,
    public yagnaBaseUri: string,
  ) {}

  /**
   * Generate a dictionary of arguments that are required for the appropriate
   *`Deploy` command of an exe-script in order to pass the network configuration to the runtime
   * on the provider's end.
   */
  getNetworkDeploymentArg(): Pick<DeployArgs, "net"> {
    return {
      net: [
        {
          ...this.getNetworkInfo(),
          nodeIp: this.ip,
        },
      ],
    };
  }

  getWebsocketUri(port: number): string {
    const url = new URL(this.yagnaBaseUri);
    url.protocol = "ws";
    return `${url.href}/net/${this.getNetworkInfo().id}/tcp/${this.ip}/${port}`;
  }
}
