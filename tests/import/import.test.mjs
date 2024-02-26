describe("ESM Import", () => {
  test("Import @golem-sdk/golem-js", async () => {
    const { YagnaApi } = await import("@golem-sdk/golem-js");
    expect(typeof YagnaApi).toBe("function");
  });

  test("Import @golem-sdk/golem-js/experimental", async () => {
    const { GolemNetwork } = await import("@golem-sdk/golem-js/experimental");
    expect(typeof GolemNetwork).toBe("function");
  });
});
