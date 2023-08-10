import { Events } from "../../src/events";
import { LoggerMock } from "../mock";
import { StatsService } from "../../src/stats/service";
import { setMaxListeners } from "events";
import { ProposalDetails } from "../../src/market/proposal";
const logger = new LoggerMock();
const eventTarget = new EventTarget();
const statServiceOptions = { logger, eventTarget };
setMaxListeners(20);

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
    //Tasks
    it("should handle TaskStarted and call Tasks.add()", async () => {
      const spy = jest.spyOn(statsService["tasks"], "add");
      const event = new Events.TaskStarted({
        id: "taskId",
        agreementId: "agreementId",
        activityId: "activityId",
        providerId: "providerId",
        providerName: "providerName",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith({
        id: "taskId",
        startTime: event.timeStamp,
        agreementId: "agreementId",
      });
    });
    it("should handle TaskStarted and call Activities.add()", async () => {
      const spy = jest.spyOn(statsService["activities"], "add");
      const event = new Events.TaskStarted({
        id: "taskId",
        agreementId: "agreementId",
        activityId: "activityId",
        providerId: "providerId",
        providerName: "providerName",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith({ id: "activityId", taskId: "taskId", agreementId: "agreementId" });
    });
    it("should handle TaskRedone and call Tasks.retry()", async () => {
      const spy = jest.spyOn(statsService["tasks"], "retry");
      const event = new Events.TaskRedone({
        id: "id",
        agreementId: "agreementId",
        retriesCount: 1,
        activityId: "activityId",
        providerId: "providerId",
        providerName: "providerName",
        reason: "reason",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith("id", 1);
    });
    it("should handle TaskRejected and call Tasks.reject()", async () => {
      const spy = jest.spyOn(statsService["tasks"], "reject");
      const event = new Events.TaskRejected({
        id: "id",
        agreementId: "agreementId",
        activityId: "activityId",
        providerId: "providerId",
        providerName: "providerName",
        reason: "reason",
      });

      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith("id", event.timeStamp, "reason");
    });
    it("should handle TaskFinished and call Tasks.finish()", async () => {
      const spy = jest.spyOn(statsService["tasks"], "finish");
      const event = new Events.TaskFinished({ id: "id" });
      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith("id", event.timeStamp);
    });

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
        providerId: "providerId",
        parentId: null,
        details: {} as ProposalDetails,
      });
      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith({ id: "id", providerId: "providerId" });
    });
    it("should handle ProposalReceived and call Provider.add()", async () => {
      const spy = jest.spyOn(statsService["providers"], "add");
      const event = new Events.ProposalReceived({
        id: "id",
        providerId: "providerId",
        parentId: null,
        details: {} as ProposalDetails,
      });
      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith({ id: "providerId" });
    });
    // Invoices
    it("should handle InvoiceReceived and call Invoice.add()", async () => {
      const spy = jest.spyOn(statsService["invoices"], "add");
      const event = new Events.InvoiceReceived({
        id: "id",
        providerId: "providerId",
        agreementId: "agreementId",
        amount: "100",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith({
        id: "id",
        providerId: "providerId",
        agreementId: "agreementId",
        amount: "100",
      });
    });
    // Payments
    it("should handle PaymentAccepted and call Payments.add()", async () => {
      const spy = jest.spyOn(statsService["payments"], "add");
      const event = new Events.PaymentAccepted({
        id: "id",
        providerId: "providerId",
        agreementId: "agreementId",
        amount: "100",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith({
        id: "id",
        providerId: "providerId",
        agreementId: "agreementId",
        amount: "100",
      });
    });
    // Providers
    it("should handle AgreementCreated and call Providers.add()", async () => {
      const spy = jest.spyOn(statsService["providers"], "add");
      const event = new Events.AgreementCreated({
        id: "id",
        providerId: "providerId",
        providerName: "providerName",
        proposalId: "proposalId",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith({ id: "providerId", providerName: "providerName" });
    });
    // Agreements
    it("should handle AgreementCreated and call Agreements.add()", async () => {
      const spy = jest.spyOn(statsService["agreements"], "add");
      const event = new Events.AgreementCreated({
        id: "id",
        providerId: "providerId",
        providerName: "providerName",
        proposalId: "proposalId",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith({ id: "id", providerId: "providerId", proposalId: "proposalId" });
    });
    it("should handle AgreementConfirmed and call Agreements.confirm()", async () => {
      const spy = jest.spyOn(statsService["agreements"], "confirm");
      const event = new Events.AgreementConfirmed({
        id: "id",
        providerId: "providerId",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith("id");
    });
    it("should handle AgreementRejected and call Agreements.reject()", async () => {
      const spy = jest.spyOn(statsService["agreements"], "reject");
      const event = new Events.AgreementRejected({
        id: "id",
        providerId: "providerId",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith("id");
    });
  });
});
