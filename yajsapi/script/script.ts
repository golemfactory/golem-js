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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private commands: Command<any>[] = []) {}
  add(command: Command) {
    this.commands.push(command);
  }
  async before() {
    await Promise.all(this.commands.map((cmd) => cmd.before()));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async after(results: Result<any>[]): Promise<Result<any>[]> {
    // Call after() for each command mapping its result.
    return Promise.all(this.commands.map((command, i) => command.after(results[i])));
  }

  getExeScriptRequest(): ExeScriptRequest {
    if (!this.commands.length) throw new Error("There are no commands in the script");
    return { text: JSON.stringify(this.commands.map((cmd) => cmd.toJson())) };
  }
}
