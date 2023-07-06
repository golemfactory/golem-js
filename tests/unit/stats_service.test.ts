import { Events } from "../../yajsapi/events/index.js";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import spies from "chai-spies";
import { LoggerMock } from "../mock/index.js";
import { StatsService } from "../../yajsapi/stats/service.js";
import { setMaxListeners } from "events";
import { ProposalDetails } from "../../yajsapi/market/proposal";
chai.use(chaiAsPromised);
chai.use(spies);
const expect = chai.expect;
const logger = new LoggerMock();
const eventTarget = new EventTarget();
const statServiceOptions = { logger, eventTarget };
setMaxListeners(20);

describe("Stats Service", () => {
  let statsService: StatsService;
  before(async () => {
    statsService = statsService = new StatsService(statServiceOptions);
    await statsService.run();
  });
  after(async () => {
    await statsService.end();
  });
  afterEach(() => {
    chai.spy.restore();
  });
  describe("Creating", () => {
    it("should start service", async () => {
      expect(logger.logs).to.include("Stats service has started");
    });
    it("should end service", async () => {
      await statsService.end();
      expect(logger.logs).to.include("Stats service has stopped");
    });
  });
  describe("Handling Events", () => {
    //Tasks
    it("should handle TaskStarted and call Tasks.add()", async () => {
      const spy = chai.spy.on(statsService["tasks"], "add");
      const event = new Events.TaskStarted({
        id: "taskId",
        agreementId: "agreementId",
        activityId: "activityId",
        providerId: "providerId",
        providerName: "providerName",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly({
        id: "taskId",
        startTime: event.timeStamp,
        agreementId: "agreementId",
      });
    });
    it("should handle TaskStarted and call Activities.add()", async () => {
      const spy = chai.spy.on(statsService["activities"], "add");
      const event = new Events.TaskStarted({
        id: "taskId",
        agreementId: "agreementId",
        activityId: "activityId",
        providerId: "providerId",
        providerName: "providerName",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly({ id: "activityId", taskId: "taskId", agreementId: "agreementId" });
    });
    it("should handle TaskRedone and call Tasks.retry()", async () => {
      const spy = chai.spy.on(statsService["tasks"], "retry");
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
      expect(spy).to.have.been.called.with.exactly("id", 1);
    });
    it("should handle TaskRejected and call Tasks.reject()", async () => {
      const spy = chai.spy.on(statsService["tasks"], "reject");
      const event = new Events.TaskRejected({
        id: "id",
        agreementId: "agreementId",
        activityId: "activityId",
        providerId: "providerId",
        providerName: "providerName",
        reason: "reason",
      });

      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly("id", event.timeStamp, "reason");
    });
    it("should handle TaskFinished and call Tasks.finish()", async () => {
      const spy = chai.spy.on(statsService["tasks"], "finish");
      const event = new Events.TaskFinished({ id: "id" });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly("id", event.timeStamp);
    });

    // Allocations
    it("should handle AllocationCreated and call Allocations.add()", async () => {
      const spy = chai.spy.on(statsService["allocations"], "add");
      const event = new Events.AllocationCreated({ id: "id", amount: 100, platform: "platform" });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly({ id: "id", amount: 100, platform: "platform" });
    });
    // Proposals
    it("should handle ProposalReceived and call Proposals.add()", async () => {
      const spy = chai.spy.on(statsService["proposals"], "add");
      const event = new Events.ProposalReceived({
        id: "id",
        providerId: "providerId",
        parentId: null,
        details: {} as ProposalDetails,
      });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly({ id: "id", providerId: "providerId" });
    });
    it("should handle ProposalReceived and call Provider.add()", async () => {
      const spy = chai.spy.on(statsService["providers"], "add");
      const event = new Events.ProposalReceived({
        id: "id",
        providerId: "providerId",
        parentId: null,
        details: {} as ProposalDetails,
      });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly({ id: "providerId" });
    });
    // Invoices
    it("should handle InvoiceReceived and call Invoice.add()", async () => {
      const spy = chai.spy.on(statsService["invoices"], "add");
      const event = new Events.InvoiceReceived({
        id: "id",
        providerId: "providerId",
        agreementId: "agreementId",
        amount: "100",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly({
        id: "id",
        providerId: "providerId",
        agreementId: "agreementId",
        amount: "100",
      });
    });
    // Payments
    it("should handle PaymentAccepted and call Payments.add()", async () => {
      const spy = chai.spy.on(statsService["payments"], "add");
      const event = new Events.PaymentAccepted({
        id: "id",
        providerId: "providerId",
        agreementId: "agreementId",
        amount: "100",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly({
        id: "id",
        providerId: "providerId",
        agreementId: "agreementId",
        amount: "100",
      });
    });
    // Providers
    it("should handle AgreementCreated and call Providers.add()", async () => {
      const spy = chai.spy.on(statsService["providers"], "add");
      const event = new Events.AgreementCreated({
        id: "id",
        providerId: "providerId",
        providerName: "providerName",
        proposalId: "proposalId",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly({ id: "providerId", providerName: "providerName" });
    });
    // Agreements
    it("should handle AgreementCreated and call Agreements.add()", async () => {
      const spy = chai.spy.on(statsService["agreements"], "add");
      const event = new Events.AgreementCreated({
        id: "id",
        providerId: "providerId",
        providerName: "providerName",
        proposalId: "proposalId",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly({ id: "id", providerId: "providerId", proposalId: "proposalId" });
    });
    it("should handle AgreementConfirmed and call Agreements.confirm()", async () => {
      const spy = chai.spy.on(statsService["agreements"], "confirm");
      const event = new Events.AgreementConfirmed({
        id: "id",
        providerId: "providerId",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly("id");
    });
    it("should handle AgreementRejected and call Agreements.reject()", async () => {
      const spy = chai.spy.on(statsService["agreements"], "reject");
      const event = new Events.AgreementRejected({
        id: "id",
        providerId: "providerId",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly("id");
    });
  });
});
