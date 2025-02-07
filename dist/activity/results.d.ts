import { ActivityApi } from "ya-ts-client";
export interface ResultData<T = any> {
    /** Index of script command */
    index: number;
    /** The datetime of the event on which the result was received */
    eventDate: string;
    /** If is success */
    result: ActivityApi.ExeScriptCommandResultDTO["result"];
    /** stdout of script command */
    stdout?: string | ArrayBuffer | null;
    /** stderr of script command */
    stderr?: string | ArrayBuffer | null;
    /** an error message if the result is not successful */
    message?: string | null;
    /** Is batch of already finished */
    isBatchFinished?: boolean;
    /** In case the command was related to upload or download, this will contain the transferred data */
    data?: T;
}
export declare class Result<TData = any> implements ResultData<TData> {
    index: number;
    eventDate: string;
    result: ActivityApi.ExeScriptCommandResultDTO["result"];
    stdout?: string | ArrayBuffer | null;
    stderr?: string | ArrayBuffer | null;
    message?: string | null;
    isBatchFinished?: boolean;
    data?: TData;
    constructor(props: ResultData);
    /**
     * Helper method making JSON-like output results more accessible
     */
    getOutputAsJson<Output = object>(): Output;
}
export interface StreamingBatchEvent {
    batch_id: string;
    index: number;
    timestamp: string;
    kind: RuntimeEventKind;
}
export interface RuntimeEventKind {
    started?: RuntimeEventStarted;
    stdout?: string | ArrayBuffer;
    stderr?: string | ArrayBuffer;
    finished?: RuntimeEventFinished;
}
export interface RuntimeEventStarted {
    command: object;
}
export interface RuntimeEventFinished {
    return_code: number;
    message: string | null;
}
