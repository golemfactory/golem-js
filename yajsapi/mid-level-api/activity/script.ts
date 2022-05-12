import * as stream from "stream";

export class Script {
  constructor(private commands: Command[]) {}
}

export class Command {
  constructor(private cmd, private args?, private env?) {}
}

export class Results extends stream.Readable {}
