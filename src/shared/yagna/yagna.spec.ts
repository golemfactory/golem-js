import { MIN_SUPPORTED_YAGNA, YagnaApi } from "./yagnaApi";
import { imock, instance, spy, when } from "@johanblumenberg/ts-mockito";
import { GolemPlatformError } from "../error/golem-error";
import { IdentityApi } from "ya-ts-client";

const mockIdentityModel = imock<IdentityApi.IdentityDTO>();

describe("Yagna Utils", () => {
  describe("Yagna version support checking", () => {
    describe("Positive cases - given min supported version is 0.15.0", () => {
      it.each(["0.15.0", "0.15.2", "0.15.3-rc5", "pre-rel-v0.15.3-rc5"])(
        "should not throw when connect is called and the yagna version is %s",
        async (version) => {
          const mockVersionResponse = {
            current: {
              version: `${version}`,
              name: `v${version}`,
              seen: false,
              releaseTs: "2023-12-07T14:23:48",
              insertionTs: "2023-12-07T18:22:45",
              updateTs: "2023-12-07T18:22:45",
            },
          };
          const y = new YagnaApi({
            apiKey: "test-key",
          });

          const spyVersion = spy(y.version);
          when(spyVersion.getVersion()).thenResolve(mockVersionResponse);

          const spyIdentity = spy(y.identity);
          const model = instance(mockIdentityModel);
          when(spyIdentity.getIdentity()).thenResolve(model);

          const identity = await y.connect();
          expect(identity).toEqual(model);
        },
      );
    });

    describe("Negative cases", () => {
      it("should throw when connect is called and yagna version is too low", async () => {
        const mockVersionResponse = {
          current: {
            version: "0.12.0",
            name: "v0.12.0",
            seen: false,
            releaseTs: "2023-12-07T14:23:48",
            insertionTs: "2023-12-07T18:22:45",
            updateTs: "2023-12-07T18:22:45",
          },
        };

        const y = new YagnaApi({
          apiKey: "test-key",
        });
        const spyVersion = spy(y.version);
        when(spyVersion.getVersion()).thenResolve(mockVersionResponse);

        await expect(() => y.connect()).rejects.toMatchError(
          new GolemPlatformError(
            `You run yagna in version 0.12.0 and the minimal version supported by the SDK is ${MIN_SUPPORTED_YAGNA}. Please consult the golem-js README to find matching SDK version or upgrade your yagna installation.`,
          ),
        );
      });

      it("should throw when connect is called and yagna version is somehow broken", async () => {
        const mockVersionResponse = {
          current: {
            version: "broken",
            name: "broken",
            seen: false,
            releaseTs: "2023-12-07T14:23:48",
            insertionTs: "2023-12-07T18:22:45",
            updateTs: "2023-12-07T18:22:45",
          },
        };

        const y = new YagnaApi({
          apiKey: "test-key",
        });
        const spyVersion = spy(y.version);
        when(spyVersion.getVersion()).thenResolve(mockVersionResponse);

        await expect(() => y.connect()).rejects.toMatchError(
          new GolemPlatformError(
            `Unreadable yana version 'broken'. Can't proceed without checking yagna version support status.`,
          ),
        );
      });

      it("should throw an GolemError if fetching of the version information will fail", async () => {
        const testError = new Error("Something bad happened when trying to read yagna version via API");

        const y = new YagnaApi({
          apiKey: "test-key",
        });

        const spyVersion = spy(y.version);
        when(spyVersion.getVersion()).thenReject(testError);

        await expect(() => y.connect()).rejects.toMatchError(
          new GolemPlatformError(`Failed to establish yagna version due to: ${testError}`, testError),
        );
      });
    });
  });
});
