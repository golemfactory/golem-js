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
      console.log("Run command: ", `python -m goth start ${this.gothConfig}`);
      const gothProcess = spawn("python", ["-m", "goth", "start", this.gothConfig], { signal: this.controller.signal });
      gothProcess.stdout.on("data", (data) => {
        console.log("[goth]" + data.toString());
        const regexp =
          /YAGNA_APPKEY=(\w+) YAGNA_API_URL=(http:\/\/127\.0{0,3}\.0{0,3}.0{0,2}1:\d+).*YAGNA_SUBNET=(\w+)/g;
        const results = Array.from(data?.toString()?.matchAll(regexp) || [])?.pop();
        const apiKey = results?.[1];
        const basePath = results?.[2];
        const subnetTag = results?.[3];
        if (!apiKey) resolve({ apiKey, basePath, subnetTag });
      });
      gothProcess.stderr.on("data", (error) => reject(error));
      gothProcess.on("close", (code) => console.log(`Goth process exit with code ${code}`));
    });
  }
  async end() {
    this.controller.abort();
  }
}
