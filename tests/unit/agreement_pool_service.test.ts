jest.mock("ya-ts-client/dist/ya-market/api");

import { LoggerMock, YagnaMock } from "../mock";
import { Agreement, AgreementPoolService } from "../../src/agreement";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { Proposal as ProposalModel } from "ya-ts-client/dist/ya-market/src/models/proposal";
import { ProposalAllOfStateEnum } from "ya-ts-client/dist/ya-market";
import { Proposal } from "../../src/market";

const logger = new LoggerMock();
const mockAPI = new RequestorApi();
const mockSetCounteringProposalReference = jest.fn();
const yagnaApi = new YagnaMock().getApi();

const createProposal = (id) => {
  const model: ProposalModel = {
    constraints: "",
    issuerId: "",
    proposalId: "",
    state: ProposalAllOfStateEnum.Initial,
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

  return new Proposal(id, null, mockSetCounteringProposalReference, mockAPI, model, {
    constraints: "",
    properties: {},
  });
};

describe("Agreement Pool Service", () => {
  beforeEach(() => {
    logger.clear();
  });

  describe("run()", () => {
    it("should start service", async () => {
      const agreementService = new AgreementPoolService(yagnaApi, { logger });
      await agreementService.run();
      expect(logger.logs).toContain("Agreement Pool Service has started");
      await agreementService.end();
    });
  });
  describe("end()", () => {
    it("should stop service", async () => {
      const agreementService = new AgreementPoolService(yagnaApi, { logger });
      await agreementService.run();
      await agreementService.end();
      expect(logger.logs).toContain("Agreement Pool Service has been stopped");
    });
  });
  describe("getAvailableAgreement()", () => {
    it("should create and return agreement from available proposal pool", async () => {
      const agreementService = new AgreementPoolService(yagnaApi, { logger });
      await agreementService.run();

      await agreementService.addProposal(createProposal("proposal-id"));
      const agreement = await agreementService.getAgreement();
      expect(agreement).toBeInstanceOf(Agreement);
    });
    it("should return agreement if is available in the pool", async () => {
      const agreementService = new AgreementPoolService(yagnaApi, { logger });
      await agreementService.run();
      await agreementService.addProposal(createProposal("proposal-id"));
      const agreement1 = await agreementService.getAgreement();
      await agreementService.releaseAgreement(agreement1.id, true);
      const agreement2 = await agreementService.getAgreement();
      expect(agreement1).toEqual(agreement2);
    });
  });
  describe("releaseAgreement()", () => {
    it("should return agreement to the pool if flag reuse if on", async () => {
      const agreementService = new AgreementPoolService(yagnaApi, { logger });
      await agreementService.run();
      await agreementService.addProposal(createProposal("proposal-id"));
      const agreement = await agreementService.getAgreement();
      await agreementService.releaseAgreement(agreement.id, true);
      await logger.expectToInclude(`Agreement has been released for reuse`, { id: agreement.id });
    });

    it("should terminate agreement if flag reuse if off", async () => {
      const agreementService = new AgreementPoolService(yagnaApi, { logger });
      await agreementService.run();
      await agreementService.addProposal(createProposal("proposal-id"));
      const agreement = await agreementService.getAgreement();
      await agreementService.releaseAgreement(agreement.id, false);
      await logger.expectToInclude(`Agreement has been released and will be terminated`, { id: agreement.id });
      await logger.expectToInclude(`Agreement terminated`, { id: agreement.id });
    });

    it("should warn if there is no agreement with given id", async () => {
      const agreementService = new AgreementPoolService(yagnaApi, { logger });
      await agreementService.run();
      await agreementService.addProposal(createProposal("proposal-id"));
      const agreement = await agreementService.getAgreement();
      await agreementService.releaseAgreement("not-known-id", true);
      await logger.expectToInclude("Agreement not found in the pool", { id: "not-known-id" });
    });
  });

  describe("addProposal()", () => {
    it("should add proposal to pool", async () => {
      const agreementService = new AgreementPoolService(yagnaApi, { logger });
      await agreementService.run();

      await agreementService.addProposal(createProposal("proposal-id"));
      expect(logger.logs).toMatch(/New proposal added to pool .*/);

      await agreementService.end();
    });
  });
});
