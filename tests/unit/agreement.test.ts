import { Agreement, ProviderInfo } from "../../src";
import { MarketApi } from "ya-ts-client";

const agreementData: MarketApi.AgreementDTO = {
  agreementId: "agreement-id",
  demand: {
    demandId: "demand-id",
    requestorId: "requestor-id",
    properties: {},
    constraints: "",
    timestamp: "2024-01-01T00:00:00.000Z",
  },
  offer: {
    offerId: "offer-id",
    providerId: "provider-id",
    properties: {
      "golem.node.id.name": "provider-name",
      "golem.com.payment.platform.erc20-holesky-tglm.address": "0xProviderWallet",
    },
    constraints: "",
    timestamp: "2024-01-01T00:00:00.000Z",
  },
  state: "Approved",
  timestamp: "2024-01-01T00:00:00.000Z",
  validTo: "2024-01-02T00:00:00.000Z",
};

describe("Agreement", () => {
  describe("getProviderInfo()", () => {
    it("should be a instance ProviderInfo with provider details", () => {
      const agreement = new Agreement(agreementData.agreementId, agreementData, "erc20-holesky-tglm");
      expect(agreement.getProviderInfo().id).toEqual("provider-id");
      expect(agreement.getProviderInfo().name).toEqual("provider-name");
      expect(agreement.getProviderInfo().walletAddress).toEqual("0xProviderWallet");
    });
  });

  describe("getState()", () => {
    it("should return state of agreement", () => {
      const agreement = new Agreement(agreementData.agreementId, agreementData, "erc20-holesky-tglm");
      expect(agreement.getState()).toEqual("Approved");
    });
  });
});
