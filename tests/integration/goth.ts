import { spawn } from "child_process";
import fs from "fs";
import {Readable, Writable} from "stream";

export class Goth {
  private controller: AbortController;

  constructor(private readonly gothConfig) {
    this.controller = new AbortController();
  }
  async start(): Promise<{ apiKey: string; basePath: string; subnetTag: string }> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      console.log("Starting goth process...");
      console.log("Run command: ", `python -m goth start ${this.gothConfig}`);
      const gothProcess = spawn("python", ["-m", "goth", "start", this.gothConfig], { signal: this.controller.signal, env: { ...process.env, PYTHONUNBUFFERED: "1" } });
      gothProcess.stdout.setEncoding('utf-8');
      gothProcess.stderr.setEncoding('utf-8');
      gothProcess.stdout.on("data", (data) => {
        const regexp =
            /YAGNA_APPKEY=(\w+) YAGNA_API_URL=(http:\/\/127\.0{0,3}\.0{0,3}.0{0,2}1:\d+).*YAGNA_SUBNET=(\w+)/g;
        const results = Array.from(data?.toString()?.matchAll(regexp) || [])?.pop();
        const apiKey = results?.[1];
        const basePath = results?.[2];
        const subnetTag = results?.[3];
        if (apiKey) {
          console.log(`Goth has been successfully started in time ${(Date.now() - startTime)/ 1000} secs.`);
          resolve({ apiKey, basePath, subnetTag });
        }
      });
      gothProcess.stderr.on("data", (data) => {
        if (data.toString().match(/error/)) reject(data);
        console.log("[goth] " + data.replace(/[\n\t\r]/g,""));
      });
      gothProcess.on("error", (error) => reject(error.toString()));
      gothProcess.on("close", (code) => reject(`Goth process exit with code ${code}`));
      gothProcess.on("exit", (code) => reject(`Goth process exit with code ${code}`));
    });
  }
  async end() {
    this.controller.abort();
    console.log(`Goth has been terminated`);
  }
}
