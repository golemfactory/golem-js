import { ChildProcess, spawn } from "child_process";

export class Goth {
  private process?: ChildProcess;
  private controller: AbortController;

  constructor(private readonly gothConfig) {
    this.controller = new AbortController();
  }
  async start(): Promise<{ apiKey: string; basePath: string; subnetTag: string }> {
    return new Promise((resolve, reject) => {
      console.log("Starting goth process...");
      const gothProcess = spawn("python", ["-m", "goth", "start", this.gothConfig], { signal: this.controller.signal });
      gothProcess.stdout.on("data", (data) => {
        console.log(data.toString());
        const [apiKey, basePath, subnetTag] = data.toString().match(/todo_regex/);
        if (!apiKey) resolve({ apiKey, basePath, subnetTag });
      });
      gothProcess.stderr.on("data", (error) => reject(error.toString()));
      gothProcess.on("close", (code) => console.log(`Goth process exit with code ${code}`));
    });
  }
  async end() {
    this.controller.abort();
  }
}
