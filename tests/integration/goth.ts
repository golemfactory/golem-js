import { ChildProcess, spawn } from "child_process";
import fs from "fs";
import { Readable, Writable } from "stream";

export class Goth {
  private gothProcess?: ChildProcess;

  constructor(private readonly gothConfig) {}
  async start(): Promise<{ apiKey: string; basePath: string; subnetTag: string; gsbUrl: string; path: string }> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      console.log("\x1b[33mStarting goth process...");
      console.log("\x1b[33mRun command:\x1b[0m \x1b[36m", `python -m goth start ${this.gothConfig}`);
      this.gothProcess = spawn("python", ["-m", "goth", "start", this.gothConfig], {
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      });
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
          console.log(
            `\x1b[33mGoth has been successfully started in ${((Date.now() - startTime) / 1000).toFixed(0)}s.\n`
          );
          resolve({ apiKey, basePath, subnetTag, gsbUrl, path });
        }
      });
      this.gothProcess?.stderr?.on("data", (data) => {
        if (data.toString().match(/error/)) reject(data);
        const regexp =/\[requestor] Gftp volume ([a-zA-Z0-9/_]*)/g
        const results = Array.from(data?.toString()?.matchAll(regexp) || [])?.pop();
        const gftpVolume = results?.[1];
        if (gftpVolume) process.env["GOTH_GFTP_VOLUME"] = gftpVolume + '/out/';
        console.log("\x1b[33m[goth]\x1b[0m " + data.replace(/[\n\t\r]/g, ""));
      });
      this.gothProcess.on("error", (error) => reject(error.toString()));
      this.gothProcess.on("close", (code) => reject(`Goth process exit with code ${code}`));
      this.gothProcess.on("exit", (code) => reject(`Goth process exit with code ${code}`));
    });
  }
  async end() {
    this.gothProcess?.kill("SIGINT");
    return new Promise((resolve) => {
      this.gothProcess?.on("close", () => {
        this.gothProcess?.stdout?.removeAllListeners();
        this.gothProcess?.stderr?.removeAllListeners();
        this.gothProcess?.removeAllListeners();
        resolve(console.log(`\x1b[33mGoth has been terminated`))
      });
    });
  }
}
