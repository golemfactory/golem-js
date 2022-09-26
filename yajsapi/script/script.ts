import { ExeScriptRequest } from "ya-ts-client/dist/ya-activity/src/models";
import { Command } from "./command";

export class Script {
  constructor(private commands: Command[] = []) {}
  addCommand(command: Command) {
    this.commands.push(command);
  }
  async before() {
    for (const cmd of this.commands) await cmd.before();
  }
  async after() {
    for (const cmd of this.commands) await cmd.after();
  }
  getExeScriptRequest(): ExeScriptRequest {
    if (!this.commands.length) throw new Error("No commands yet");
    return { text: JSON.stringify(this.commands.map((cmd) => cmd.toJson())) };
  }
}
