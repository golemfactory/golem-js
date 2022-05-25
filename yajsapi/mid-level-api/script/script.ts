import { ExeScriptRequest } from "ya-ts-client/dist/ya-activity/src/models";
import { Command } from "./command";

export class Script {
  constructor(private commands: Command[]) {}
  getExeScriptRequest(): ExeScriptRequest {
    return { text: JSON.stringify(this.commands.map((cmd) => cmd.toJson())) };
  }
}
