import { GolemModuleError } from "../../shared/error/golem-error";
import { Agreement, ProviderInfo } from "../../agreement";
import { Activity } from "../index";

export enum WorkErrorCode {
  ServiceNotInitialized = "ServiceNotInitialized",
  ScriptExecutionFailed = "ScriptExecutionFailed",
  ActivityDestroyingFailed = "ActivityDestroyingFailed",
  ActivityResultsFetchingFailed = "ActivityResultsFetchingFailed",
  ActivityCreationFailed = "ActivityCreationFailed",
  NetworkSetupMissing = "NetworkSetupMissing",
  ScriptInitializationFailed = "ScriptInitializationFailed",
  ActivityDeploymentFailed = "ActivityDeploymentFailed",
  ActivityStatusQueryFailed = "ActivityStatusQueryFailed",
  ActivityResetFailed = "ActivityResetFailed",
}
export class GolemWorkError extends GolemModuleError {
  #agreement?: Agreement;
  #activity?: Activity;
  #provider?: ProviderInfo;
  constructor(
    message: string,
    public code: WorkErrorCode,
    agreement?: Agreement,
    activity?: Activity,
    provider?: ProviderInfo,
    public previous?: Error,
  ) {
    super(message, code, previous);
    this.#agreement = agreement;
    this.#activity = activity;
    this.#provider = provider;
  }
  public getAgreement(): Agreement | undefined {
    return this.#agreement;
  }
  public getActivity(): Activity | undefined {
    return this.#activity;
  }
  public getProvider(): ProviderInfo | undefined {
    return this.#provider;
  }
}
