import { Activity, ActivityModule, Result } from "../index";
import { Logger } from "../../shared/utils";
import { Observable, Subject } from "rxjs";
/**
 * RemoteProcess class representing the process spawned on the provider by {@link ExeUnit.runAndStream}
 */
export declare class RemoteProcess {
    private readonly activityModule;
    private activity;
    private readonly logger;
    /**
     * Stream connected to stdout from provider process
     */
    readonly stdout: Subject<Result["stdout"]>;
    /**
     * Stream connected to stderr from provider process
     */
    readonly stderr: Subject<Result["stderr"]>;
    private lastResult?;
    private streamError?;
    private subscription;
    constructor(activityModule: ActivityModule, activityResult$: Observable<Result>, activity: Activity, logger: Logger);
    /**
     * Waits for the process to complete and returns the last part of the command's results as a {@link Result} object.
     * If the timeout is reached, the return promise will be rejected.
     * @param timeout - maximum waiting time im ms for the final result (default: 20_000)
     */
    waitForExit(timeout?: number): Promise<Result>;
    /**
     * Checks if the exe-script batch from Yagna has completed, reflecting all work and streaming to be completed
     */
    isFinished(): boolean;
}
