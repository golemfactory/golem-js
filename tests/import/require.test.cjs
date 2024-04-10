describe("CommonJS Import", () => {
  test("Require @golem-sdk/golem-js", () => {
    const { YagnaApi } = require("@golem-sdk/golem-js");
    expect(typeof YagnaApi).toBe("function");
  });

  test("Require @golem-sdk/golem-js/experimental", async () => {
    const { GolemNetwork } = require("@golem-sdk/golem-js/experimental");
    expect(typeof GolemNetwork).toBe("function");
  });
});
