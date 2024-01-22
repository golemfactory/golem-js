import { MockPropertyPolicy, imock, instance, when } from "@johanblumenberg/ts-mockito";

import { getHealthyProvidersWhiteList } from "./helpers";
import { GolemInternalError } from "../error/golem-error";

const mockFetch = jest.spyOn(global, "fetch");
const response = imock<Response>();

beforeEach(() => {
  jest.resetAllMocks();
});

describe("Market Helpers", () => {
  describe("Getting public healthy providers whitelist", () => {
    describe("Positive cases", () => {
      test("Will return the list returned by the endpoint", async () => {
        // Given
        when(response.json()).thenResolve(["0xAAA", "0xBBB"]);
        mockFetch.mockResolvedValue(instance(response));

        // When
        const data = await getHealthyProvidersWhiteList();

        // Then
        expect(data).toEqual(["0xAAA", "0xBBB"]);
      });
    });

    describe("Negative cases", () => {
      test("It throws an error when the response from the API will not be a successful one (fetch -> response.ok)", async () => {
        // Given
        const mockResponse = imock<Response>(MockPropertyPolicy.StubAsProperty);
        when(mockResponse.ok).thenReturn(false);
        when(mockResponse.text()).thenResolve("{error:'test'}");
        mockFetch.mockResolvedValue(instance(mockResponse));

        // When, Then
        await expect(() => getHealthyProvidersWhiteList()).rejects.toThrow(
          new GolemInternalError(
            "Failed to download healthy provider whitelist due to an error: Error: Request to download healthy provider whitelist failed: {error:'test'}",
          ),
        );
      });

      test("It throws an error when executing of fetch will fail for any reason", async () => {
        // Given
        mockFetch.mockImplementation(() => {
          throw new Error("Something went wrong really bad!");
        });

        // When, Then
        await expect(() => getHealthyProvidersWhiteList()).rejects.toThrow(
          new GolemInternalError(
            "Failed to download healthy provider whitelist due to an error: Error: Something went wrong really bad!",
          ),
        );
      });
    });
  });
});
