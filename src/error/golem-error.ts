/**
 * Base class for all errors directly thrown by Golem SDK.
 */
export abstract class GolemError extends Error {
  public previous?: Error;
}

export class GolemUserError extends GolemError {}
export class GolemAbortError extends GolemUserError {}

export class GolemInternalError extends GolemError {}

export class GolemTimeoutError extends GolemError {}

export abstract class GolemModuleError extends GolemError {
  constructor(
    message: string,
    public code?: number,
  ) {
    super(message);
  }
}
