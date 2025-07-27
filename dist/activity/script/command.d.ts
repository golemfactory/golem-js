import { ActivityApi } from "ya-ts-client";
import { StorageProvider } from "../../shared/storage";
import { Result } from "../results";
/**
 * Generic command that can be send to an exe-unit via yagna's API
 */
export declare class Command<T = unknown> {
    private commandName;
    protected args: Record<string, unknown>;
    constructor(commandName: string, args?: Record<string, unknown>);
    /**
     * Serializes the command to a JSON representation
     */
    toJson(): {
        [x: string]: Record<string, unknown>;
    };
    /**
     * Converts the command into
     */
    toExeScriptRequest(): ActivityApi.ExeScriptRequestDTO;
    /**
     * Setup local environment for executing this command.
     */
    before(): Promise<void>;
    /**
     * Cleanup local setup that was needed for the command to run.
     *
     * It is called after the command was sent to the activity, and the command was processed.
     *
     * When run within scripts or batch commands, after() might be called without any results, as one of the previous
     * commands might have failed. In this case, the command should still cleanup its local setup and return an empty
     * error result.
     *
     * @param result
     */
    after(result?: Result<T>): Promise<Result<T>>;
}
export type DeployArgs = {
    net?: DeployNetworkArgs[];
    volumes?: DeployVolumesArgs;
};
type DeployNetworkArgs = {
    id: string;
    ip: string;
    mask: string;
    gateway?: string;
    nodes: {
        [ip: string]: string;
    };
    nodeIp: string;
};
type DeployVolumesArgs = {
    [path: string]: {
        storage: {
            /** @example 7000m */
            size: string;
            errors?: "panic";
        };
    };
};
export declare class Deploy extends Command {
    constructor(args?: DeployArgs);
}
export declare class Start extends Command {
    constructor(args?: Record<string, unknown>);
}
export type Capture = {
    stdout?: CaptureMode;
    stderr?: CaptureMode;
};
export type CaptureMode = {
    atEnd: {
        part?: CapturePart;
        format?: CaptureFormat;
    };
} | {
    stream: {
        limit?: number;
        format?: CaptureFormat;
    };
};
export type CapturePart = {
    head: number;
} | {
    tail: number;
} | {
    headTail: number;
};
export type CaptureFormat = "string" | "binary";
export declare class Run extends Command {
    constructor(cmd: string, args?: string[] | null, env?: object | null, capture?: Capture);
}
export declare class Terminate extends Command {
    constructor(args?: Record<string, unknown>);
}
export declare class Transfer<T = unknown> extends Command<T> {
    protected from?: string | undefined;
    protected to?: string | undefined;
    constructor(from?: string | undefined, to?: string | undefined, args?: object);
}
export declare class UploadFile extends Transfer {
    private storageProvider;
    private src;
    private dstPath;
    constructor(storageProvider: StorageProvider, src: string, dstPath: string);
    before(): Promise<void>;
    after(result: Result): Promise<Result>;
}
export declare class UploadData extends Transfer {
    private storageProvider;
    private src;
    private dstPath;
    constructor(storageProvider: StorageProvider, src: Uint8Array, dstPath: string);
    before(): Promise<void>;
    after(result: Result): Promise<Result>;
}
export declare class DownloadFile extends Transfer {
    private storageProvider;
    private srcPath;
    private dstPath;
    constructor(storageProvider: StorageProvider, srcPath: string, dstPath: string);
    before(): Promise<void>;
    after(result: Result): Promise<Result>;
}
export declare class DownloadData extends Transfer<Uint8Array> {
    private storageProvider;
    private srcPath;
    private chunks;
    constructor(storageProvider: StorageProvider, srcPath: string);
    before(): Promise<void>;
    after(result: Result): Promise<Result<Uint8Array>>;
    private combineChunks;
}
export {};
