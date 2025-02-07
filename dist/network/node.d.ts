import { NetworkInfo } from "./network";
import { DeployArgs } from "../activity/script/command";
/**
 * Describes a node in a VPN, mapping a Golem node id to an IP address
 */
export declare class NetworkNode {
    readonly id: string;
    readonly ip: string;
    getNetworkInfo: () => NetworkInfo;
    yagnaBaseUri: string;
    constructor(id: string, ip: string, getNetworkInfo: () => NetworkInfo, yagnaBaseUri: string);
    /**
     * Generate a dictionary of arguments that are required for the appropriate
     *`Deploy` command of an exe-script in order to pass the network configuration to the runtime
     * on the provider's end.
     */
    getNetworkDeploymentArg(): Pick<DeployArgs, "net">;
    getWebsocketUri(port: number): string;
}
