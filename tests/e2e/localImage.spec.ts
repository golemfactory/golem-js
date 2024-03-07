import { GolemNetwork, GvmiServer, serveLocalGvmi } from "../../src/experimental";
const path = require("path");

const localImagePath = path.join(__dirname, "../mock/fixtures/alpine.gvmi");

describe("Local Image", () => {
  let server: GvmiServer;
  let golemClient: GolemNetwork;
  afterAll(async () => {
    await golemClient.close();
    await server.close();
  });

  it("allows the provider to download the image directly from me", async () => {
    golemClient = new GolemNetwork({});
    server = serveLocalGvmi(localImagePath);
    await server.serve();
    await golemClient.init();

    const job = golemClient.createJob<string>({
      package: {
        localImageServer: server,
      },
    });

    job.startWork(async (ctx) => {
      return String((await ctx.run("cat hello.txt")).stdout);
    });
    const result = (await job.waitForResult()) as string;
    expect(result.trim()).toEqual("hello from my local image 👋");
  });
});
