import { Result, ResultState } from "./results";

describe("Results", () => {
  describe("converting output to JSON", () => {
    describe("positive cases", () => {
      test("produces JSON when the stdout contains correct data", () => {
        const result = new Result({
          index: 0,
          result: ResultState.Ok,
          stdout: '{ "value": 55 }\n',
          stderr: null,
          message: null,
          isBatchFinished: true,
          eventDate: "2023-08-29T09:23:52.305095307Z",
        });

        expect(result.getOutputAsJson()).toEqual({
          value: 55,
        });
      });
    });

    describe("negative cases", () => {
      test("throws an error when stdout does not contain nice JSON", () => {
        const result = new Result({
          index: 0,
          result: ResultState.Ok,
          stdout: "not json\n",
          stderr: null,
          message: null,
          isBatchFinished: true,
          eventDate: "2023-08-29T09:23:52.305095307Z",
        });

        expect(() => result.getOutputAsJson()).toThrow("Failed to parse output to JSON!");
      });
    });
  });
});
