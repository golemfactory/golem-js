import { YagnaApi } from "../yagnaApi";
import { INetworkApi, Network, NetworkNode } from "../../../network";
export declare class NetworkApiAdapter implements INetworkApi {
    private readonly yagnaApi;
    constructor(yagnaApi: YagnaApi);
    createNetwork(options: {
        ip: string;
        mask?: string;
        gateway?: string;
    }, signalOrTimeout?: AbortSignal | number): Promise<Network>;
    removeNetwork(network: Network, signalOrTimeout?: AbortSignal | number): Promise<void>;
    createNetworkNode(network: Network, nodeId: string, nodeIp: string, signalOrTimeout?: AbortSignal | number): Promise<NetworkNode>;
    removeNetworkNode(network: Network, node: NetworkNode, signalOrTimeout?: AbortSignal | number): Promise<void>;
    getIdentity(signalOrTimeout?: AbortSignal | number): Promise<string>;
}
