import { Agreement, Logger, Proposal, ProviderInfo, YagnaApi } from "../../src";
import { anything, imock, instance, mock, objectContaining, reset, verify, when } from "@johanblumenberg/ts-mockito";
import { MarketApi } from "ya-ts-client";

const testProvider: ProviderInfo = {
  id: "test_provider_id",
  name: "Test Provider",
  walletAddress: "test_wallet_address",
};

const mockLogger = imock<Logger>();
const mockYagna = mock(YagnaApi);
const mockProposal = mock(Proposal);
const mockAgreement = imock<MarketApi.AgreementDTO>();
const mockMarket = mock(MarketApi.RequestorService);

describe("Agreement", () => {
  beforeEach(() => {
    reset(mockLogger);
    reset(mockYagna);
    reset(mockProposal);
    reset(mockAgreement);
    reset(mockMarket);

    when(mockYagna.market).thenReturn(instance(mockMarket));

    when(mockMarket.createAgreement(anything())).thenResolve("agreement-id");
    when(mockMarket.getAgreement("agreement-id")).thenResolve(instance(mockAgreement));
    when(mockMarket.terminateAgreement("agreement-id", anything())).thenResolve({
      message: "Ok",
    });
    when(mockMarket.confirmAgreement("agreement-id", anything())).thenResolve({ message: "Ok" });
    when(mockMarket.waitForApproval("agreement-id", anything())).thenResolve({ message: "Ok" });

    when(mockAgreement.agreementId).thenReturn("agreement-id");
    when(mockAgreement.state).thenReturn("Approved");

    when(mockProposal.provider).thenReturn(testProvider);
  });

  describe("create()", () => {
    it("should create agreement for given proposal ID", async () => {
      const agreement = await Agreement.create(instance(mockProposal), instance(mockYagna), {
        logger: instance(mockLogger),
      });

      expect(agreement).toBeInstanceOf(Agreement);
      expect(agreement.id).toBeDefined();

      verify(mockLogger.debug("Agreement created", objectContaining({ id: agreement.id }))).once();
    });
  });

  describe("provider", () => {
    it("should be a instance ProviderInfo with provider details", async () => {
      const agreement = await Agreement.create(instance(mockProposal), instance(mockYagna), {
        logger: instance(mockLogger),
      });
      expect(agreement).toBeInstanceOf(Agreement);
      expect(agreement.getProviderInfo().id).toEqual(expect.any(String));
      expect(agreement.getProviderInfo().name).toEqual(expect.any(String));
    });
  });

  describe("getState()", () => {
    it("should return state of agreement", async () => {
      const agreement = await Agreement.create(instance(mockProposal), instance(mockYagna), {
        logger: instance(mockLogger),
      });
      expect(await agreement.getState()).toEqual("Approved");
    });
  });

  describe("terminate()", () => {
    it("should terminate agreement", async () => {
      const agreement = await Agreement.create(instance(mockProposal), instance(mockYagna), {
        logger: instance(mockLogger),
      });
      await agreement.terminate();
      verify(mockLogger.debug("Agreement terminated", objectContaining({ id: agreement.id }))).once();
    });
  });

  describe("confirm()", () => {
    it("should confirm agreement", async () => {
      const agreement = await Agreement.create(instance(mockProposal), instance(mockYagna), {
        logger: instance(mockLogger),
      });
      await agreement.confirm();
      verify(mockLogger.debug("Agreement approved", objectContaining({ id: agreement.id }))).once();
    });
  });
});
