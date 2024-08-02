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
});
