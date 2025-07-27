import { EventEmitter } from "eventemitter3";
import { Network } from "./network";
import { Logger } from "../shared/utils";
import { INetworkApi, NetworkEvents } from "./api";
import { NetworkNode } from "./node";
export interface NetworkOptions {
    /**
     * The IP address of the network. May contain netmask, e.g. "192.168.0.0/24".
     * This field can include the netmask directly in CIDR notation.
     * @default "192.168.0.0"
     */
    ip?: string;
    /**
     * The desired IP address of the requestor node within the newly-created network.
     * This field is optional and if not provided, the first available IP address will be assigned.
     */
    ownerIp?: string;
    /**
     * Optional network mask given in dotted decimal notation.
     * If the ip address was provided in Cidr notation this mask will override the mask from the Cidr notation
     */
    mask?: string;
    /**
     * Optional gateway address for the network.
     * This field can be used to specify a gateway IP address for the network.
     */
    gateway?: string;
}
export interface NetworkModule {
    events: EventEmitter<NetworkEvents>;
    /**
     * Creates a new network with the specified options.
     * @param options NetworkOptions
     */
    createNetwork(options?: NetworkOptions): Promise<Network>;
    /**
     * Removes an existing network.
     * @param network - The network to be removed.
     */
    removeNetwork(network: Network): Promise<void>;
    /**
     * Creates a new node within a specified network.
     * @param network - The network to which the node will be added.
     * @param nodeId - The ID of the node to be created.
     * @param nodeIp - Optional IP address for the node. If not provided, the first available IP address will be assigned.
     */
    createNetworkNode(network: Network, nodeId: string, nodeIp?: string): Promise<NetworkNode>;
    /**
     * Removes an existing node from a specified network.
     * @param network - The network from which the node will be removed.
     * @param node - The node to be removed.
     */
    removeNetworkNode(network: Network, node: NetworkNode): Promise<void>;
}
export declare class NetworkModuleImpl implements NetworkModule {
    events: EventEmitter<NetworkEvents>;
    private readonly networkApi;
    private readonly logger;
    private lock;
    constructor(deps: {
        logger?: Logger;
        networkApi: INetworkApi;
    });
    createNetwork(options?: NetworkOptions): Promise<Network>;
    removeNetwork(network: Network): Promise<void>;
    createNetworkNode(network: Network, nodeId: string, nodeIp?: string): Promise<NetworkNode>;
    removeNetworkNode(network: Network, node: NetworkNode): Promise<void>;
    private getFreeIpInNetwork;
}
