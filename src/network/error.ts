import { GolemModuleError } from "../error/golem-error";
import { NetworkInfo } from "./network";

export enum NetworkErrorCode {
  NetworkSetupMissing,
  NetworkCreationFailed,
  NoAddressesAvailable,
  AddressOutOfRange,
  AddressAlreadyAssigned,
  NodeAddingFailed,
  NetworkRemovalFailed,
}

export class GolemNetworkError extends GolemModuleError {
  constructor(
    message: string,
    public code: NetworkErrorCode,
    public network?: NetworkInfo,
    public previous?: Error,
  ) {
    super(message, code, previous);
  }
}
