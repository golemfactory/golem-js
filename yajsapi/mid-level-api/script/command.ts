import { ExeScriptRequest } from "ya-ts-client/dist/ya-activity/src/models";

export class Command {
  constructor(private commandName: string, private args?: object) {}
  toJson() {
    return {
      [this.commandName]: this.args || {},
    };
  }
  getExeScriptRequest(): ExeScriptRequest {
    return { text: JSON.stringify([this.toJson()]) };
  }
}

export class Deploy extends Command {
  constructor(args?: object) {
    super("deploy", args);
  }
}
export class Start extends Command {
  constructor(args?: object) {
    super("start", args);
  }
}
export class Run extends Command {
  constructor(cmd: string, args?: string[], env?: object) {
    super("run", {
      entry_point: cmd,
      args,
      env,
      capture: {
        stdout: { atEnd: { format: "str" } },
        stderr: { atEnd: { format: "str" } },
      },
    });
  }
}
export class Terminate extends Command {
  constructor(args?: object) {
    super("terminate", args);
  }
}
