import { anything, imock, instance, mock, reset, when } from "@johanblumenberg/ts-mockito";
import { Agreement, AgreementPoolService, Demand, OfferProposal, YagnaApi } from "../../src";
import { MarketApi } from "ya-ts-client";
import { LoggerMock } from "../mock/utils/logger";
import { IAgreementApi } from "../../src/market/agreement/agreement";

const logger = new LoggerMock();

const mockYagna = mock(YagnaApi);
const mockMarket = mock(MarketApi.RequestorService);

const yagnaApi = instance(mockYagna);
const marketApi = instance(mockMarket);

const mockAgreementApi = imock<IAgreementApi>();

const createProposal = (id: string) => {
  const demandMock = mock(Demand);
  when(demandMock.id).thenReturn(id);
  const testDemand = instance(demandMock);

  const model: MarketApi.ProposalDTO = {
    constraints: "",
    issuerId: "",
    proposalId: "",
    state: "Initial",
    timestamp: "",
    properties: {
      "golem.activity.caps.transfer.protocol": "protocol",
      "golem.inf.cpu.brand": "cpu_brand",
      "golem.inf.cpu.capabilities": "cpu_capabilities",
      "golem.inf.cpu.cores": "cpu_cores",
      "golem.inf.cpu.threads": "cpu_threads",
      "golem.inf.mem.gib": "mem_gib",
      "golem.inf.storage.gib": "storage_gib",
      "golem.node.id.name": "node_id_name",
      "golem.node.net.is-public": true,
      "golem.runtime.capabilities": ["a", "b", "c"],
      "golem.runtime.name": "runtime_name",
      "golem.com.usage.vector": ["golem.usage.duration_sec", "golem.usage.cpu_sec"],
      "golem.com.pricing.model.linear.coeffs": [0.1, 0.2, 0.0],
    },
  };

  return new OfferProposal(model, testDemand);
};

const sample: MarketApi.AgreementDTO = {
  agreementId: "agreement-id",
  state: "Proposal",
  demand: {
    demandId: "demand-id",
    properties: {},
    constraints: "",
    requestorId: "requestor-id",
    timestamp: "",
  },
  offer: {
    constraints: "",
    properties: {},
    timestamp: "",
    providerId: "provider-id",
    offerId: "offer-id",
  },
  timestamp: "",
  validTo: "",
};

describe.skip("Agreement Pool Service", () => {
  beforeEach(() => {
    logger.clear();

    reset(mockYagna);
    reset(mockMarket);

    when(mockYagna.market).thenReturn(marketApi);

    when(mockMarket.createAgreement(anything())).thenResolve("agreement-id");

    when(mockMarket.getAgreement("agreement-id"))
      .thenResolve({ ...sample, state: "Proposal" })
      .thenResolve({ ...sample, state: "Approved" });

    when(mockMarket.confirmAgreement("agreement-id", anything())).thenResolve({
      message: "Great!",
    });

    when(mockMarket.waitForApproval("agreement-id", anything())).thenResolve({
      message: "We got you!",
    });
  });

  const proposal = createProposal("proposal-id");

  describe("run()", () => {
    it("should start service", async () => {
      const agreementService = new AgreementPoolService(yagnaApi, instance(mockAgreementApi), { logger });
      await agreementService.run();
      expect(logger.logs).toContain("Agreement Pool Service has started");
      await agreementService.end();
    });
  });
  describe("end()", () => {
    it("should stop service", async () => {
      const agreementService = new AgreementPoolService(yagnaApi, instance(mockAgreementApi), { logger });
      await agreementService.run();
      await agreementService.end();
      expect(logger.logs).toContain("Agreement Pool Service has been stopped");
    });
  });

  describe("getAvailableAgreement()", () => {
    it("should create and return agreement from available proposal pool", async () => {
      // Given
      const agreementService = new AgreementPoolService(yagnaApi, instance(mockAgreementApi), { logger });

      // When
      await agreementService.run();
      await agreementService.addProposal(proposal);
      const agreement = await agreementService.getAgreement();

      // Then
      expect(agreement).toBeInstanceOf(Agreement);
      await agreementService.end();
    });

    it("should return agreement if is available in the pool even after releasing it", async () => {
      const agreementService = new AgreementPoolService(yagnaApi, instance(mockAgreementApi), { logger });

      await agreementService.run();
      await agreementService.addProposal(proposal);
      const agreement1 = await agreementService.getAgreement();
      await agreementService.releaseAgreement(agreement1.id, true);
      const agreement2 = await agreementService.getAgreement();

      expect(agreement1).toEqual(agreement2);
      await agreementService.end();
    });
  });

  describe("releaseAgreement()", () => {
    it("should return agreement to the pool if flag reuse is true", async () => {
      const agreementService = new AgreementPoolService(yagnaApi, instance(mockAgreementApi), { logger });
      await agreementService.run();
      await agreementService.addProposal(proposal);
      const agreement = await agreementService.getAgreement();
      await agreementService.releaseAgreement(agreement.id, true);
      await logger.expectToInclude(`Agreement has been released for reuse`, { id: agreement.id });
      await agreementService.end();
    });

    it("should terminate agreement if flag reuse is false", async () => {
      const agreementService = new AgreementPoolService(yagnaApi, instance(mockAgreementApi), { logger });
      await agreementService.run();
      await agreementService.addProposal(proposal);
      const agreement = await agreementService.getAgreement();
      await agreementService.releaseAgreement(agreement.id, false);
      await logger.expectToInclude(`Agreement has been released and will be terminated`, { id: agreement.id });
      await logger.expectToInclude(`Agreement terminated`, { id: agreement.id });
      await agreementService.end();
    });

    it("should warn if there is no agreement with given id", async () => {
      const agreementService = new AgreementPoolService(yagnaApi, instance(mockAgreementApi), { logger });
      await agreementService.run();
      await agreementService.addProposal(proposal);
      const agreement = await agreementService.getAgreement();
      await agreementService.releaseAgreement("not-known-id", true);
      await logger.expectToInclude("Agreement not found in the pool", { id: "not-known-id" });
      await agreementService.end();
    });

    it("should terminate agreement if pool is full", async () => {
      const agreementService = new AgreementPoolService(yagnaApi, instance(mockAgreementApi), {
        logger,
        agreementMaxPoolSize: 1,
      });
      await agreementService.run();
      await agreementService.addProposal(createProposal("proposal-id-1"));
      await agreementService.addProposal(createProposal("proposal-id-2"));
      const agreement1 = await agreementService.getAgreement();
      const agreement2 = await agreementService.getAgreement();
      await agreementService.releaseAgreement(agreement1.id, true);
      await agreementService.releaseAgreement(agreement2.id, true);
      await logger.expectToInclude(`Agreement has been released for reuse`, { id: agreement1.id });
      await logger.expectToInclude(`Agreement cannot return to the pool because the pool is already full`, {
        id: agreement2.id,
      });
      await logger.expectToInclude(`Agreement has been released and will be terminated`, { id: agreement2.id });
      await agreementService.end();
    });
  });

  describe("addProposal()", () => {
    it("should add proposal to pool", async () => {
      const agreementService = new AgreementPoolService(yagnaApi, instance(mockAgreementApi), { logger });
      await agreementService.run();

      await agreementService.addProposal(createProposal("proposal-id"));
      expect(logger.logs).toMatch(/New proposal added to pool .*/);

      await agreementService.end();
    });
  });
});
