import { Events, EventType, BaseEvent } from "../../yajsapi/events";
import { Tasks } from "../../yajsapi/stats/tasks";

import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import spies from "chai-spies";
import { LoggerMock } from "../mock";
import { StatsService } from "../../yajsapi/stats/service";
import { ComputationFinished } from "../../yajsapi/events/events";
chai.use(chaiAsPromised);
chai.use(spies);
const expect = chai.expect;
const logger = new LoggerMock();
const eventTarget = new EventTarget();
const statServiceOptions = { logger, eventTarget };

describe("Stats Service", () => {
  describe("Creating", () => {
    it("should start service", async () => {
      const statsService = new StatsService(statServiceOptions);
      await statsService.run();
      expect(logger.logs).to.include("Stats service has started");
    });
    it("should end service", async () => {
      const statsService = new StatsService(statServiceOptions);
      await statsService.run();
      await statsService.end();
      expect(logger.logs).to.include("Stats service has stopped");
    });
  });
  describe("Handling Events", () => {
    //Tasks
    it("should handle ComputationStarted and call Tasks.addStartTime()", async () => {
      const statsService = new StatsService(statServiceOptions);
      await statsService.run();
      const spy = chai.spy.on(statsService.tasks, "addStartTime");
      const event = new Events.ComputationStarted();
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly(event.timeStamp);
    });
    it("should handle ComputationFinished and call Tasks.addStopTime()", async () => {
      const statsService = new StatsService(statServiceOptions);
      await statsService.run();
      const spy = chai.spy.on(statsService.tasks, "addStopTime");
      const event = new Events.ComputationFinished();
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly(event.timeStamp);
    });
    it("should handle ComputationFailed and call Tasks. ?");
    it("should handle TaskStarted and call Tasks.startTask()", async () => {
      const statsService = new StatsService(statServiceOptions);
      await statsService.run();
      const spy = chai.spy.on(statsService.tasks, "startTask");
      const event = new Events.TaskStarted({ id: "id", agreementId: "agreementId", activityId: "activityId" });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly("id", "agreementId", "activityId", event.timeStamp);
    });
    it("should handle TaskRedone and call Tasks.retryTask()", async () => {
      const statsService = new StatsService(statServiceOptions);
      await statsService.run();
      const spy = chai.spy.on(statsService.tasks, "retryTask");
      const event = new Events.TaskRedone({ id: "id", retriesCount: 1 });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly("id", 1);
    });
    it("should handle TaskRejected and call Tasks.stopTask()", async () => {
      const statsService = new StatsService(statServiceOptions);
      await statsService.run();
      const spy = chai.spy.on(statsService.tasks, "stopTask");
      const event = new Events.TaskRejected({ id: "id", reason: "reason" });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly("id", event.timeStamp, false, "reason");
    });
    it("should handle TaskFinished and call Tasks.stopTask()", async () => {
      const statsService = new StatsService(statServiceOptions);
      await statsService.run();
      const spy = chai.spy.on(statsService.tasks, "stopTask");
      const event = new Events.TaskFinished({ id: "id", reason: "reason" });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly("id", event.timeStamp, true);
    });
    it("should handle TaskFinished and call Tasks.stopTask()", async () => {
      const statsService = new StatsService(statServiceOptions);
      await statsService.run();
      const spy = chai.spy.on(statsService.tasks, "stopTask");
      const event = new Events.TaskFinished({ id: "id", reason: "reason" });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly("id", event.timeStamp, true);
    });

    // Payments
    it("should handle AllocationCreated and call Payments.addAllocation()", async () => {
      const statsService = new StatsService(statServiceOptions);
      await statsService.run();
      const spy = chai.spy.on(statsService.payments, "addAllocation");
      const event = new Events.AllocationCreated({ id: "id", amount: 100, platform: "platform" });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly({ id: "id", amount: 100, platform: "platform" });
    });
    it("should handle ProposalReceived and call Payments.addProposal()", async () => {
      const statsService = new StatsService(statServiceOptions);
      await statsService.run();
      const spy = chai.spy.on(statsService.payments, "addProposal");
      const event = new Events.ProposalReceived({
        id: "id",
        providerId: "providerId",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly("id", "providerId");
    });
    it("should handle InvoiceReceived and call Payments.addInvoice()", async () => {
      const statsService = new StatsService(statServiceOptions);
      await statsService.run();
      const spy = chai.spy.on(statsService.payments, "addInvoice");
      const event = new Events.InvoiceReceived({
        id: "id",
        providerId: "providerId",
        agreementId: "agreementId",
        amount: "100",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly("id", "providerId", "agreementId", "100");
    });
    it("should handle PaymentAccepted and call Payments.addPayment()", async () => {
      const statsService = new StatsService(statServiceOptions);
      await statsService.run();
      const spy = chai.spy.on(statsService.payments, "addPayment");
      const event = new Events.PaymentAccepted({
        id: "id",
        providerId: "providerId",
        agreementId: "agreementId",
        amount: "100",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly("id", "providerId", "agreementId", "100");
    });
    // Providers
    it("should handle AgreementCreated and call Providers.addPayment()", async () => {
      const statsService = new StatsService(statServiceOptions);
      await statsService.run();
      const spy = chai.spy.on(statsService.providers, "addAgreement");
      const event = new Events.AgreementCreated({
        id: "id",
        providerId: "providerId",
        providerName: "providerName",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly("id", "providerId", "providerName");
    });
    it("should handle AgreementConfirmed and call Providers.confirmAgreement()", async () => {
      const statsService = new StatsService(statServiceOptions);
      await statsService.run();
      const spy = chai.spy.on(statsService.providers, "confirmAgreement");
      const event = new Events.AgreementConfirmed({
        id: "id",
        providerId: "providerId",
      });
      eventTarget.dispatchEvent(event);
      expect(spy).to.have.been.called.with.exactly("id");
    });
  });
});
