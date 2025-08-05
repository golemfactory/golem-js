import { Result } from "../index";
import { StorageProvider } from "../../shared/storage";
import { Logger } from "../../shared/utils";
import { ExeScriptExecutor } from "../exe-script-executor";
import { Observable } from "rxjs";
export declare class Batch {
    private executor;
    private storageProvider;
    private logger;
    private readonly script;
    constructor(executor: ExeScriptExecutor, storageProvider: StorageProvider, logger: Logger);
    /**
     * Execute a command on provider using a shell (/bin/sh).
     *
     * @param commandLine Shell command to execute.
     */
    run(commandLine: string): Batch;
    /**
     * Execute an executable on provider.
     *
     * @param executable Executable to run.
     * @param args Executable arguments.
     */
    run(executable: string, args: string[]): Batch;
    transfer(from: string, to: string): Batch;
    uploadFile(src: string, dst: string): Batch;
    uploadJson(json: object, dst: string): Batch;
    uploadData(data: Uint8Array, dst: string): Batch;
    downloadFile(src: string, dst: string): Batch;
    /**
     * Executes the batch of commands added via {@link run} returning result for each of the steps.
     */
    end(): Promise<Result[]>;
    endStream(): Promise<Observable<Result>>;
}
