import { GolemModuleError } from "../shared/error/golem-error";
import { NetworkInfo } from "./network";
export declare enum NetworkErrorCode {
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
    NetworkRemoved = "NetworkRemoved"
}
export declare class GolemNetworkError extends GolemModuleError {
    #private;
    code: NetworkErrorCode;
    previous?: Error | undefined;
    constructor(message: string, code: NetworkErrorCode, network?: NetworkInfo, previous?: Error | undefined);
    getNetwork(): NetworkInfo | undefined;
}
