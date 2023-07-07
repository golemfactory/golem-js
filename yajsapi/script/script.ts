import { ExeScriptRequest } from "ya-ts-client/dist/ya-activity/src/models/index.js";
import { Command } from "./command.js";
import { Result } from "../activity";

/**
 * @category Mid-level
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
    await Promise.all(this.commands.map((cmd) => cmd.before()));
  }
  async after(results: Result[]): Promise<Result[]> {
    // Call after() for each command mapping its result.
    return Promise.all(this.commands.map((command, i) => command.after(results[i])));
  }

  getExeScriptRequest(): ExeScriptRequest {
    if (!this.commands.length) throw new Error("There are no commands in the script");
    return { text: JSON.stringify(this.commands.map((cmd) => cmd.toJson())) };
  }
}
