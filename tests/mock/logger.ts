import { Logger } from "../../yajsapi/utils";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;
export class LoggerMock implements Logger {
  level = "debug";
  private _logs = "";

  async expectToInclude(msg: string, timeout: number) {
    await new Promise((res) => setTimeout(res, timeout));
    return expect(this._logs).to.be.include(msg);
  }
  async expectToMatch(msg: RegExp, timeout: number) {
    await new Promise((res) => setTimeout(res, timeout));
    return expect(this._logs).to.be.match(msg);
  }

  get logs() {
    return this._logs;
  }
  clear() {
    this._logs = "";
  }
  debug(msg) {
    this.log(msg);
  }
  error(msg) {
    this.log(msg);
  }
  info(msg) {
    this.log(msg);
  }
  warn(msg) {
    this.log(msg);
  }
  log(msg) {
    this._logs += `${msg}\n`;
  }
  setLevel(level: string) {
    this.level = level;
  }
}
