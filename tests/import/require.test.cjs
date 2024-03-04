describe("CommonJS Import", () => {
  test("Require @golem-sdk/golem-js", () => {
    const { Yagna } = require("@golem-sdk/golem-js");
    expect(typeof Yagna).toBe("function");
  });

  test("Require @golem-sdk/golem-js/experimental", async () => {
    const { GolemNetwork } = require("@golem-sdk/golem-js/experimental");
    expect(typeof GolemNetwork).toBe("function");
  });
});
