import { FileServerEntry, IFileServer } from "../../activity";
import { StorageProvider } from "./provider";
/**
 * IFileServer implementation that uses any StorageProvider to serve files.
 * Make sure that the storage provider implements the `.publishFile()` method.
 */
declare class StorageServerAdapter implements IFileServer {
    private readonly storage;
    private published;
    constructor(storage: StorageProvider);
    publishFile(sourcePath: string): Promise<{
        fileUrl: string;
        fileHash: string;
    }>;
    isServing(): boolean;
    getPublishInfo(sourcePath: string): FileServerEntry | undefined;
    isFilePublished(sourcePath: string): boolean;
    private calculateFileHash;
}
/**
 * @deprecated Use StorageServerAdapter instead. This will be removed in the next major version.
 *
 * This class provides GFTP based implementation of the IFileServer interface used in the SDK
 */
declare class GftpServerAdapter extends StorageServerAdapter {
}
export { GftpServerAdapter, StorageServerAdapter };
