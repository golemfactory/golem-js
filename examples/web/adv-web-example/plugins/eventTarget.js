import { defineNuxtPlugin } from "#app";
import { EventType } from "../../../../dist/yajsapi.min.js";
import { useOffersStore } from "~/store/offers.js";
import { useAgreementsStore } from "~/store/agreements.js";
import { useActivitiesStore } from "~/store/activities.js";
import { usePaymentsStore } from "~/store/payments.js";
import { useStepStore } from "~/store/step.js";

export default defineNuxtPlugin((nuxtApp) => {
  const eventTarget = new EventTarget();
  const offersStore = useOffersStore(nuxtApp.$pinia);
  const agreementsStore = useAgreementsStore(nuxtApp.$pinia);
  const activitiesStore = useActivitiesStore(nuxtApp.$pinia);
  const paymentsStore = usePaymentsStore(nuxtApp.$pinia);
  const stepStore = useStepStore(nuxtApp.$pinia);
  const { addOffer } = offersStore;
  const { addAgreement, updateAgreement } = agreementsStore;
  const { addActivity, updateActivity, startScript, stopScript } = activitiesStore;
  const { addPayment, updatePayment } = paymentsStore;
  const { setStep } = stepStore;
  eventTarget.addEventListener(EventType, (event) => {
    if (event.name === "ComputationStarted") setStep(0);
    else if (event.name === "SubscriptionCreated") setStep(1);
    else if (event.name === "ProposalReceived") addOffer(parseOfferFromEvent(event));
    else if (event.name === "ProposalRejected") addOffer(parseOfferFromErrorEvent(event, "Rejected"));
    else if (event.name === "ProposalFailed") addOffer(parseOfferFromErrorEvent(event, "Failed"));
    else if (event.name === "AgreementCreated") {
      addOffer(parseOfferFormAgreementEvent(event));
      addAgreement(parseAgreementFromEvent(event, "Proposal"));
      setStep(2);
    } else if (event.name === "AgreementConfirmed") updateAgreement(parseAgreementFromEvent(event, "Approved"));
    else if (event.name === "AgreementTerminated") updateAgreement(parseAgreementFromEvent(event, "Terminated"));
    else if (event.name === "ActivityCreated") {
      addActivity(parseActivityFromEvent(event, "New"));
      setStep(3);
    } else if (event.name === "ActivityStateChanged") updateActivity(parseActivityFromEvent(event));
    else if (event.name === "ScriptSent") startScript(event.detail.activityId);
    else if (event.name === "ScriptExecuted") stopScript(event.detail.activityId);
    else if (event.name === "ActivityDestroyed") updateActivity(parseActivityFromEvent(event, "Terminated"));
    else if (event.name === "InvoiceReceived") addPayment(parsePaymentsFromEvent(event, "invoice", "Received"));
    else if (event.name === "DebitNoteReceived") addPayment(parsePaymentsFromEvent(event, "debit-note", "Received"));
    else if (event.name === "PaymentAccepted") {
      setStep(4);
      updatePayment(parsePaymentsFromEvent(event, "invoice", "Accepted"));
    } else if (event.name === "DebitNoteAccepted")
      updatePayment(parsePaymentsFromEvent(event, "debit-note", "Accepted"));
    else if (event.name === "PaymentRejected") updatePayment(parsePaymentsFromEvent(event, "invoice", "Rejected"));
    else if (event.name === "DebitNoteRejected") updatePayment(parsePaymentsFromEvent(event, "debit-note", "Rejected"));
    else if (event.name === "ComputationFinished") setStep(5);
  });

  const parseOfferFromEvent = (event) => ({
    ...event.detail,
    ...event.detail.details,
    detail: undefined,
    timestamp: event.timestamp,
  });
  const parseOfferFromErrorEvent = (event, state) => ({
    ...event.detail,
    ...event.detail.details,
    timestamp: event.timestamp,
    state,
  });
  const parseOfferFormAgreementEvent = (event) => ({
    timestamp: event.timestamp,
    parentId: event.detail.proposalId,
    state: "Confirmed",
  });
  const parseAgreementFromEvent = (event, state) => ({
    ...event.detail,
    state,
    timestamp: event.timestamp,
  });
  const parseActivityFromEvent = (event, state) => ({
    state,
    ...event.detail,
    timestamp: event.timestamp,
  });
  const parsePaymentsFromEvent = (event, type, state) => ({
    type,
    state,
    ...event.detail,
    timestamp: event.timestamp,
  });
  return {
    provide: {
      eventTarget,
    },
  };
});
