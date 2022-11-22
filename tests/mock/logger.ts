import { Logger } from "../../yajsapi/utils";
export class LoggerMock implements Logger {
  level = "debug";
  private output?: string;

  getOutput() {
    return this.output;
  }
  debug(msg) {
    this.output += msg;
  }
  error(msg) {
    this.output += msg;
  }
  info(msg) {
    this.output += msg;
  }
  log(msg) {
    this.output += msg;
  }
  setLevel(level: string) {
    this.level += level;
  }
  warn(msg) {
    this.output += msg;
  }
}
