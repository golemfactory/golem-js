import { Events } from "../../src/events";
import { ProposalDetails, StatsService } from "../../src";
import { setMaxListeners } from "events";
import { LoggerMock } from "../mock/utils/logger";

const logger = new LoggerMock();
const eventTarget = new EventTarget();
const statServiceOptions = { logger, eventTarget };
setMaxListeners(20);

const testProvider = {
  id: "testId",
  name: "test name",
  walletAddress: "testWalletAddress",
};
describe("Stats Service", () => {
  let statsService: StatsService;
  beforeAll(async () => {
    statsService = statsService = new StatsService(statServiceOptions);
    await statsService.run();
  });
  afterAll(async () => {
    await statsService.end();
  });
  describe("Creating", () => {
    it("should start service", async () => {
      expect(logger.logs).toContain("Stats service has started");
    });
    it("should end service", async () => {
      await statsService.end();
      expect(logger.logs).toContain("Stats service has stopped");
    });
  });
  describe("Handling Events", () => {
    // Allocations
    it("should handle AllocationCreated and call Allocations.add()", async () => {
      const spy = jest.spyOn(statsService["allocations"], "add");
      const event = new Events.AllocationCreated({ id: "id", amount: 100, platform: "platform" });
      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith({ id: "id", amount: 100, platform: "platform" });
    });
    // Proposals
    it("should handle ProposalReceived and call Proposals.add()", async () => {
      const spy = jest.spyOn(statsService["proposals"], "add");
      const event = new Events.ProposalReceived({
        id: "id",
        provider: testProvider,
        parentId: null,
        details: {} as ProposalDetails,
      });
      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith({ id: "id", providerId: testProvider.id });
    });
    it("should handle ProposalReceived and call Provider.add()", async () => {
      const spy = jest.spyOn(statsService["providers"], "add");
      const event = new Events.ProposalReceived({
        id: "id",
        provider: testProvider,
        parentId: null,
        details: {} as ProposalDetails,
      });
      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith(testProvider);
    });
    // Invoices
    it("should handle InvoiceReceived and call Invoice.add()", async () => {
      const spy = jest.spyOn(statsService["invoices"], "add");
      const event = new Events.InvoiceReceived({
        id: "id",
        provider: testProvider,
        agreementId: "agreementId",
        amount: 100,
      });
      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith({
        id: "id",
        provider: testProvider,
        agreementId: "agreementId",
        amount: 100,
      });
    });
    // Payments
    it("should handle PaymentAccepted and call Payments.add()", async () => {
      const spy = jest.spyOn(statsService["payments"], "add");
      const event = new Events.PaymentAccepted({
        id: "id",
        provider: testProvider,
        agreementId: "agreementId",
        amount: 100,
      });
      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith({
        id: "id",
        provider: testProvider,
        agreementId: "agreementId",
        amount: 100,
      });
    });
    // Providers
    it("should handle AgreementCreated and call Providers.add()", async () => {
      const spy = jest.spyOn(statsService["providers"], "add");
      const event = new Events.AgreementCreated({
        id: "id",
        provider: testProvider,
        proposalId: "proposalId",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith(testProvider);
    });
    // Agreements
    it("should handle AgreementCreated and call Agreements.add()", async () => {
      const spy = jest.spyOn(statsService["agreements"], "add");
      const event = new Events.AgreementCreated({
        id: "id",
        provider: testProvider,
        proposalId: "proposalId",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith({ id: "id", provider: testProvider, proposalId: "proposalId" });
    });
    it("should handle AgreementConfirmed and call Agreements.confirm()", async () => {
      const spy = jest.spyOn(statsService["agreements"], "confirm");
      const event = new Events.AgreementConfirmed({
        id: "id",
        provider: testProvider,
      });
      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith("id");
    });
    it("should handle AgreementRejected and call Agreements.reject()", async () => {
      const spy = jest.spyOn(statsService["agreements"], "reject");
      const event = new Events.AgreementRejected({
        id: "id",
        provider: testProvider,
      });
      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith("id");
    });
  });
});
