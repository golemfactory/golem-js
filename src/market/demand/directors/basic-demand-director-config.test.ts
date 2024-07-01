import { BasicDemandDirectorConfig } from "./basic-demand-director-config";

describe("BasicDemandDirectorConfig", () => {
  test("it sets the subnet tag property", () => {
    const config = new BasicDemandDirectorConfig({
      subnetTag: "public",
    });

    expect(config.subnetTag).toBe("public");
  });
});
