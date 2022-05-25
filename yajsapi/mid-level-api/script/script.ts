import { ExeScriptRequest } from "ya-ts-client/dist/ya-activity/src/models";

export class Script {
  constructor(private commands: Command[]) {}
  getExeScriptRequest(): ExeScriptRequest {
    return { text: JSON.stringify(this.commands.map((cmd) => cmd.toJson())) };
  }
}

interface StorageProvider {
  todo: 1;
}

abstract class Command {
  abstract commandName: string;

  constructor(private args?: object) {}
  toJson() {
    return {
      [this.commandName]: this.args,
    };
  }
}

export class Deploy extends Command {
  commandName = "deploy";
}
export class Start extends Command {
  commandName = "start";
}
export class Run extends Command {
  commandName = "run";
  constructor(cmd: string, args?: string[], env?: object) {
    super({
      entry_point: cmd,
      args,
      env,
    });
  }
}
export class Terminate extends Command {
  commandName = "terminate";
}

class SendJson extends Command {
  commandName = "send";
  constructor(json: object, dstPath: string) {
    super({ todo: 1 });
  }
}
