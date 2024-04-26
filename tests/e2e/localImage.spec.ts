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
  DemandNew,
  defaultLogger,
} from "../../src";
import { AgreementApiAdapter } from "../../src/shared/yagna/adapters/agreement-api-adapter";
import { AgreementRepository } from "../../src/shared/yagna/repository/agreement-repository";
import { DemandRepository } from "../../src/shared/yagna/repository/demand-repository";
import { CacheService } from "../../src/shared/cache/CacheService";

const localImagePath = fileURLToPath(new URL("../fixtures/alpine.gvmi", import.meta.url).toString());

//TODO: fix this tests after refactoring all modules from the new architecture
describe.skip("Local Image", () => {
  let server: GvmiServer | undefined,
    yagna: YagnaApi | undefined,
    payment: PaymentService | undefined,
    agreementPool: AgreementPoolService | undefined,
    market: MarketService | undefined,
    activity: Activity | undefined,
    agreement: Agreement | undefined,
    agreementApi: AgreementApiAdapter;

  afterEach(async () => {
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
    agreementApi = new AgreementApiAdapter(
      yagna.appSessionId,
      yagna.market,
      new AgreementRepository(yagna.market, new DemandRepository(yagna.market, new CacheService<DemandNew>())),
      defaultLogger("localimage"),
    );
    agreementPool = new AgreementPoolService(yagna, agreementApi);
    market = new MarketService(agreementPool, yagna);

    await agreementPool.run();
    await market.run(workload, allocation);
    agreement = await agreementPool.getAgreement();
    payment.acceptPayments(agreement);

    // TODO:
    // activity await yagna.activity.control.;
    // await market.end();
    // const ctx = new WorkContext(activity, {});
    // await ctx.before();
    //
    // const result = await ctx.run("cat hello.txt");
    // expect(result.stdout?.toString().trim()).toEqual("hello from my local image 👋"); =
  });
});
