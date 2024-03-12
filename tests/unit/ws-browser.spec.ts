import { GolemInternalError, nullLogger, WebSocketBrowserStorageProvider, YagnaApi } from "../../src";
// .js added for ESM compatibility
import { encode, toObject } from "flatbuffers/js/flexbuffers.js";
import * as jsSha3 from "js-sha3";
import { TEST_IDENTITY } from "../fixtures";
import { GsbApi } from "ya-ts-client";
import { LoggerMock } from "../mock/utils/logger";
import { anything, instance, mock, reset, resetCalls, verify, when } from "@johanblumenberg/ts-mockito";
import { IdentityRequestorApi } from "../../src/utils/yagna/identity";

jest.mock("uuid", () => ({ v4: () => "uuid" }));

type UploadChunkChunk = { offset: number; content: Uint8Array };

const mockYagna = mock(YagnaApi);
const mockIdentity = mock(IdentityRequestorApi);
const mockGsb = mock(GsbApi.RequestorService);

const yagnaApi = instance(mockYagna);

describe("WebSocketBrowserStorageProvider", () => {
  let logger: LoggerMock;

  const createProvider = () =>
    new WebSocketBrowserStorageProvider(yagnaApi, {
      logger,
    });
  let provider: WebSocketBrowserStorageProvider;

  beforeEach(() => {
    logger = new LoggerMock();
    provider = createProvider();

    jest.clearAllMocks();

    reset(mockYagna);
    reset(mockIdentity);
    reset(mockGsb);

    when(mockYagna.yagnaOptions).thenReturn({
      apiKey: "example-api-key",
      basePath: "http://127.0.0.1:7465",
    });

    when(mockYagna.identity).thenReturn(instance(mockIdentity));

    when(mockIdentity.getIdentity()).thenResolve({
      identity: TEST_IDENTITY,
      name: "tester",
      role: "tester",
    });

    when(mockYagna.gsb).thenReturn(instance(mockGsb));
  });

  describe("constructor", () => {
    it("should create default logger", () => {
      const provider = new WebSocketBrowserStorageProvider(yagnaApi, {});
      expect(provider["logger"]).toBeDefined();
    });

    it("should use provided logger", () => {
      const logger = nullLogger();
      const provider = new WebSocketBrowserStorageProvider(yagnaApi, { logger });
      expect(provider["logger"]).toBe(logger);
    });
  });

  describe("close()", () => {
    it("should release all remaining URLs", async () => {
      provider["services"].set("url1", "id");
      provider["services"].set("url2", "id");

      const spy = jest.spyOn(provider, "release").mockImplementation((urls) => {
        expect(urls).toContain("url1");
        expect(urls).toContain("url2");
        expect(urls.length).toBe(2);
        return Promise.resolve();
      });

      await provider.close();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe("init()", () => {
    it("should work", async () => {
      const provider = createProvider();
      await expect(provider.init()).resolves.toBeUndefined();
    });
  });

  describe("publishData()", () => {
    let socket: EventTarget;
    let fileInfo: { id: string; url: string };

    beforeEach(async () => {
      socket = new EventTarget();
      fileInfo = {
        id: "10",
        url: "http://localhost:8080",
      };

      jest.spyOn(provider as any, "createFileInfo").mockImplementation(() => Promise.resolve(fileInfo));
      jest.spyOn(provider as any, "createSocket").mockImplementation(() => Promise.resolve(socket));
    });

    it("should create socket and return GFTP URL", async () => {
      const result = await provider["publishData"](new Uint8Array(0));
      expect(result).toBe(fileInfo.url);
      expect(provider["createSocket"]).toHaveBeenCalledWith(fileInfo, ["GetMetadata", "GetChunk"]);
    });

    describe("socket", () => {
      it("should register message handler", async () => {
        jest.spyOn(socket, "addEventListener").mockImplementation((type) => {
          expect(type).toEqual("message");
        });
        await provider["publishData"](new Uint8Array(0));
        expect(socket.addEventListener).toHaveBeenCalled();
      });

      it("should handle GetMetadata message", async () => {
        const buffer = new TextEncoder().encode("Hello World");
        const packet = {
          id: "foo",
          component: "GetMetadata",
        };
        const spy1 = jest.spyOn(provider as any, "respond").mockImplementation((ws, id, data: any) => {
          expect(ws).toBe(socket);
          expect(id).toBe(packet.id);
          expect(data.fileSize).toBe(buffer.length);
        });

        await provider["publishData"](buffer);
        socket.dispatchEvent(new MessageEvent("message", { data: encode(packet).buffer }));
        expect(spy1).toHaveBeenCalled();
      });

      it("should handle GetChunk message", async () => {
        const buffer = new TextEncoder().encode("Hello World");
        const packet = {
          id: "foo",
          component: "GetChunk",
          payload: {
            offset: 6,
            size: 5,
          },
        };
        const spy1 = jest.spyOn(provider as any, "respond").mockImplementation((ws, id, data: any) => {
          expect(ws).toBe(socket);
          expect(id).toBe(packet.id);
          expect(new TextDecoder().decode(data.content)).toBe("World");
        });

        await provider["publishData"](buffer);
        socket.dispatchEvent(new MessageEvent("message", { data: encode(packet).buffer }));
        expect(spy1).toHaveBeenCalled();
      });

      it("should log invalid requests", async () => {
        const data = {
          id: "foo",
          component: "Foo",
        };

        await provider["publishData"](new Uint8Array(0));
        const spy1 = jest.spyOn(provider as any, "respond").mockReturnThis();
        socket.dispatchEvent(new MessageEvent("message", { data: encode(data).buffer }));
        expect(spy1).not.toHaveBeenCalled();
        await logger.expectToInclude("[WebSocketBrowserStorageProvider] Unsupported message in publishData(): Foo");
      });
    });
  });

  describe("publishFile()", () => {
    it("should fail", async () => {
      await expect(() => provider.publishFile()).rejects.toMatchError(new GolemInternalError("Not implemented"));
    });
  });

  describe("receiveData()", () => {
    let socket: EventTarget;
    let fileInfo: { id: string; url: string };

    beforeEach(async () => {
      socket = new EventTarget();
      fileInfo = {
        id: "10",
        url: "http://localhost:8080",
      };

      jest.spyOn(provider as any, "createFileInfo").mockImplementation(() => Promise.resolve(fileInfo));
      jest.spyOn(provider as any, "createSocket").mockImplementation(() => Promise.resolve(socket));
    });

    it("should create socket and return GFTP URL", async () => {
      const result = await provider["receiveData"](() => {});
      expect(result).toBe(fileInfo.url);
      expect(provider["createSocket"]).toHaveBeenCalledWith(fileInfo, ["UploadChunk", "UploadFinished"]);
    });

    describe("socket", () => {
      it("should register message handler", async () => {
        jest.spyOn(socket, "addEventListener").mockImplementation((type) => {
          expect(type).toEqual("message");
        });
        await provider["receiveData"](() => {});
        expect(socket.addEventListener).toHaveBeenCalled();
      });

      it("should handle UploadChunk message", async () => {
        const callback = jest.fn();
        const data = {
          id: "foo",
          component: "UploadChunk",
          payload: {
            chunk: Uint8Array.from([1, 2, 3, 4]),
          },
        };

        await provider["receiveData"](callback);
        const spy1 = jest.spyOn(provider as any, "respond").mockReturnThis();
        const spy2 = jest.spyOn(provider as any, "completeReceive").mockReturnThis();
        socket.dispatchEvent(new MessageEvent("message", { data: encode(data).buffer }));
        expect(spy1).toHaveBeenCalledWith(socket, data.id, null);
        expect(spy2).not.toHaveBeenCalled();
        expect(callback).not.toHaveBeenCalled();
      });

      it("should handle UploadFinished message", async () => {
        const callback = jest.fn();
        const data = {
          id: "foo",
          component: "UploadFinished",
          payload: {
            hash: "bar",
          },
        };
        const result = "AwesomeResult";

        await provider["receiveData"](callback);
        const spy1 = jest.spyOn(provider as any, "respond").mockReturnThis();
        const spy2 = jest.spyOn(provider as any, "completeReceive").mockReturnValue(result);
        socket.dispatchEvent(new MessageEvent("message", { data: encode(data).buffer }));
        expect(spy1).toHaveBeenCalledWith(socket, data.id, null);
        expect(spy2).toHaveBeenCalledWith(data.payload.hash, []);
        expect(callback).toHaveBeenCalledWith(result);
      });

      it("should log invalid requests", async () => {
        const callback = jest.fn();
        const data = {
          id: "foo",
          component: "Foo",
        };

        await provider["receiveData"](callback);
        const spy1 = jest.spyOn(provider as any, "respond").mockReturnThis();
        const spy2 = jest.spyOn(provider as any, "completeReceive").mockReturnThis();
        socket.dispatchEvent(new MessageEvent("message", { data: encode(data).buffer }));
        expect(spy1).not.toHaveBeenCalled();
        expect(spy2).not.toHaveBeenCalled();
        await logger.expectToInclude("[WebSocketBrowserStorageProvider] Unsupported message in receiveData(): Foo");
      });
    });
  });

  describe("receiveFile()", () => {
    it("should fail", async () => {
      await expect(() => provider.receiveFile()).rejects.toMatchError(new GolemInternalError("Not implemented"));
    });
  });

  describe("createFileInfo()", () => {
    it("should return file info", async () => {
      const result = await provider["createFileInfo"]();
      expect(result.id).toBe("uuid");
      expect(result.url).toBe(`gftp://${TEST_IDENTITY}/uuid`);
    });
  });

  describe("createService()", () => {
    it("should create service and return service info", async () => {
      const data = { servicesId: "ID" };

      when(mockGsb.bindServices(anything())).thenResolve({
        servicesId: "ID", // FIXME: Incorrect type in ya-ts-client
      } as any);

      const result = await provider["createService"]({ id: "foo", url: "" }, []);

      verify(mockGsb.bindServices(anything())).once();

      expect(result.serviceId).toEqual("ID");
      expect(result.url.toString()).toEqual(
        `ws://127.0.0.1:7465/gsb-api/v1/services/${data.servicesId}?authToken=${yagnaApi.yagnaOptions.apiKey}`,
      );
    });

    it("should record the service for later release", async () => {
      const data = { servicesId: "ID" };

      when(mockGsb.bindServices(anything())).thenResolve({
        servicesId: "ID", // FIXME: Incorrect type in ya-ts-client
      } as any);

      await provider["createService"]({ id: "foo", url: "/file" }, []);

      verify(mockGsb.bindServices(anything())).once();

      expect(provider["services"].size).toBe(1);
      expect(provider["services"].get("/file")).toEqual(data.servicesId);
    });

    it("should throw when service creation fails", async () => {
      when(mockGsb.bindServices(anything())).thenReject(new Error("test_error"));
      await expect(() => {
        return provider["createService"]({ id: "foo", url: "/file" }, []);
      }).rejects.toThrow();
    });
  });

  describe("deleteService()", () => {
    it("should call delete service API", async () => {
      when(mockGsb.unbindServices(anything())).thenResolve({
        message: "Ok",
      });
      await provider["deleteService"]("Foo");
      verify(mockGsb.unbindServices(anything())).once();
    });

    it("should throw when delete API fails", async () => {
      when(mockGsb.unbindServices(anything())).thenReject(new Error("Some Error"));
      await expect(() => {
        return provider["deleteService"]("Foo");
      }).rejects.toThrow();
      verify(mockGsb.unbindServices(anything())).once();
    });
  });

  describe("respond()", () => {
    it("should send encoded message", () => {
      const payload = "Hello Message";
      const id = "Foo";
      const socket = {
        send: jest.fn().mockImplementation((data) => {
          const content = toObject(data.buffer) as any;
          expect(content.id).toEqual(id);
          expect(content.payload).toEqual(payload);
        }),
      };

      provider["respond"](socket as unknown as WebSocket, id, payload);
      expect(socket.send).toHaveBeenCalled();
    });
  });

  describe("completeReceive()", () => {
    it("should handle single chunk receive", () => {
      const msg = "Hello World";
      const chunk: UploadChunkChunk = {
        offset: 0,
        content: new TextEncoder().encode(msg),
      };
      const hashHex = jsSha3.sha3_256(chunk.content);

      const result = provider["completeReceive"](hashHex, [chunk]);
      expect(new TextDecoder().decode(result)).toEqual(msg);
    });

    it("should handle multiple chunk receive with in-order chunks", () => {
      const msg1 = "Hello World";
      const msg2 = ", how are you?";
      const chunks: UploadChunkChunk[] = [
        {
          offset: 0,
          content: new TextEncoder().encode(msg1),
        },
        {
          offset: msg1.length,
          content: new TextEncoder().encode(msg2),
        },
      ];
      const hashHex = jsSha3.sha3_256(msg1 + msg2);

      const result = provider["completeReceive"](hashHex, chunks);
      expect(new TextDecoder().decode(result)).toEqual(msg1 + msg2);
    });

    it("should handle multiple chunk receive with out-of-order chunks", () => {
      const msg1 = "Hello World";
      const msg2 = ", how are you?";
      const chunks: UploadChunkChunk[] = [
        {
          offset: msg1.length,
          content: new TextEncoder().encode(msg2),
        },
        {
          offset: 0,
          content: new TextEncoder().encode(msg1),
        },
      ];
      const hashHex = jsSha3.sha3_256(msg1 + msg2);

      const result = provider["completeReceive"](hashHex, chunks);
      expect(new TextDecoder().decode(result)).toEqual(msg1 + msg2);
    });

    it("should throw on invalid hash", () => {
      const msg = "Hello World";
      const chunk: UploadChunkChunk = {
        offset: 0,
        content: new TextEncoder().encode(msg),
      };
      expect(() => {
        provider["completeReceive"]("invalid-hash", [chunk]);
      }).toThrow();
    });
  });
});
