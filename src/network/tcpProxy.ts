import net from "net";
import { WebSocket } from "ws";
import { EventEmitter } from "eventemitter3";
import { defaultLogger, Logger } from "../utils";

interface TcpProxyEvents {
  /** Raised when the proxy encounters any sort of error */
  error: (err: unknown) => void;
}

/**
 * Configuration required by the TcpProxy to work properly
 */
interface TcpProxyOptions {
  /**
   * The logger instance to use for logging
   */
  logger: Logger;

  /**
   * Number of seconds to wait between heart-beating the WS connection ot yagna
   *
   * @default 10
   */
  heartBeatSec: number;
}

/**
 * Allows proxying of TCP traffic to a service running in an activity on a provider via the requestor
 *
 * **IMPORTANT**
 *
 * This feature is supported only in the Node.js environment. In has no effect in browsers.
 */
export class TcpProxy {
  private server: net.Server;

  public readonly events = new EventEmitter<TcpProxyEvents>();

  private readonly logger: Logger;

  private readonly heartBeatSec: number;

  constructor(
    /**
     * The URL to the WebSocket implementing the communication transport layer
     */
    private readonly wsUrl: string,
    /**
     * The yagna app-key used to authenticate the WebSocket connection
     */
    private readonly appKey: string,
    /**
     * Additional options of the proxy
     */
    options: Partial<TcpProxyOptions>,
  ) {
    this.heartBeatSec = options.heartBeatSec ?? 10;
    this.logger = options.logger ? options.logger.child("tcp-proxy") : defaultLogger("tcp-proxy");

    this.server = new net.Server({ keepAlive: true }, (socket: net.Socket) => {
      this.logger.debug("TcpProxy Server new incoming connection");

      const ws = new WebSocket(this.wsUrl, { headers: { authorization: `Bearer ${this.appKey}` } });

      ws.on("open", () => {
        this.logger.debug("TcpProxy Yagna WS opened");

        // Register the actual data transfer
        socket.on("data", async (chunk) => ws.send(chunk.toString()));
      });

      ws.on("message", (message) => socket.write(message.toString()));

      ws.on("end", () => {
        this.logger.debug("TcpProxy Yagna WS end");
        socket.end();
      });

      ws.on("error", (error) => {
        this.handleError("TcpProxy Yagna WS encountered an error", error);
      });

      ws.on("ping", () => {
        this.logger.debug("TcpProxy Yagna WS received ping event");
      });

      // Configure pings to check the health of the WS to Yagna
      let isAlive = true;

      const heartBeat = () => {
        this.logger.debug("TcpProxy Yagna WS checking if the socket is alive");
        if (!isAlive) {
          this.handleError("TcpProxy Yagna WS doesn't seem to be healthy, going to terminate");
          // Previous check failed, time to terminate
          return ws.terminate();
        }

        isAlive = false;
        ws.ping();
      };

      const heartBeatInt = setInterval(heartBeat, this.heartBeatSec * 1000);

      ws.on("pong", () => {
        this.logger.debug("TcpProxy Yagna WS received pong event");
        isAlive = true;
      });

      ws.on("close", () => {
        clearInterval(heartBeatInt);
        this.logger.debug("TcpProxy Yagna WS was closed");
      });

      socket.on("error", (error) => {
        this.handleError("TcpProxy Server Socket encountered an error", error);
      });

      socket.on("close", () => {
        this.logger.debug("TcpProxy Server Socket has been closed");
        ws.close();
      });
    });

    this.attachDebugLogsToServer();
  }

  /**
   * Start the proxy in listening mode
   *
   * @param port The port number to use on the requestor
   * @param abort The abort controller to use in order to control cancelling requests
   */
  public async listen(port: number, abort?: AbortController) {
    this.logger.debug("TcpProxy listen initiated");
    // Retries if possible
    this.server.listen({
      port,
      signal: abort ? abort.signal : undefined,
    });

    return new Promise<void>((resolve, reject) => {
      const handleError = (err: unknown) => {
        this.handleError("TcpProxy failed to start listening", { port, err });
        this.server.removeListener("listening", handleListen);
        reject(err);
      };

      const handleListen = () => {
        this.logger.info("TcpProxy is listening", { port });
        this.server.removeListener("error", handleError);
        resolve();
      };

      this.server.once("listening", handleListen);
      this.server.once("error", handleError);
    });
  }

  /**
   * Gracefully close the proxy
   */
  public close() {
    this.logger.debug("TcpProxy close initiated");
    return new Promise<void>((resolve, reject) => {
      if (this.server.listening) {
        this.server?.close((err) => {
          if (err) {
            this.handleError("TcpProxy failed to close properly", err);
            reject(err);
          } else {
            this.logger.info("TcpProxy closed - was listening");
            resolve();
          }
        });
      } else {
        this.logger.info("TcpProxy closed - was not listening");
        resolve();
      }
    });
  }

  private handleError(message: string, err?: unknown) {
    this.logger.error(message, err);
    this.events.emit("error", `${message}: ${err}`);
  }

  private attachDebugLogsToServer() {
    this.server.on("listening", () => this.logger.debug("TcpProxy Server event 'listening'"));
    this.server.on("close", () => this.logger.debug("TcpProxy Server event 'close'"));
    this.server.on("connection", () => this.logger.debug("TcpProxy Server event 'connection'"));
    this.server.on("drop", (data) => this.logger.debug("TcpProxy Server event 'drop'", { data }));
    this.server.on("error", (err) => this.logger.debug("TcpProxy Server event 'error'", err));
  }
}
