/**
 * Base class for all errors directly thrown by Golem SDK.
 */
export abstract class GolemError extends Error {
  constructor(
    message: string,
    public readonly previous?: Error,
  ) {
    super(message);
  }
}

export class GolemUserError extends GolemError {}
export class GolemAbortError extends GolemUserError {}

export class GolemInternalError extends GolemError {}

export class GolemTimeoutError extends GolemError {}

export abstract class GolemModuleError extends GolemError {
  constructor(
    message: string,
    public code: number,
    previous?: Error,
  ) {
    super(message, previous);
  }
}
