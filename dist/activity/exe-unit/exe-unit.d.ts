import { Activity, ActivityModule, Result } from "../";
import { Capture } from "../script";
import { StorageProvider } from "../../shared/storage";
import { Logger, YagnaOptions } from "../../shared/utils";
import { Batch } from "./batch";
import { NetworkNode } from "../../network";
import { RemoteProcess } from "./process";
import { Agreement, ProviderInfo } from "../../market";
import { TcpProxy } from "../../network/tcp-proxy";
import { ExecutionOptions } from "../exe-script-executor";
export type LifecycleFunction = (exe: ExeUnit) => Promise<void>;
export type VolumeSpec = {
    /** Size of the volume to mount */
    sizeGib: number;
    /** Location of the volume */
    path: string;
};
export interface ExeUnitOptions {
    activityDeployingTimeout?: number;
    storageProvider?: StorageProvider;
    networkNode?: NetworkNode;
    logger?: Logger;
    yagnaOptions?: YagnaOptions;
    /** this function is called as soon as the exe unit is ready */
    setup?: LifecycleFunction;
    /** this function is called before the exe unit is destroyed */
    teardown?: LifecycleFunction;
    executionOptions?: ExecutionOptions;
    signalOrTimeout?: number | AbortSignal;
    volumes?: Record<string, VolumeSpec>;
}
export interface CommandOptions {
    signalOrTimeout?: number | AbortSignal;
    maxRetries?: number;
    env?: object;
    capture?: Capture;
}
export interface ActivityDTO {
    provider: ProviderInfo;
    id: string;
    agreement: Agreement;
}
/**
 * Groups most common operations that the requestors might need to implement their workflows
 */
export declare class ExeUnit {
    readonly activity: Activity;
    readonly activityModule: ActivityModule;
    private options?;
    readonly provider: ProviderInfo;
    private readonly logger;
    private readonly storageProvider;
    private readonly networkNode?;
    private executor;
    private readonly abortSignal;
    constructor(activity: Activity, activityModule: ActivityModule, options?: ExeUnitOptions | undefined);
    private fetchState;
    /**
     * This function initializes the exe unit by deploying the image to the remote machine
     * and preparing and running the environment.
     * This process also includes running setup function if the user has defined it
     */
    setup(): Promise<Result[] | void>;
    /**
     * This function starts the teardown function if the user has defined it.
     * It is run before the machine is destroyed.
     */
    teardown(): Promise<void>;
    private deployActivity;
    private setupActivity;
    /**
     * Execute a command on provider using a shell (/bin/sh).
     *
     * @param commandLine Shell command to execute.
     * @param options Additional run options.
     */
    run(commandLine: string, options?: CommandOptions): Promise<Result>;
    /**
     * Execute an executable on provider.
     *
     * @param executable Executable to run.
     * @param args Executable arguments.
     * @param options Additional run options.
     */
    run(executable: string, args: string[], options?: CommandOptions): Promise<Result>;
    /**
     * Run an executable on provider and return {@link RemoteProcess} that will allow streaming
     *   that contain stdout and stderr as Readable
     *
     * @param commandLine Shell command to execute.
     * @param options Additional run options.
     */
    runAndStream(commandLine: string, options?: Omit<CommandOptions, "capture">): Promise<RemoteProcess>;
    /**
     * @param executable Executable to run.
     * @param args Executable arguments.
     * @param options Additional run options.
     */
    runAndStream(executable: string, args: string[], options?: CommandOptions): Promise<RemoteProcess>;
    /**
     * Generic transfer command, requires the user to provide a publicly readable transfer source
     *
     * @param from - publicly available resource for reading. Supported protocols: file, http, ftp or gftp
     * @param to - file path
     * @param options Additional run options.
     */
    transfer(from: string, to: string, options?: CommandOptions): Promise<Result>;
    uploadFile(src: string, dst: string, options?: CommandOptions): Promise<Result>;
    uploadJson(json: any, dst: string, options?: CommandOptions): Promise<Result>;
    uploadData(data: Uint8Array, dst: string, options?: CommandOptions): Promise<Result>;
    downloadFile(src: string, dst: string, options?: CommandOptions): Promise<Result>;
    downloadData(src: string, options?: CommandOptions): Promise<Result<Uint8Array>>;
    downloadJson(src: string, options?: CommandOptions): Promise<Result>;
    beginBatch(): Batch;
    /**
     * Provides a WebSocket URI that allows communicating with a remote process listening on the target port
     *
     * @param port The port number used by the service running within an activity on the provider
     */
    getWebsocketUri(port: number): string;
    getIp(): string;
    /**
     * Creates a new TCP proxy that will allow tunnelling the TPC traffic from the provider via the requestor
     *
     * @param portOnProvider The port that the service running on the provider is listening to
     */
    createTcpProxy(portOnProvider: number): TcpProxy;
    getDto(): ActivityDTO;
    private runOneCommand;
    private getVolumeDeploymentArg;
}
