import { ExeScriptRequest } from "ya-ts-client/dist/ya-activity/src/models/index.js";
import { Command, Deploy, Run, Start } from "./command.js";

/**
 * @hidden
 */
export class Script {
  static create(commands?: Command[]): Script {
    return new Script(commands);
  }
  constructor(private commands: Command[] = []) {}
  add(command: Command) {
    this.commands.push(command);
  }
  async before() {
    for (const cmd of this.commands) await cmd.before();
  }
  async after() {
    for (const cmd of this.commands) await cmd.after();
  }
  getExeScriptRequest(): ExeScriptRequest {
    if (!this.commands.length) throw new Error("There are no commands in the script");
    return { text: JSON.stringify(this.commands.map((cmd) => cmd.toJson())) };
  }
}
