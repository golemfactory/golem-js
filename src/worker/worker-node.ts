import { GolemWorker } from "./worker";
import { WorkContext } from "../task";
import WebSocket from "ws";
import { clearInterval, clearTimeout } from "timers";

export class GolemWorkerNode extends GolemWorker {
  private socket?: WebSocket;
  protected async startWebsocket(ctx: WorkContext) {
    const websocketUri = ctx.getWebsocketUri(6000);
    const apiKey = this.options?.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY;
    this.socket = new WebSocket(websocketUri, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    let intervalId;
    this.socket.onmessage = (ev) => this.emit("message", ev.data.toString().trim());
    this.socket.onerror = (er) => this.emit("error", er.error);
    this.socket.onclose = (ev) => {
      clearInterval(intervalId);
      this.logger.debug(`Websocket closed. Code: ${ev.code}`);
    };
    return new Promise<void>((res, rej) => {
      const timeoutId = setTimeout(rej, this.options.websocketConnectionTimeout);
      this.socket!.onopen = () => {
        intervalId = setInterval(() => this.socket!.ping(), 50e3);
        this.logger.debug(`Websocket opened on provider ${ctx.provider?.name}`);
        this.emit("online");
        clearTimeout(timeoutId);
        res();
      };
    });
  }

  public postMessage(message: unknown) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      this.logger.log("Worker runtime is not ready. Current state: " + this.socket?.readyState);
      return;
    }
    this.socket.send(this.serializer(message));
  }

  protected async uploadWorkerFile(ctx: WorkContext) {
    await ctx.uploadFile(`${this.scriptURL}`, "/golem/work/worker.mjs");
  }
}
