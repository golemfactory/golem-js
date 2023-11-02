import { GolemWorker } from "./worker";
import { WorkContext } from "../task";

export class GolemWorkerBrowser extends GolemWorker {
  private socket?: WebSocket;

  protected async startWebsocket(ctx: WorkContext) {
    const websocketUri = `${ctx.getWebsocketUri(6000)}?authToken=${this.options?.yagnaOptions?.apiKey}`;
    this.socket = new WebSocket(websocketUri);
    this.socket.onmessage = (ev) => this.emit("message", ev.data.toString().trim());
    this.socket.onerror = (er) => this.emit("error", er);
    this.socket.onclose = (ev) => this.logger.debug(`Websocket closed. Code: ${ev.code}`);
    return new Promise<void>((res, rej) => {
      const timeoutId = setTimeout(rej, this.options.websocketConnectionTimeout);
      this.socket!.onopen = () => {
        this.logger.debug(`Websocket opened on provider ${ctx.provider?.name}`);
        this.emit("online");
        clearTimeout(timeoutId);
        res();
      };
    });
  }

  public postMessage(message: unknown): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      this.logger.log("Worker runtime is not ready. Current state: " + this.socket?.readyState);
      return;
    }
    this.socket.send(this.serializer(message));
  }

  protected async uploadWorkerFile(ctx: WorkContext) {
    const response = await fetch(this.scriptURL);
    console.log(response.json());
    const data = new Uint8Array(await response.arrayBuffer());
    await ctx.uploadData(data, "/golem/work/worker.mjs");
  }
}
