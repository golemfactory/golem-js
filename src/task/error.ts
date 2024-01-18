import { GolemModuleError } from "../error/golem-error";
import { Agreement, ProviderInfo } from "../agreement";
import { Activity } from "../activity";

export enum WorkErrorCode {
  ServiceNotInitialized,
  ScriptExecutionFailed,
  ActivityDestroyingFailed,
  ActivityResultsFetchingFailed,
  ActivityCreationFailed,
  TaskAddingFailed,
  TaskExecutionFailed,
  TaskRejected,
  NetworkSetupMissing,
  ScriptInitializationFailed,
  ActivityDeploymentFailed,
  ActivityStatusQueryFailed,
}
export class GolemWorkError extends GolemModuleError {
  constructor(
    message: string,
    public code: WorkErrorCode,
    public agreement?: Agreement,
    public activity?: Activity,
    public provider?: ProviderInfo,
    public previous?: Error,
  ) {
    super(message, code, previous);
  }
}
