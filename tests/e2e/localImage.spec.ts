import { fileURLToPath } from "url";
import {
  Activity,
  Agreement,
  AgreementPoolService,
  MarketService,
  Package,
  PaymentService,
  WorkContext,
  YagnaApi,
  GvmiServer,
  serveLocalGvmi,
} from "../../src";

const localImagePath = fileURLToPath(new URL("../fixtures/alpine.gvmi", import.meta.url).toString());

describe("Local Image", () => {
  let server: GvmiServer | undefined,
    yagna: YagnaApi | undefined,
    payment: PaymentService | undefined,
    agreementPool: AgreementPoolService | undefined,
    market: MarketService | undefined,
    activity: Activity | undefined,
    agreement: Agreement | undefined;

  afterEach(async () => {
    await activity?.stop();
    if (agreement) {
      await agreementPool?.releaseAgreement(agreement.id, false);
    }
    await market?.end();
    await agreementPool?.end();
    await payment?.end();
    await server?.close();
  });

  it("allows the provider to download the image directly from me", async () => {
    server = serveLocalGvmi(localImagePath);
    await server.serve();
    const { url, hash } = server.getImage();
    const workload = Package.create({
      imageHash: hash,
      imageUrl: url,
    });

    yagna = new YagnaApi();
    payment = new PaymentService(yagna);
    await payment.run();
    const allocation = await payment.createAllocation();
    agreementPool = new AgreementPoolService(yagna);
    market = new MarketService(agreementPool, yagna);

    await agreementPool.run();
    await market.run(workload, allocation);
    agreement = await agreementPool.getAgreement();
    payment.acceptPayments(agreement);

    activity = await Activity.create(agreement, yagna);
    await market.end();
    const ctx = new WorkContext(activity, {});
    await ctx.before();

    const result = await ctx.run("cat hello.txt");
    expect(result.stdout?.toString().trim()).toEqual("hello from my local image 👋");
  });
});
