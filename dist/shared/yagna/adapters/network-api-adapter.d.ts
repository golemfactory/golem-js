import { YagnaApi } from "../yagnaApi";
import { INetworkApi, Network, NetworkNode } from "../../../network";
export declare class NetworkApiAdapter implements INetworkApi {
    private readonly yagnaApi;
    constructor(yagnaApi: YagnaApi);
    createNetwork(options: {
        ip: string;
        mask?: string;
        gateway?: string;
    }): Promise<Network>;
    removeNetwork(network: Network): Promise<void>;
    createNetworkNode(network: Network, nodeId: string, nodeIp: string): Promise<NetworkNode>;
    removeNetworkNode(network: Network, node: NetworkNode): Promise<void>;
    getIdentity(): Promise<string>;
}
