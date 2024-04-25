import { ActivityApi } from "ya-ts-client";
import { Command } from "./command";
import { Result } from "../index";
import { GolemInternalError } from "../../shared/error/golem-error";

/**
 * Represents a series of Commands that can be sent to exe-unit via yagna's API
 */
export class Script {
  constructor(private commands: Command[] = []) {}

  static create(commands?: Command[]): Script {
    return new Script(commands);
  }

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

  getExeScriptRequest(): ActivityApi.ExeScriptRequestDTO {
    if (!this.commands.length) {
      throw new GolemInternalError("There are no commands in the script");
    }
    return { text: JSON.stringify(this.commands.map((cmd) => cmd.toJson())) };
  }
}
