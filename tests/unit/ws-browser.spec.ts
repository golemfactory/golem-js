import { consoleLogger, WebSocketBrowserStorageProvider, WebSocketStorageProviderOptions } from "../../yajsapi";
import { encode, toObject } from "flatbuffers/js/flexbuffers";
import { LoggerMock } from "../mock";
import * as jsSha3 from "js-sha3";
import { TEST_IDENTITY } from "../mock/fixtures";

jest.mock("uuid", () => ({ v4: () => "uuid" }));

type UploadChunkChunk = { offset: number; content: Uint8Array };

describe("WebSocketBrowserStorageProvider", () => {
  let logger: LoggerMock;
  const opts: WebSocketStorageProviderOptions = {
    yagnaOptions: {
      apiKey: "ApiKey",
      basePath: "http://yagna",
    },
  };

  const createProvider = () =>
    new WebSocketBrowserStorageProvider({
      ...opts,
      logger,
    });
  let provider: WebSocketBrowserStorageProvider;

  const originalFetch = global.fetch;
  const mockFetch = jest.fn();

  beforeEach(() => {
    logger = new LoggerMock();
    provider = createProvider();

    jest.clearAllMocks();
  });

  beforeAll(() => {
    global.fetch = mockFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe("constructor", () => {
    it("should create default logger", () => {
      const provider = new WebSocketBrowserStorageProvider({ ...opts });
      expect(provider["logger"]).toBeDefined();
    });

    it("should use provided logger", () => {
      const logger = consoleLogger();
      const provider = new WebSocketBrowserStorageProvider({ ...opts, logger });
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
      await expect(() => provider.publishFile()).rejects.toThrowError();
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
      await expect(() => provider.receiveFile()).rejects.toThrowError();
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
      mockFetch.mockImplementation((url, init: RequestInit) => {
        expect(url.toString()).toEqual(`${opts.yagnaOptions.basePath}/gsb-api/v1/services`);
        expect(init.headers!["Authorization"]).toBe(`Bearer ${opts.yagnaOptions.apiKey}`);
        return Promise.resolve({
          status: 201,
          json: () => Promise.resolve(data),
        });
      });

      const result = await provider["createService"]({ id: "foo", url: "" }, []);
      expect(mockFetch).toHaveBeenCalled();
      expect(result.serviceId).toEqual("ID");
      expect(result.url.toString()).toEqual(
        `ws://yagna/gsb-api/v1/services/${data.servicesId}?authToken=${opts.yagnaOptions.apiKey}`,
      );
    });

    it("should record the service for later release", async () => {
      const data = { servicesId: "ID" };
      mockFetch.mockResolvedValue({
        status: 201,
        json: () => Promise.resolve(data),
      });

      await provider["createService"]({ id: "foo", url: "/file" }, []);
      expect(mockFetch).toHaveBeenCalled();
      expect(provider["services"].size).toBe(1);
      expect(provider["services"].get("/file")).toEqual(data.servicesId);
    });

    it("should throw when service creation fails", async () => {
      mockFetch.mockResolvedValue({
        status: 404,
      });

      await expect(() => {
        return provider["createService"]({ id: "foo", url: "/file" }, []);
      }).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("deleteService()", () => {
    it("should call delete service API", async () => {
      mockFetch.mockImplementation((url, init: RequestInit) => {
        expect(url.toString()).toEqual(`${opts.yagnaOptions.basePath}/gsb-api/v1/services/Foo`);
        expect(init.headers!["Authorization"]).toBe(`Bearer ${opts.yagnaOptions.apiKey}`);
        return Promise.resolve({ status: 200 });
      });

      await provider["deleteService"]("Foo");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should throw when delete API fails", async () => {
      mockFetch.mockResolvedValue({
        status: 404,
      });

      await expect(() => {
        return provider["deleteService"]("Foo");
      }).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalled();
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
