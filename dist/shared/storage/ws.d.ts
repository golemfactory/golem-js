import { StorageProvider, StorageProviderDataCallback } from "./provider";
import { Logger, YagnaApi } from "../utils";
export interface WebSocketStorageProviderOptions {
    logger?: Logger;
}
/**
 * Storage provider that uses GFTP over WebSockets.
 */
export declare class WebSocketStorageProvider implements StorageProvider {
    private readonly yagnaApi;
    /**
     * Map of open services (IDs) indexed by GFTP url.
     */
    private services;
    private logger;
    private ready;
    private openHandles;
    constructor(yagnaApi: YagnaApi, options?: WebSocketStorageProviderOptions);
    close(): Promise<void>;
    init(): Promise<void>;
    publishData(data: Uint8Array): Promise<string>;
    publishFile(src: string): Promise<string>;
    receiveData(callback: StorageProviderDataCallback): Promise<string>;
    receiveFile(path: string): Promise<string>;
    release(urls: string[]): Promise<void>;
    isReady(): boolean;
    private createFileInfo;
    private getWsConstructor;
    private createSocket;
    private createService;
    private deleteService;
    private respond;
    private completeReceive;
}
