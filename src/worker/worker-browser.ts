import { GolemWorker } from "./worker";
import { WorkContext } from "../task";

export class GolemWorkerBrowser extends GolemWorker {
  private socket?: WebSocket;

  protected async startWebsocket(ctx: WorkContext) {
    const websocketUri = `${ctx.getWebsocketUri(6000)}?authToken=${this.options?.yagna?.apiKey}`;
    this.socket = new WebSocket(websocketUri);
    this.socket.onmessage = async (ev) => {
      const data = ev.data instanceof Blob ? await ev.data.text() : ev.data.toString();
      this.emit("message", { data });
    };
    this.socket.onerror = (er) => this.emit("error", er);
    this.socket.onclose = (ev) => this.logger.debug(`Websocket closed. Code: ${ev.code}`);
    return new Promise<void>((res, rej) => {
      const timeoutId = setTimeout(rej, this.options.websocketConnectionTimeout);
      this.socket!.onopen = () => {
        this.logger.debug(`Websocket opened on provider ${ctx.provider?.name}`);
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
    const workerUrl =
      window.location.origin +
      window.location.pathname.slice(0, window.location.pathname.lastIndexOf("/")) +
      "/" +
      this.scriptURL;
    const response = await fetch(workerUrl);
    const data = new Uint8Array(await response.arrayBuffer());
    await ctx.uploadData(data, "/golem/work/worker.mjs");
  }
}
