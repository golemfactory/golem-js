import { ActivityApi } from "ya-ts-client";
import { Command } from "./command";
import { Result } from "../index";
/**
 * Represents a series of Commands that can be sent to exe-unit via yagna's API
 */
export declare class Script {
    private commands;
    constructor(commands?: Command[]);
    static create(commands?: Command[]): Script;
    add(command: Command): void;
    before(): Promise<void>;
    after(results: Result[]): Promise<Result[]>;
    getExeScriptRequest(): ActivityApi.ExeScriptRequestDTO;
}
