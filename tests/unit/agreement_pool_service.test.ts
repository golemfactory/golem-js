import { expect } from "chai";
import { LoggerMock } from "../mock/index.js";
import { Agreement, AgreementPoolService } from "../../yajsapi/agreement/index.js";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { Proposal as ProposalModel } from "ya-ts-client/dist/ya-market/src/models/proposal";
import { DemandOfferBase } from "ya-ts-client/dist/ya-market";
import { Proposal } from "../../yajsapi/market/proposal.js";

const logger = new LoggerMock();

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
    {} as DemandOfferBase
  );
};

describe("Agreement Pool Service", () => {
  beforeEach(() => {
    logger.clear();
  });

  describe("run()", () => {
    it("should start service", async () => {
      const agreementService = new AgreementPoolService({ logger });
      await agreementService.run();
      expect(logger.logs).to.include("Agreement Pool Service has started");
      await agreementService.end();
    });
  });
  describe("end()", () => {
    it("should stop service", async () => {
      const agreementService = new AgreementPoolService({ logger });
      await agreementService.run();
      await agreementService.end();
      expect(logger.logs).to.include("Agreement Pool Service has been stopped");
    });
  });
  describe("getAvailableAgreement()", () => {
    it("should create and return agreement from available proposal pool", async () => {
      const agreementService = new AgreementPoolService({ logger });
      await agreementService.run();

      await agreementService.addProposal(createProposal("proposal-id"));
      const agreement = await agreementService.getAgreement();
      expect(agreement).to.be.instanceof(Agreement);
    }).timeout(5000);
    it("should return agreement if is available in the pool", async () => {
      const agreementService = new AgreementPoolService({ logger });
      await agreementService.run();
      await agreementService.addProposal(createProposal("proposal-id"));
      const agreement1 = await agreementService.getAgreement();
      await agreementService.releaseAgreement(agreement1, true);
      const agreement2 = await agreementService.getAgreement();
      expect(agreement1).to.deep.equal(agreement2);
    }).timeout(5000);
  });
  describe("releaseAgreement()", () => {
    it("should return agreement to the pool if flag reuse if on", async () => {
      const agreementService = new AgreementPoolService({ logger });
      await agreementService.run();
      await agreementService.addProposal(createProposal("proposal-id"));
      const agreement = await agreementService.getAgreement();
      await agreementService.releaseAgreement(agreement, true);
      expect(logger.logs).to.include(`Agreement ${agreement.id} has been released for reuse`);
    }).timeout(5000);

    it("should terminate agreement if flag reuse if off", async () => {
      const agreementService = new AgreementPoolService({ logger });
      await agreementService.run();
      await agreementService.addProposal(createProposal("proposal-id"));
      const agreement = await agreementService.getAgreement();
      await agreementService.releaseAgreement(agreement, false);
      expect(logger.logs).to.include(`Agreement ${agreement.id} has been released and terminated`);
      expect(logger.logs).to.include(`Agreement ${agreement.id} terminated`);
    }).timeout(5000);

    it("should throw an exception if there is no agreement with given id", async () => {
      const agreementService = new AgreementPoolService({ logger });
      await agreementService.run();
      await agreementService.addProposal(createProposal("proposal-id"));
      const agreement = await agreementService.getAgreement();
      await expect(agreementService.releaseAgreement({ id: "not-known-id" } as Agreement, false)).to.be.rejectedWith(
        `Agreement not-known-id cannot found in pool`
      );
    }).timeout(5000);
  });

  describe("addProposal()", () => {
    it("should add proposal to pool", async () => {
      const agreementService = new AgreementPoolService({ logger });
      await agreementService.run();

      await agreementService.addProposal(createProposal("proposal-id"));
      expect(logger.logs).to.match(/New proposal added to pool from provider .*/);

      await agreementService.end();
    });
  });
});
