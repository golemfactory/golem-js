import { Agreement, Demand, DemandSpecification } from "../index";
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

const demand = new Demand(
  "demand-id",
  new DemandSpecification(
    {
      constraints: [],
      properties: [],
    },
    "erc20-holesky-tglm",
    30 * 60,
  ),
);

describe("Agreement", () => {
  describe("get provider()", () => {
    it("should be a instance ProviderInfo with provider details", () => {
      const agreement = new Agreement(agreementData.agreementId, agreementData, demand);
      expect(agreement.provider.id).toEqual("provider-id");
      expect(agreement.provider.name).toEqual("provider-name");
      expect(agreement.provider.walletAddress).toEqual("0xProviderWallet");
    });
  });

  describe("getState()", () => {
    it("should return state of agreement", () => {
      const agreement = new Agreement(agreementData.agreementId, agreementData, demand);
      expect(agreement.getState()).toEqual("Approved");
    });
  });
});
