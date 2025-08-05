import { GolemModuleError } from "../../shared/error/golem-error";
import { Agreement, ProviderInfo } from "../../market/agreement";
import { Activity } from "../index";
export declare enum WorkErrorCode {
    ServiceNotInitialized = "ServiceNotInitialized",
    ScriptExecutionFailed = "ScriptExecutionFailed",
    ActivityDestroyingFailed = "ActivityDestroyingFailed",
    ActivityResultsFetchingFailed = "ActivityResultsFetchingFailed",
    ActivityCreationFailed = "ActivityCreationFailed",
    NetworkSetupMissing = "NetworkSetupMissing",
    ScriptInitializationFailed = "ScriptInitializationFailed",
    ActivityDeploymentFailed = "ActivityDeploymentFailed",
    ActivityStatusQueryFailed = "ActivityStatusQueryFailed",
    ActivityResetFailed = "ActivityResetFailed"
}
export declare class GolemWorkError extends GolemModuleError {
    #private;
    code: WorkErrorCode;
    previous?: Error | undefined;
    constructor(message: string, code: WorkErrorCode, agreement?: Agreement, activity?: Activity, provider?: ProviderInfo, previous?: Error | undefined);
    getAgreement(): Agreement | undefined;
    getActivity(): Activity | undefined;
    getProvider(): ProviderInfo | undefined;
}
