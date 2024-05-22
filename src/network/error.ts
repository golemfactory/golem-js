import { GolemModuleError } from "../shared/error/golem-error";
import { NetworkInfo } from "./network";

export enum NetworkErrorCode {
  ServiceNotInitialized = "ServiceNotInitialized",
  NetworkSetupMissing = "NetworkSetupMissing",
  NetworkCreationFailed = "NetworkCreationFailed",
  NoAddressesAvailable = "NoAddressesAvailable",
  AddressOutOfRange = "AddressOutOfRange",
  AddressAlreadyAssigned = "AddressAlreadyAssigned",
  NodeAddingFailed = "NodeAddingFailed",
  NodeRemovalFailed = "NodeRemovalFailed",
  NetworkRemovalFailed = "NetworkRemovalFailed",
  GettingIdentityFailed = "GettingIdentityFailed",
}

export class GolemNetworkError extends GolemModuleError {
  #network?: NetworkInfo;
  constructor(
    message: string,
    public code: NetworkErrorCode,
    network?: NetworkInfo,
    public previous?: Error,
  ) {
    super(message, code, previous);
    this.#network = network;
  }
  public getNetwork(): NetworkInfo | undefined {
    return this.#network;
  }
}
