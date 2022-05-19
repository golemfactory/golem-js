import * as stream from "stream";
import { ExeScriptRequest } from "ya-ts-client/dist/ya-activity/src/models";

export class Script {
  constructor(private commands: Command[]) {}

  getExeScriptRequest(): ExeScriptRequest {
    return { text: "todo" };
  }
}

export class Command {
  constructor(private cmd, private args?, private env?) {}
}

export class Results extends stream.Readable {}
