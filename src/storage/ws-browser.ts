import { StorageProvider, StorageProviderDataCallback } from "./provider";
import { v4 } from "uuid";
import { encode, toObject } from "flatbuffers/js/flexbuffers";
import * as jsSha3 from "js-sha3";
import { Logger, nullLogger, YagnaApi } from "../utils";

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
export class WebSocketBrowserStorageProvider implements StorageProvider {
  /**
   * Map of open services (IDs) indexed by GFTP url.
   */
  private services = new Map<string, string>();
  private logger: Logger;

  constructor(
    private readonly yagnaApi: YagnaApi,
    private readonly options: WebSocketStorageProviderOptions,
  ) {
    this.logger = options.logger ?? nullLogger();
  }

  close(): Promise<void> {
    return this.release(Array.from(this.services.keys()));
  }

  init(): Promise<void> {
    return Promise.resolve(undefined);
  }

  async publishData(data: Uint8Array): Promise<string> {
    const fileInfo = await this.createFileInfo();

    const ws = await this.createSocket(fileInfo, ["GetMetadata", "GetChunk"]);
    ws.addEventListener("message", (event) => {
      const req = toObject(event.data) as GsbRequestPublishUnion;
      if (req.component === "GetMetadata") {
        this.respond(ws, req.id, { fileSize: data.byteLength });
      } else if (req.component === "GetChunk") {
        this.respond(ws, req.id, {
          content: data.slice(req.payload.offset, req.payload.offset + req.payload.size),
          offset: req.payload.offset,
        });
      } else {
        this.logger.warn(
          `[WebSocketBrowserStorageProvider] Unsupported message in publishData(): ${
            (req as GsbRequest<void>).component
          }`,
        );
      }
    });

    return fileInfo.url;
  }

  async publishFile(): Promise<string> {
    throw new Error("Not implemented");
  }

  async receiveData(callback: StorageProviderDataCallback): Promise<string> {
    const data: UploadChunkChunk[] = [];
    const fileInfo = await this.createFileInfo();

    const ws = await this.createSocket(fileInfo, ["UploadChunk", "UploadFinished"]);
    ws.addEventListener("message", (event) => {
      const req = toObject(event.data) as GsbRequestReceiveUnion;
      if (req.component === "UploadChunk") {
        data.push(req.payload.chunk);
        this.respond(ws, req.id, null);
      } else if (req.component === "UploadFinished") {
        this.respond(ws, req.id, null);
        const result = this.completeReceive(req.payload.hash, data);
        callback(result);
      } else {
        this.logger.warn(
          `[WebSocketBrowserStorageProvider] Unsupported message in receiveData(): ${
            (req as GsbRequest<void>).component
          }`,
        );
      }
    });

    return fileInfo.url;
  }

  async receiveFile(): Promise<string> {
    throw new Error("Not implemented");
  }

  async release(urls: string[]): Promise<void> {
    urls.forEach((url) => {
      const serviceId = this.services.get(url);
      if (serviceId) {
        this.deleteService(serviceId).catch((e) =>
          this.logger.warn(`[WebSocketBrowserStorageProvider] Failed to delete service ${serviceId}: ${e}`),
        );
      }
      this.services.delete(url);
    });
  }

  private async createFileInfo(): Promise<GftpFileInfo> {
    const id = v4();
    const { data } = await this.yagnaApi.identity.getIdentity();
    const me = data.identity;

    return {
      id,
      url: `gftp://${me}/${id}`,
    };
  }

  private async createSocket(fileInfo: GftpFileInfo, components: string[]): Promise<WebSocket> {
    const service = await this.createService(fileInfo, components);
    const ws = new WebSocket(service.url, ["gsb+flexbuffers"]);
    ws.addEventListener("error", () => {
      this.logger.error(`[WebSocketBrowserStorageProvider] Socket Error (${fileInfo.id})`);
    });
    ws.binaryType = "arraybuffer";
    return ws;
  }

  private async createService(fileInfo: GftpFileInfo, components: string[]): Promise<ServiceInfo> {
    const resp = await this.yagnaApi.gsb.createService(fileInfo, components);

    if (resp.status !== 201) {
      throw new Error(`Invalid response: ${resp.status}`);
    }

    const servicesId = resp.data.serviceId;
    const messages_link = `/gsb-api/v1/services/${servicesId}?authToken=${this.yagnaApi.yagnaOptions.apiKey}`;
    const url = new URL(messages_link, this.yagnaApi.yagnaOptions.basePath);
    url.protocol = "ws:";
    this.services.set(fileInfo.url, servicesId);

    return { url, serviceId: servicesId };
  }

  private async deleteService(id: string): Promise<void> {
    const resp = await this.yagnaApi.gsb.deleteService(id);
    if (resp.status !== 200) {
      throw new Error(`Invalid response: ${resp.status}`);
    }
  }

  private respond(ws: WebSocket, id: string, payload: unknown) {
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
      throw new Error(`File corrupted, expected hash ${hash}, got ${hashHex}`);
    } else {
      return buf;
    }
  }
}
