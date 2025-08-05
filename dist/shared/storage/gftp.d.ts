import { StorageProvider } from "./provider";
import { Logger } from "../utils";
/**
 * @deprecated Use WebSocketStorageProvider instead. This will be removed in the next major version.
 *
 * Storage provider that spawns a GFTP process and uses it to serve files.
 */
export declare class GftpStorageProvider implements StorageProvider {
    private gftpServerProcess?;
    private logger;
    /**
     * All published URLs to be release on close().
     * @private
     */
    private publishedUrls;
    private isInitialized;
    private reader?;
    /**
     * lock against parallel writing to stdin in gftp process
     * @private
     */
    private lock;
    constructor(logger?: Logger);
    init(): Promise<void>;
    private startGftpServer;
    private generateTempFileName;
    receiveFile(path: string): Promise<string>;
    receiveData(): Promise<string>;
    publishFile(src: string): Promise<string>;
    publishData(src: Uint8Array): Promise<string>;
    release(): Promise<void>;
    private releaseAll;
    close(): Promise<void>;
    private jsonRpc;
    private uploadStream;
    private uploadBytes;
    private uploadFile;
    isReady(): boolean;
}
