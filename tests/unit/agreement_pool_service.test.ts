import { LoggerMock, YagnaMock } from "../mock";
import { Agreement, AgreementPoolService } from "../../src/agreement";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { Proposal as ProposalModel } from "ya-ts-client/dist/ya-market/src/models/proposal";
import { DemandOfferBase } from "ya-ts-client/dist/ya-market";
import { Proposal } from "../../src/market";

const logger = new LoggerMock();
const yagnaApi = new YagnaMock().getApi();

const createProposal = (id) => {
  return new Proposal(
    id,
    null,
    () => {},
    {} as RequestorApi,
    {
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
      },
    } as ProposalModel,
    {} as DemandOfferBase,
  );
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
      expect(logger.logs).toContain(`Agreement ${agreement.id} has been released for reuse`);
    });

    it("should terminate agreement if flag reuse if off", async () => {
      const agreementService = new AgreementPoolService(yagnaApi, { logger });
      await agreementService.run();
      await agreementService.addProposal(createProposal("proposal-id"));
      const agreement = await agreementService.getAgreement();
      await agreementService.releaseAgreement(agreement.id, false);
      expect(logger.logs).toContain(`Agreement ${agreement.id} has been released and will be terminated`);
      expect(logger.logs).toContain(`Agreement ${agreement.id} terminated`);
    });

    it("should warn if there is no agreement with given id", async () => {
      const agreementService = new AgreementPoolService(yagnaApi, { logger });
      await agreementService.run();
      await agreementService.addProposal(createProposal("proposal-id"));
      const agreement = await agreementService.getAgreement();
      await agreementService.releaseAgreement("not-known-id", true);
      expect(logger.logs).toContain(`Agreement not-known-id not found in the pool`);
    });
  });

  describe("addProposal()", () => {
    it("should add proposal to pool", async () => {
      const agreementService = new AgreementPoolService(yagnaApi, { logger });
      await agreementService.run();

      await agreementService.addProposal(createProposal("proposal-id"));
      expect(logger.logs).toMatch(/New proposal added to pool from provider .*/);

      await agreementService.end();
    });
  });
});
