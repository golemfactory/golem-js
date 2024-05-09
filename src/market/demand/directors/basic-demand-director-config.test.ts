import { BasicDemandDirectorConfig } from "./basic-demand-director-config";

describe("BasicDemandDirectorConfig", () => {
  test("should throw user error if expiration option is invalid", () => {
    expect(() => {
      new BasicDemandDirectorConfig({
        expirationSec: -3,
        subnetTag: "public",
      });
    }).toThrow("The demand expiration time has to be a positive integer");
  });
});
