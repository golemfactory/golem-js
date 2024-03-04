describe("ESM Import", () => {
  test("Import @golem-sdk/golem-js", async () => {
    const { Yagna } = await import("@golem-sdk/golem-js");
    expect(typeof Yagna).toBe("function");
  });

  test("Import @golem-sdk/golem-js/experimental", async () => {
    const { GolemNetwork } = await import("@golem-sdk/golem-js/experimental");
    expect(typeof GolemNetwork).toBe("function");
  });
});
