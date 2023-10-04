import { MockPropertyPolicy, imock, instance, when } from "@johanblumenberg/ts-mockito";

import { getHealthyProvidersWhiteList } from "./helpers";

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
      test("If the request will be made, but will not be a successful one, it will return an empty array", async () => {
        // Given
        const mockResponse = imock<Response>(MockPropertyPolicy.StubAsProperty);
        when(mockResponse.ok).thenReturn(false);
        mockFetch.mockResolvedValue(instance(mockResponse));

        // When
        const data = await getHealthyProvidersWhiteList();

        // Then
        expect(data).toEqual([]);
      });

      test("If the implementation will throw any kind of error, then it will return an empty array", async () => {
        // Given
        mockFetch.mockImplementation(() => {
          throw new Error("Something went wrong really bad!");
        });

        // When
        const data = await getHealthyProvidersWhiteList();

        // Then
        expect(data).toEqual([]);
      });
    });
  });
});
