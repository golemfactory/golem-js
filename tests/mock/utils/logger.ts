import { Logger } from "../../../yajsapi/utils";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;
export class LoggerMock implements Logger {
  level = "debug";
  private _logs = "";

  constructor(private silent = true) {}

  async expectToInclude(msg: string, wait?: number) {
    if (wait) await new Promise((res) => setTimeout(res, wait));
    return expect(this._logs).to.be.include(
      msg,
      `Logs do not include message: ${msg}. Current logs:\n\n${this._logs}\n\n`
    );
  }
  async expectToMatch(msg: RegExp, wait?: number) {
    if (wait) await new Promise((res) => setTimeout(res, wait));
    return expect(this._logs).to.be.match(msg, `Logs do not match message: ${msg}. Current logs:\n\n${this._logs}\n\n`);
  }

  async expectToNotMatch(msg: RegExp, wait?: number) {
    if (wait) await new Promise((res) => setTimeout(res, wait));
    return expect(this._logs).not.to.be.match(msg);
  }

  get logs() {
    return this._logs;
  }
  clear() {
    this._logs = "";
  }
  debug(msg) {
    this.log(msg, "debug");
  }
  error(msg) {
    this.log(msg, "error");
  }
  info(msg) {
    this.log(msg, "info");
  }
  warn(msg) {
    this.log(msg, "warn");
  }
  log(msg, level = "info") {
    if (!this.silent)
      console.log(`\x1b[32m[test]\x1b[0m \x1b[36m${new Date().toISOString()}\x1b[0m ${this.levelColor(level)} ${msg}`);
    this._logs += `${msg}\n`;
  }
  setLevel(level: string) {
    this.level = level;
  }

  levelColor(level) {
    switch (level) {
      case "warn":
        return `\x1b[33m[${level}]\x1b[0m`;
      case "info":
        return `\x1b[34m[${level}]\x1b[0m`;
      case "error":
        return `\x1b[31m[${level}]\x1b[0m`;
      case "debug":
        return `\x1b[35m[${level}]\x1b[0m`;
    }
  }
}
