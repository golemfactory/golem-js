import { IPv4 } from "ip-num";
import { NetworkNode } from "./node";
export interface NetworkInfo {
    id: string;
    ip: string;
    mask: string;
    gateway?: string;
    nodes: {
        [ip: string]: string;
    };
}
export declare enum NetworkState {
    Active = "Active",
    Removed = "Removed"
}
export declare class Network {
    readonly id: string;
    private readonly ip;
    private readonly ipRange;
    private ipIterator;
    private mask;
    private gateway?;
    private nodes;
    private state;
    constructor(id: string, ip: string, mask?: string, gateway?: string);
    /**
     * Returns information about the network.
     */
    getNetworkInfo(): NetworkInfo;
    /**
     * Adds a node to the network.
     * @param node - The network node to be added.
     */
    addNode(node: NetworkNode): void;
    /**
     * Checks whether the node belongs to the network.
     * @param node - The network node to check.
     */
    hasNode(node: NetworkNode): boolean;
    /**
     * Removes a node from the network.
     * @param node - The network node to be removed.
     */
    removeNode(node: NetworkNode): void;
    markAsRemoved(): void;
    /**
     * Returns the first available IP address in the network.
     */
    getFirstAvailableIpAddress(): IPv4;
    /**
     * Checks if a given IP address is within the network range.
     * @param ip - The IPv4 address to check.
     */
    isIpInNetwork(ip: IPv4): boolean;
    /**
     * Checks if a given node ID is unique within the network.
     * @param id - The node ID to check.
     */
    isNodeIdUnique(id: string): boolean;
    /**
     * Checks if a given IP address is unique within the network.
     */
    isNodeIpUnique(ip: IPv4): boolean;
    isRemoved(): boolean;
}
