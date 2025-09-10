import { StorageProvider, StorageProviderDataCallback } from "./provider";
import { v4 } from "uuid";
// .js added for ESM compatibility
import { encode, toObject } from "flatbuffers/js/flexbuffers.js";
import * as jsSha3 from "js-sha3";
import { defaultLogger, isBrowser, Logger, YagnaApi } from "../utils";
import { GolemInternalError, GolemUserError } from "../error/golem-error";
import NodeWebSocket from "ws";

type WebSocketLike = NodeWebSocket | WebSocket;

// FIXME: cannot import fs/promises because the rollup polyfill doesn't work with it
import * as fs from "fs";
const fsPromises = fs.promises;

export interface WebSocketStorageProviderOptions {
  logger?: Logger;
}

interface GsbRequest<T> {
  id: string;
  component: string;
  payload: T;
}

interface GetMetadataRequest extends GsbRequest<void> {
  component: "GetMetadata";
}

interface GetChunkRequest extends GsbRequest<{ offset: number; size: number }> {
  component: "GetChunk";
}

type UploadChunkChunk = { offset: number; content: Uint8Array };
type UploadChunkPayload = {
  chunk: UploadChunkChunk;
};

interface UploadChunkRequest extends GsbRequest<UploadChunkPayload> {
  component: "UploadChunk";
}

interface UploadFinishedRequest extends GsbRequest<{ hash: string }> {
  component: "UploadFinished";
}

type GsbRequestPublishUnion = GetMetadataRequest | GetChunkRequest;
type GsbRequestReceiveUnion = UploadFinishedRequest | UploadChunkRequest;

type ServiceInfo = {
  url: URL;
  serviceId: string;
};

type GftpFileInfo = {
  id: string;
  url: string;
};

/**
 * Storage provider that uses GFTP over WebSockets.
 */
export class WebSocketStorageProvider implements StorageProvider {
  /**
   * Map of open services (IDs) indexed by GFTP url.
   */
  private services = new Map<string, string>();
  private logger: Logger;
  private ready = false;
  private openHandles = new Set<fs.promises.FileHandle>();

  constructor(
    private readonly yagnaApi: YagnaApi,
    options?: WebSocketStorageProviderOptions,
  ) {
    this.logger = options?.logger?.child("storage") || defaultLogger("storage");
  }

  async close(): Promise<void> {
    this.ready = false;
    await Promise.allSettled(Array.from(this.openHandles).map((handle) => handle.close()));
    return this.release(Array.from(this.services.keys()));
  }

  init(): Promise<void> {
    this.ready = true;
    return Promise.resolve(undefined);
  }

  async publishData(data: Uint8Array): Promise<string> {
    const fileInfo = await this.createFileInfo();

    const ws = await this.createSocket(fileInfo, ["GetMetadata", "GetChunk"]);
    ws.addEventListener("message", (event) => {
      if (!(event.data instanceof ArrayBuffer)) {
        this.logger.error("Received non-ArrayBuffer data from the socket", { data: event.data });
        return;
      }
      const req = toObject(event.data) as GsbRequestPublishUnion;

      this.logger.debug("Received GFTP request for publishData", req);

      if (req.component === "GetMetadata") {
        this.respond(ws, req.id, { fileSize: data.byteLength });
      } else if (req.component === "GetChunk") {
        this.respond(ws, req.id, {
          content: data.slice(req.payload.offset, req.payload.offset + req.payload.size),
          offset: req.payload.offset,
        });
      } else {
        this.logger.error(`Unsupported message in publishData(): ${(req as GsbRequest<void>).component}`);
      }
    });

    return fileInfo.url;
  }

  async publishFile(src: string): Promise<string> {
    if (isBrowser) {
      throw new GolemUserError("Cannot publish files in browser context, did you mean to use `publishData()`?");
    }

    this.logger.info("Preparing file upload", { sourcePath: src });

    const fileInfo = await this.createFileInfo();
    const ws = await this.createSocket(fileInfo, ["GetMetadata", "GetChunk"]);
    const fileStats = await fsPromises.stat(src);
    const fileSize = fileStats.size;

    const fileHandle = await fsPromises.open(src, "r");
    this.openHandles.add(fileHandle);

    ws.addEventListener("message", async (event) => {
      if (!(event.data instanceof ArrayBuffer)) {
        this.logger.error("Received non-ArrayBuffer data from the socket", { data: event.data });
        return;
      }

      const req = toObject(event.data) as GsbRequestPublishUnion;

      this.logger.debug("Received GFTP request for publishFile", req);

      if (req.component === "GetMetadata") {
        this.respond(ws, req.id, { fileSize });
      } else if (req.component === "GetChunk") {
        const { offset, size } = req.payload;

        const chunkSize = Math.min(size, fileSize - offset);
        const chunk = Buffer.alloc(chunkSize);

        try {
          await fileHandle.read(chunk, 0, chunkSize, offset);
          this.respond(ws, req.id, {
            content: chunk,
            offset,
          });
        } catch (error) {
          this.logger.error("Something went wrong while sending the file chunk", { error });
        }
      } else {
        this.logger.error(`Unsupported message in publishFile(): ${(req as GsbRequest<void>).component}`);
      }
    });

    return fileInfo.url;
  }

  async receiveData(callback: StorageProviderDataCallback): Promise<string> {
    const data: UploadChunkChunk[] = [];
    const fileInfo = await this.createFileInfo();

    const ws = await this.createSocket(fileInfo, ["UploadChunk", "UploadFinished"]);
    ws.addEventListener("message", (event) => {
      if (!(event.data instanceof ArrayBuffer)) {
        this.logger.error("Received non-ArrayBuffer data from the socket", { data: event.data });
        return;
      }

      const req = toObject(event.data) as GsbRequestReceiveUnion;

      this.logger.debug("Received GFTP request for receiveData", req);

      if (req.component === "UploadChunk") {
        data.push(req.payload.chunk);
        this.respond(ws, req.id, null);
      } else if (req.component === "UploadFinished") {
        this.respond(ws, req.id, null);
        const result = this.completeReceive(req.payload.hash, data);
        callback(result);
      } else {
        this.logger.error(`Unsupported message in receiveData(): ${(req as GsbRequest<void>).component}`);
      }
    });

    return fileInfo.url;
  }

  async receiveFile(path: string): Promise<string> {
    if (isBrowser) {
      throw new GolemUserError("Cannot receive files in browser context, did you mean to use `receiveData()`?");
    }

    this.logger.info("Preparing file download", { destination: path });

    const fileInfo = await this.createFileInfo();
    const fileHandle = await fsPromises.open(path, "w");
    this.openHandles.add(fileHandle);
    const ws = await this.createSocket(fileInfo, ["UploadChunk", "UploadFinished"]);

    ws.addEventListener("message", async (event) => {
      if (!(event.data instanceof ArrayBuffer)) {
        this.logger.error("Received non-ArrayBuffer data from the socket", { data: event.data });
        return;
      }
      const req = toObject(event.data) as GsbRequestReceiveUnion;

      this.logger.debug("Received GFTP request for receiveFile", req);

      if (req.component === "UploadChunk") {
        await fileHandle.write(req.payload.chunk.content);
        this.respond(ws, req.id, null);
      } else if (req.component === "UploadFinished") {
        this.respond(ws, req.id, null);
        await fileHandle.close();
        this.openHandles.delete(fileHandle);
      } else {
        this.logger.error(`Unsupported message in receiveFile(): ${(req as GsbRequest<void>).component}`);
      }
    });

    return fileInfo.url;
  }

  async release(urls: string[]): Promise<void> {
    urls.forEach((url) => {
      const serviceId = this.services.get(url);
      if (serviceId) {
        this.deleteService(serviceId).catch((error) =>
          this.logger.warn(`Failed to delete service`, { serviceId, error }),
        );
      }
      this.services.delete(url);
    });
  }

  isReady(): boolean {
    return this.ready;
  }

  private async createFileInfo(): Promise<GftpFileInfo> {
    const id = v4();
    const data = await this.yagnaApi.identity.getIdentity();
    const me = data.identity;

    return {
      id,
      url: `gftp://${me}/${id}`,
    };
  }

  private getWsConstructor() {
    if (isBrowser) {
      return WebSocket;
    }
    return NodeWebSocket;
  }

  private async createSocket(fileInfo: GftpFileInfo, components: string[]): Promise<WebSocketLike> {
    const service = await this.createService(fileInfo, components);
    const ws = new (this.getWsConstructor())(service.url, ["gsb+flexbuffers"]);
    ws.addEventListener("error", () => {
      this.logger.error(`Socket Error (${fileInfo.id})`);
    });
    ws.binaryType = "arraybuffer";
    return ws;
  }

  private async createService(fileInfo: GftpFileInfo, components: string[]): Promise<ServiceInfo> {
    const resp = (await this.yagnaApi.gsb.bindServices({
      listen: {
        on: `/public/gftp/${fileInfo.id}`,
        components,
      },
      // FIXME: not present in ya-client for some reason
    })) as { servicesId: string };
    const servicesId = resp.servicesId;
    const messageEndpoint = `/gsb-api/v1/services/${servicesId}?authToken=${this.yagnaApi.yagnaOptions.apiKey}`;
    const url = new URL(messageEndpoint, this.yagnaApi.yagnaOptions.basePath);
    url.protocol = "ws:";
    this.services.set(fileInfo.url, servicesId);

    return { url, serviceId: servicesId };
  }

  private async deleteService(id: string): Promise<void> {
    await this.yagnaApi.gsb.unbindServices(id);
  }

  private respond(ws: WebSocketLike, id: string, payload: unknown) {
    ws.send(
      encode({
        id,
        payload,
      }),
    );
  }

  private completeReceive(hash: string, data: UploadChunkChunk[]): Uint8Array {
    data.sort((a, b) => a.offset - b.offset);
    const size = data.reduce((acc, cur) => acc + cur.content.byteLength, 0);
    const buf = new Uint8Array(size);
    data.forEach((chunk) => {
      buf.set(chunk.content, chunk.offset);
    });

    // FIXME: Use digest.update and async, as it can only handle 14MB/s on my machine, which is way to slow to do synchronously.
    const hashHex = jsSha3.sha3_256(buf);

    if (hash !== hashHex) {
      throw new GolemInternalError(`File corrupted, expected hash ${hash}, got ${hashHex}`);
    } else {
      return buf;
    }
  }
}
