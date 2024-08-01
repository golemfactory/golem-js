import net from "net";
import { WebSocket } from "ws";
import { EventEmitter } from "eventemitter3";
import { defaultLogger, Logger } from "../shared/utils";
import { Buffer } from "buffer";

export interface TcpProxyEvents {
  /** Raised when the proxy encounters any sort of error */
  error: (err: unknown) => void;
}

/**
 * Configuration required by the TcpProxy to work properly
 */
export interface TcpProxyOptions {
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
 *
 * General solution description:
 *
 * - [x] Open a TCP server and listen to connections
 * - [x] When a new connection arrives, establish a WS connection with yagna
 * - [ ] Pass any incoming data from the client TCP socket to the WS, buffer it when the socket is not ready yet
 * - [ ] Pass any returning data from the WS to the client TCP socket, but don't do it if the client socket already disconnected
 * - [ ] When the WS will be closed, then close the client socket as well
 * - [ ] When the client TCP socket will be closed, close the WS as well
 * - [ ] Handle teardown of the TCP-WS bridge by clearing communication buffers to avoid memory leaks
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

    this.server = net.createServer((client: net.Socket) => {
      this.logger.debug("Client connected to TCP Server");

      const state = {
        /** Tells if the client socket is in a usable state */
        sReady: true,
        /** Buffer for chunks of data that arrived from yagna's WS and should be delivered to the client socket when it's ready */
        sBuffer: [] as Buffer[],
        /** Tells if the WS with yagna is ready for communication */
        wsReady: false,
        /** Buffer for chunks of data that arrived from the client socket and should be sent to yagna's WS when it's ready */
        wsBuffer: [] as Buffer[],
      };

      const clearSocketBuffer = () => (state.sBuffer = []);
      const clearWebSocketBuffer = () => (state.wsBuffer = []);

      // UTILITY METHODS
      const flushSocketBuffer = () => {
        this.logger.debug("Flushing Socket buffer");
        if (state.sBuffer.length > 0) {
          client.write(Buffer.concat(state.sBuffer));
        }
        clearSocketBuffer();
      };

      const flushWebSocketBuffer = () => {
        this.logger.debug("Flushing WebSocket buffer");
        if (state.wsBuffer.length > 0) {
          ws.send(Buffer.concat(state.wsBuffer), {
            binary: true,
            mask: true,
          });
        }
        clearWebSocketBuffer();
      };

      const teardownBridge = () => {
        ws.close();
        client.end();
        clearWebSocketBuffer();
        clearSocketBuffer();
      };

      const ws = new WebSocket(this.wsUrl, { headers: { authorization: `Bearer ${this.appKey}` } });

      // OPEN HANDLERS
      ws.on("open", () => {
        this.logger.debug("Yagna WS opened");
        state.wsReady = true;
        // Push any pending data to the web-socket
        flushWebSocketBuffer();
      });

      // NOTE: That's not really required in our use-case, added for completeness of the flow
      client.on("connect", () => {
        this.logger.debug("Client socket connected");
        state.sReady = true;
        // Push any pending data to the client socket
        flushSocketBuffer();
      });

      // ERROR HANDLERS
      ws.on("error", (error) => {
        this.notifyOfError("Yagna WS encountered an error", error);
        teardownBridge();
      });

      client.on("error", (error) => {
        this.notifyOfError("Server Socket encountered an error", error);
        teardownBridge();
      });

      // TERMINATION HANDLERS

      // When the WS socket will be closed
      ws.on("close", () => {
        clearInterval(heartBeatInt);
        this.logger.debug("Yagna WS closed");
        client.end();
        clearWebSocketBuffer();
        clearSocketBuffer();
      });

      ws.on("end", () => {
        this.logger.debug("Yagna WS end");
        client.end();
        clearWebSocketBuffer();
        clearSocketBuffer();
      });

      // When the client will disconnect
      client.on("close", (error) => {
        if (error) {
          this.logger.error("Server Socket encountered closed with an error error");
        } else {
          this.logger.debug("Server Socket has been closed (client disconnected)");
        }
        ws.close();
        clearWebSocketBuffer();
        clearSocketBuffer();
      });

      // DATA TRANSFER
      // Send data to the WebSocket or buffer if it's not ready yet
      client.on("data", async (chunk) => {
        this.logger.debug("Server Socket received data", { length: chunk.length, wsReady: state.wsReady });
        if (!state.wsReady) {
          state.wsBuffer.push(chunk);
        } else {
          ws.send(chunk, { binary: true, mask: true });
        }
      });

      // Send data to the client or buffer if it's not ready yet
      ws.on("message", (message) => {
        const length = "length" in message ? message.length : null;
        this.logger.debug("Yagna WS received data", { length, socketReady: state.sReady });
        if (message instanceof Buffer) {
          if (!state.sReady) {
            state.wsBuffer.push(message);
          } else {
            client.write(message);
          }
        } else {
          // Defensive programming
          this.logger.error("Encountered unsupported type of message", typeof message);
        }
      });

      // WS health monitoring
      ws.on("ping", () => {
        this.logger.debug("Yagna WS received ping event");
      });

      // Configure pings to check the health of the WS to Yagna
      let isAlive = true;

      const heartBeat = () => {
        if (state.wsReady) {
          this.logger.debug("Yagna WS checking if the client is alive");
          if (!isAlive) {
            this.notifyOfError("Yagna WS doesn't seem to be healthy, going to terminate");
            // Previous check failed, time to terminate
            return ws.terminate();
          }

          isAlive = false;
          ws.ping();
        } else {
          this.logger.debug("Yagna WS is not ready yet, skipping heart beat");
        }
      };

      const heartBeatInt = setInterval(heartBeat, this.heartBeatSec * 1000);

      ws.on("pong", () => {
        this.logger.debug("Yagna WS received pong event");
        isAlive = true;
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
        this.notifyOfError("TcpProxy failed to start listening", { port, err });
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
    this.logger.debug("TCP Server close initiated by the user");
    return new Promise<void>((resolve, reject) => {
      if (this.server.listening) {
        this.server?.close((err) => {
          if (err) {
            this.notifyOfError("TCP Server closed with an error", err);
            reject(err);
          } else {
            this.logger.info("TCP server closed - was listening");
            resolve();
          }
        });
      } else {
        this.logger.info("TCP Server closed - was not listening");
        resolve();
      }
    });
  }

  private notifyOfError(message: string, err?: unknown) {
    this.logger.error(message, err);
    this.events.emit("error", `${message}: ${err}`);
  }

  private attachDebugLogsToServer() {
    this.server.on("listening", () => this.logger.debug("TCP Server started to listen"));
    this.server.on("close", () => this.logger.debug("TCP Server closed"));
    this.server.on("connection", () => this.logger.debug("TCP Server received new connection"));
    this.server.on("drop", (data) =>
      this.logger.debug("TCP Server dropped a connection because of reaching `maxConnections`", { data }),
    );
    this.server.on("error", (err) => this.logger.error("Server event 'error'", err));
  }
}
