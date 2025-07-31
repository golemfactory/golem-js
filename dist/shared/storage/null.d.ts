import { StorageProvider, StorageProviderDataCallback } from "./provider";
/**
 * Null Storage Provider.
 *
 * Blocks all storage operations. Any attempt to use storage will result in an error.
 *
 * This will be the default storage provider if no default storage provider is available
 * for the platform the SDK is running on.
 *
 * @category mid-level
 */
export declare class NullStorageProvider implements StorageProvider {
    close(): Promise<void>;
    init(): Promise<void>;
    publishData(src: Uint8Array): Promise<string>;
    publishFile(src: string): Promise<string>;
    receiveFile(path: string): Promise<string>;
    receiveData(callback: StorageProviderDataCallback): Promise<string>;
    release(urls: string[]): Promise<void>;
    isReady(): boolean;
}
