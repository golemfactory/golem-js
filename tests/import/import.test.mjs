describe("ESM Import", () => {
  test("Import @golem-sdk/golem-js", async () => {
    const { YagnaApi } = await import("@golem-sdk/golem-js");
    expect(typeof YagnaApi).toBe("function");
  });

  test("Import @golem-sdk/golem-js/experimental", async () => {
    const { Job } = await import("@golem-sdk/golem-js/experimental");
    expect(typeof Job).toBe("function");
  });
});
