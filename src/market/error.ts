import { GolemModuleError } from "../error/golem-error";
import { Demand } from "./demand";

export enum MarketErrorCode {
  NotInitialized,
  MissingAllocation,
}

export class GolemMarketError extends GolemModuleError {
  constructor(
    message: string,
    public code?: MarketErrorCode,
    public demand?: Demand,
  ) {
    super(message, 0);
  }
}
