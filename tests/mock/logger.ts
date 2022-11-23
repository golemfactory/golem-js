import { Logger } from "../../yajsapi/utils";
export class LoggerMock implements Logger {
  level = "debug";
  private _outputs = "";

  get outputs() {
    return this._outputs;
  }
  clear() {
    this._outputs = "";
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
    this._outputs += `${msg}\n`;
  }
  setLevel(level: string) {
    this.level = level;
  }
}
