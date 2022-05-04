import stream from "stream";

interface Script {
  commands: Command[];
}

interface Command {
  todo: true;
}

interface Results extends stream.Readable {
  todo: true;
}

export class Activity {
  public readonly id;

  constructor(id) {
    this.id = id;
  }

  async execute(script: Script): Promise<Results> {
    // todo
    return {} as Results;
  }

  async stop(): Promise<boolean> {
    // todo
    return false;
  }
}
