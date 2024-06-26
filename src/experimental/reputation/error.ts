import { GolemModuleError } from "../../shared/error/golem-error";

export class GolemReputationError extends GolemModuleError {
  constructor(message: string, cause?: Error) {
    super(message, 0, cause);
  }
}
