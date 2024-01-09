import { Logger } from "../../../src";

export class LoggerMock implements Logger {
  private _logs: { msg: string; ctx?: Record<string, unknown> | Error }[] = [];

  constructor(private silent = true) {}

  child(): Logger {
    return this;
  }

  async expectToInclude(msg: string, ctx?: Record<string, unknown> | Error, wait?: number) {
    if (wait) await new Promise((res) => setTimeout(res, wait));

    return expect(this._logs).toContainEqual({ msg, ctx });
  }

  async expectToMatch(msg: RegExp, wait?: number) {
    if (wait) await new Promise((res) => setTimeout(res, wait));

    return expect(this.logs).toMatch(msg);
  }

  async expectToNotMatch(msg: RegExp, wait?: number) {
    if (wait) await new Promise((res) => setTimeout(res, wait));
    return expect(this.logs).not.toMatch(msg);
  }

  get logs() {
    return this._logs.map(({ ctx, msg }) => `${msg} ${ctx ? JSON.stringify(ctx) : ""}`).join("\n");
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

  private log(msg: string, ctx?: Record<string, unknown> | Error, level = "info") {
    const stringifiedContext = ctx === undefined ? "" : JSON.stringify(ctx, null, 2);
    if (!this.silent)
      console.log(
        `\x1b[32m[test]\x1b[0m \x1b[36m${new Date().toISOString()}\x1b[0m ${this.levelColor(
          level,
        )} ${msg} ${stringifiedContext}`,
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
