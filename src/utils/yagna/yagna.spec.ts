import { MIN_SUPPORTED_YAGNA, Yagna } from "./yagna";
import { imock, instance, spy, when } from "@johanblumenberg/ts-mockito";
import { IdentityModel } from "./identity";
import { GolemPlatformError } from "../../error/golem-error";

const mockFetch = jest.spyOn(global, "fetch");
const response = imock<Response>();

const mockIdentityModel = imock<IdentityModel>();

describe("Yagna Utils", () => {
  describe("Yagna version support checking", () => {
    describe("Positive cases - given min supported version is 0.14.0", () => {
      it.each(["0.14.0", "0.15.0-rc5", "pre-rel-v0.15.0-rc5"])(
        "should not throw when connect is called and the yagna version is %s",
        async (version) => {
          when(response.json()).thenResolve({
            current: {
              version: `${version}`,
              name: `v${version}`,
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

          const spyIdentity = spy(y.getApi().identity);
          const model = instance(mockIdentityModel);
          when(spyIdentity.getIdentity()).thenResolve(model);

          const identity = await y.connect();
          expect(identity).toEqual(model);
        },
      );
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

        await expect(() => y.connect()).rejects.toMatchError(
          new GolemPlatformError(
            `You run yagna in version 0.12.0 and the minimal version supported by the SDK is ${MIN_SUPPORTED_YAGNA}. Please consult the golem-js README to find matching SDK version or upgrade your yagna installation.`,
          ),
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

        await expect(() => y.connect()).rejects.toMatchError(
          new GolemPlatformError(
            `Unreadable yana version 'broken'. Can't proceed without checking yagna version support status.`,
          ),
        );
      });

      it("should throw an GolemError if fetching of the version information will fail", async () => {
        const testError = new Error("Something bad happened when trying to read yagna version via API");
        mockFetch.mockRejectedValue(testError);

        const y = new Yagna({
          apiKey: "test-key",
        });

        await expect(() => y.connect()).rejects.toMatchError(
          new GolemPlatformError(`Failed to establish yagna version due to: ${testError}`, testError),
        );
      });
    });
  });
});
