import { ChildProcess, spawn } from "child_process";

type EnvironmentSettings = { apiKey: string; basePath: string; subnetTag: string; gsbUrl: string; path: string };

export class Goth {
  private gothProcess?: ChildProcess;

  constructor(private readonly gothConfig) {}

  async start(): Promise<EnvironmentSettings> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      console.log("\x1b[33mStarting goth process...");
      console.log("\x1b[33mRun command:\x1b[0m \x1b[36m", `python -m goth start ${this.gothConfig}`);
      this.gothProcess = spawn("python", ["-m", "goth", "start", this.gothConfig], {
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      });
      this.gothProcess.on("spawn", () => console.log("Goth spawned successfully"));
      this.gothProcess?.stdout?.setEncoding("utf-8");
      this.gothProcess?.stderr?.setEncoding("utf-8");

      this.gothProcess?.stdout?.on("data", (data) => {
        const regexp =
          /YAGNA_APPKEY=(\w+) YAGNA_API_URL=(http:\/\/127\.0{0,3}\.0{0,3}.0{0,2}1:\d+) GSB_URL=(tcp:\/\/\d+\.\d+\.\d+\.\d+:\d+) PATH=(.*) YAGNA_SUBNET=(\w+)/g;
        const results = Array.from(data?.toString()?.matchAll(regexp) || [])?.pop();
        const apiKey = results?.[1];
        const basePath = results?.[2];
        const gsbUrl = results?.[3];
        const path = results?.[4]?.split(":")?.shift();
        const subnetTag = results?.[5];
        if (apiKey) {
          process.env["YAGNA_APPKEY"] = apiKey;
          process.env["YAGNA_API_URL"] = basePath;
          process.env["GSB_URL"] = gsbUrl;
          process.env["PATH"] = `${path}:${process.env["PATH"]}`;
          process.env["YAGNA_SUBNET"] = subnetTag;
          // Note: rinkeby is a test network which is dead, but our goth runners exist on a custom deployment of this network
          // process.env["PAYMENT_NETWORK"] = "rinkeby";

          const settings = { apiKey, basePath, subnetTag, gsbUrl, path };

          console.log(
            `\x1b[33mGoth has been successfully started in ${((Date.now() - startTime) / 1000).toFixed(
              0,
            )}s. Resulting settings:`,
            settings,
          );

          resolve(settings);
        }
      });
      this.gothProcess?.stderr?.on("data", (data) => {
        if (data.toString().match(/error/)) reject(data);
        const regexp = /\[requestor] Gftp volume ([a-zA-Z0-9/_]*)/g;
        const results = Array.from(data?.toString()?.matchAll(regexp) || [])?.pop();
        const gftpVolume = results?.[1];
        if (gftpVolume) process.env["GOTH_GFTP_VOLUME"] = gftpVolume + "/out/";
        console.log("\x1b[33m[goth]\x1b[0m " + data.replace(/[\n\t\r]/g, ""));
      });
      this.gothProcess.on("error", (error) => reject("Failed to spawn Goth" + error.toString()));
      this.gothProcess.on("close", (code) => console.info(`Goth process exit with code ${code}`));
      this.gothProcess.on("exit", (code) => console.info(`Goth process exit with code ${code}`));
    });
  }

  async end() {
    this.gothProcess?.kill("SIGINT");
    return new Promise<void>((resolve) => {
      this.gothProcess?.on("close", () => {
        this.gothProcess?.stdout?.removeAllListeners();
        this.gothProcess?.stderr?.removeAllListeners();
        this.gothProcess?.removeAllListeners();
        console.log(`\x1b[33mGoth has been terminated`);
        resolve();
      });
    });
  }
}
