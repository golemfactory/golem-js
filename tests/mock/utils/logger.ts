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
    return expect(this._logs).to.be.include(msg);
  }
  async expectToMatch(msg: RegExp, wait?: number) {
    if (wait) await new Promise((res) => setTimeout(res, wait));
    return expect(this._logs).to.be.match(msg);
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
    this.log(msg, 'debug');
  }
  error(msg) {
    this.log(msg, 'error');
  }
  info(msg) {
    this.log(msg, 'info');
  }
  warn(msg,) {
    this.log(msg, 'warn');
  }
  log(msg, level='info') {
    if (!this.silent) console.log(`[test] ${new Date().toISOString()} [${level}] ${msg}`);
    this._logs += `${msg}\n`;
  }
  setLevel(level: string) {
    this.level = level;
  }
}
