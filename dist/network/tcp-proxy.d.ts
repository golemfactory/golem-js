import { EventEmitter } from "eventemitter3";
import { Logger } from "../shared/utils";
export interface TcpProxyEvents {
    /** Raised when the proxy encounters any sort of error */
    error: (err: unknown) => void;
}
/**
 * Configuration required by the TcpProxy to work properly
 */
export interface TcpProxyOptions {
    /**
     * The logger instance to use for logging
     */
    logger: Logger;
    /**
     * Number of seconds to wait between heart-beating the WS connection ot yagna
     *
     * @default 10
     */
    heartBeatSec: number;
}
/**
 * Allows proxying of TCP traffic to a service running in an activity on a provider via the requestor
 *
 * **IMPORTANT**
 *
 * This feature is supported only in the Node.js environment. In has no effect in browsers.
 *
 * General solution description:
 *
 * - Open a TCP server and listen to connections
 * - When a new connection arrives, establish a WS connection with yagna
 * - Pass any incoming data from the client TCP socket to the WS, buffer it when the socket is not ready yet
 * - Pass any returning data from the WS to the client TCP socket, but don't do it if the client socket already disconnected
 * - When the WS will be closed, then close the client socket as well
 * - When the client TCP socket will be closed, close the WS as well
 * - Handle teardown of the TCP-WS bridge by clearing communication buffers to avoid memory leaks
 */
export declare class TcpProxy {
    /**
     * The URL to the WebSocket implementing the communication transport layer
     */
    private readonly wsUrl;
    /**
     * The yagna app-key used to authenticate the WebSocket connection
     */
    private readonly appKey;
    private server;
    readonly events: EventEmitter<TcpProxyEvents, any>;
    private readonly logger;
    private readonly heartBeatSec;
    constructor(
    /**
     * The URL to the WebSocket implementing the communication transport layer
     */
    wsUrl: string, 
    /**
     * The yagna app-key used to authenticate the WebSocket connection
     */
    appKey: string, 
    /**
     * Additional options of the proxy
     */
    options?: Partial<TcpProxyOptions>);
    /**
     * Start the proxy in listening mode
     *
     * @param port The port number to use on the requestor
     * @param abort The abort controller to use in order to control cancelling requests
     */
    listen(port: number, abort?: AbortController): Promise<void>;
    /**
     * Gracefully close the proxy
     */
    close(): Promise<void>;
    private notifyOfError;
    private attachDebugLogsToServer;
}
