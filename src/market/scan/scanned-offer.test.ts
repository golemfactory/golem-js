import { ScannedOffer } from "./scanned-offer";

describe("Scanned Offer", () => {
  test("Returns payment platform address information", async () => {
    const offer = new ScannedOffer({
      offerId: "example-id",
      properties: {
        "golem.com.payment.platform.erc20-polygon-glm.address": "0xPolygonAddress",
        "golem.com.payment.platform.erc20-holesky-tglm.address": "0xHoleskyAddress",
        "golem.com.payment.platform.nonsense": "0xNonsense",
        "some.other.prop": "with-a-value",
      },
      timestamp: new Date().toISOString(),
      providerId: "provider-id",
      constraints: "",
    });

    expect(offer.paymentPlatformAddresses["erc20-polygon-glm"]).toEqual("0xPolygonAddress");
    expect(offer.paymentPlatformAddresses["erc20-holesky-tglm"]).toEqual("0xHoleskyAddress");
    expect(Object.entries(offer.paymentPlatformAddresses).length).toEqual(2);
  });

  test("Provides API to get cost estimate", () => {
    const durationHours = 1;

    const hr2Sec = (hours: number) => hours * 60 * 60;

    const numThreads = 4;
    const startPrice = 0.3;
    const envPerSec = 0.2;
    const cpuPerSec = 0.1;

    const offer = new ScannedOffer({
      offerId: "example-id",
      properties: {
        "golem.com.payment.platform.erc20-polygon-glm.address": "0xPolygonAddress",
        "golem.com.payment.platform.erc20-holesky-tglm.address": "0xHoleskyAddress",
        "golem.com.payment.platform.nonsense": "0xNonsense",
        "golem.com.usage.vector": ["golem.usage.cpu_sec", "golem.usage.duration_sec"],
        "golem.com.pricing.model.linear.coeffs": [cpuPerSec, envPerSec, startPrice],
        "golem.inf.cpu.threads": numThreads,
        "some.other.prop": "with-a-value",
      },
      timestamp: new Date().toISOString(),
      providerId: "provider-id",
      constraints: "",
    });

    expect(offer.getEstimatedCost(durationHours)).toEqual(
      startPrice + numThreads * hr2Sec(durationHours) * cpuPerSec + hr2Sec(durationHours) * envPerSec,
    );
  });
});
