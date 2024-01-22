import { MIN_SUPPORTED_YAGNA, Yagna } from "./yagna";
import { imock, instance, when } from "@johanblumenberg/ts-mockito";

const mockFetch = jest.spyOn(global, "fetch");
const response = imock<Response>();

describe("Yagna Utils", () => {
  describe("Yagna version support checking", () => {
    describe("Positive cases", () => {
      it("should not throw when connect is called and the yagna version is supported", async () => {
        when(response.json()).thenResolve({
          current: {
            version: "0.15.0",
            name: "v0.15.0",
            seen: false,
            releaseTs: "2023-12-07T14:23:48",
            insertionTs: "2023-12-07T18:22:45",
            updateTs: "2023-12-07T18:22:45",
          },
          pending: null,
        });
        mockFetch.mockResolvedValue(instance(response));

        const y = new Yagna({
          apiKey: "test-key",
        });

        const version = await y.connect();
        expect(version).toEqual("0.15.0");
      });

      it("should accept pre-release versions of yagna", async () => {
        when(response.json()).thenResolve({
          current: {
            version: "0.15.0-rc5",
            name: "v0.15.0-rc5",
            seen: false,
            releaseTs: "2023-12-07T14:23:48",
            insertionTs: "2023-12-07T18:22:45",
            updateTs: "2023-12-07T18:22:45",
          },
          pending: null,
        });
        mockFetch.mockResolvedValue(instance(response));

        const y = new Yagna({
          apiKey: "test-key",
        });

        const version = await y.connect();
        expect(version).toEqual("0.15.0");
      });
    });

    describe("Negative cases", () => {
      it("should throw when connect is called and yagna version is too low", async () => {
        when(response.json()).thenResolve({
          current: {
            version: "0.12.0",
            name: "v0.12.0",
            seen: false,
            releaseTs: "2023-12-07T14:23:48",
            insertionTs: "2023-12-07T18:22:45",
            updateTs: "2023-12-07T18:22:45",
          },
          pending: null,
        });
        mockFetch.mockResolvedValue(instance(response));

        const y = new Yagna({
          apiKey: "test-key",
        });

        await expect(() => y.connect()).rejects.toThrowError(
          `You run yagna in version 0.12.0 and the minimal version supported by the SDK is ${MIN_SUPPORTED_YAGNA}`,
        );
      });

      it("should throw when connect is called and yagna version is somehow broken", async () => {
        when(response.json()).thenResolve({
          current: {
            version: "broken",
            name: "broken",
            seen: false,
            releaseTs: "2023-12-07T14:23:48",
            insertionTs: "2023-12-07T18:22:45",
            updateTs: "2023-12-07T18:22:45",
          },
          pending: null,
        });
        mockFetch.mockResolvedValue(instance(response));

        const y = new Yagna({
          apiKey: "test-key",
        });

        await expect(() => y.connect()).rejects.toThrowError(
          `Unreadable yana version 'broken'. Can't proceed without checking yagna version support status.`,
        );
      });
    });
  });
});
