import { GolemModuleError } from "../../shared/error/golem-error";
export declare class GolemReputationError extends GolemModuleError {
    constructor(message: string, cause?: Error);
}
