import { Logger } from "../../../src";

function ctxToString(ctx: Record<string, unknown> | Error | undefined) {
  if (!ctx) return "[no context]";
  if (ctx instanceof Error) return ctx.message;
  try {
    return JSON.stringify(ctx);
  } catch (e) {
    return ctx.toString();
  }
}

/**
 * @deprecated Avoid using this in new tests, this is going to be removed - use ts-mockito instead. In general, don't test with log lines ;)
 */
export class LoggerMock implements Logger {
  private _logs: { msg: string; ctx?: Record<string, unknown> | Error }[] = [];

  constructor(private silent = true) {}

  child(): Logger {
    return this;
  }

  async expectToInclude(msg: string, ctx?: Record<string, unknown> | Error, waitMs?: number) {
    if (waitMs) await new Promise((res) => setTimeout(res, waitMs));

    return expect(this._logs).toContainEqual({ msg, ctx });
  }

  async expectToMatch(msg: RegExp, waitMs?: number) {
    if (waitMs) await new Promise((res) => setTimeout(res, waitMs));

    return expect(this.logs).toMatch(msg);
  }

  async expectToNotMatch(msg: RegExp, waitMs?: number) {
    if (waitMs) await new Promise((res) => setTimeout(res, waitMs));
    return expect(this.logs).not.toMatch(msg);
  }

  get logs() {
    return this._logs.map(({ ctx, msg }) => `${msg} ${ctxToString(ctx)}`).join("\n");
  }

  clear() {
    this._logs = [];
  }

  error(msg: string, ctx?: Record<string, unknown> | Error) {
    this.log(msg, ctx, "error");
  }

  info(msg: string, ctx?: Record<string, unknown> | Error) {
    this.log(msg, ctx, "info");
  }

  warn(msg: string, ctx?: Record<string, unknown> | Error) {
    this.log(msg, ctx, "warn");
  }

  debug(msg: string, ctx?: Record<string, unknown> | Error) {
    this.log(msg, ctx, "debug");
  }

  private log(msg: string, ctx?: Record<string, unknown> | Error, level = "info") {
    if (!this.silent)
      console.log(
        `\x1b[32m[test]\x1b[0m \x1b[36m${new Date().toISOString()}\x1b[0m ${this.levelColor(
          level,
        )} ${msg} ${ctxToString(ctx)}`,
      );
    this._logs.push({
      msg,
      ctx,
    });
  }

  levelColor(level) {
    switch (level) {
      case "warn":
        return `\x1b[33m[${level}]\x1b[0m`;
      case "info":
        return `\x1b[34m[${level}]\x1b[0m`;
    }
  }
}
