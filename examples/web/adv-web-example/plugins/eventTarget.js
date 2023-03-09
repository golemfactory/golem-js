import { defineNuxtPlugin } from "#app";
import { EventType } from "../../../../dist/yajsapi.min.js";
import { useOffersStore } from "~/store/offers.js";
import { useDemandsStore } from "~/store/demands.js";
import { useAgreementsStore } from "~/store/agreements.js";
import { useActivitiesStore } from "~/store/activities.js";
import { usePaymentsStore } from "~/store/payments.js";
import { useConfigStore } from "~/store/config.js";

export default defineNuxtPlugin((nuxtApp) => {
  const eventTarget = new EventTarget();
  const offersStore = useOffersStore(nuxtApp.$pinia);
  const demandsStore = useDemandsStore(nuxtApp.$pinia);
  const agreementsStore = useAgreementsStore(nuxtApp.$pinia);
  const activitiesStore = useActivitiesStore(nuxtApp.$pinia);
  const paymentsStore = usePaymentsStore(nuxtApp.$pinia);
  const configStore = useConfigStore(nuxtApp.$pinia);

  eventTarget.addEventListener(EventType, (event) => {
    switch (event.name) {
      case "ComputationStarted":
        configStore.currentStep = 0;
        break;
      case "DemandSubscribed":
        configStore.currentStep = 1;
        demandsStore.add(event);
        break;
      case "DemandFailed":
        demandsStore.fail(event);
        break;
      case "DemandUnsubscribed":
        demandsStore.unsubscribe(event);
        break;
      case "ProposalResponded":
        offersStore.setProcessingStatusById(event.detail.id, true);
        break;
      case "ProposalReceived":
        offersStore.addFromEvent(event);
        break;
      case "ProposalRejected":
        offersStore.addFromErrorEvent(event, "Rejected");
        break;
      case "ProposalFailed":
        offersStore.addFromErrorEvent(event, "Failed");
        break;
      case "AgreementCreated":
        offersStore.addFromAgreementEvent(event);
        agreementsStore.addFromEvent(event);
        configStore.currentStep = 2;
        break;
      case "AgreementConfirmed":
        agreementsStore.updateFromEvent(event, "Approved");
        break;
      case "AgreementRejected":
        agreementsStore.updateFromEvent(event, "Rejected");
        break;
      case "AgreementTerminated":
        agreementsStore.updateFromEvent(event, "Terminated");
        break;
      case "AgreementExpired":
        agreementsStore.updateFromEvent(event, "Expired");
        break;
      case "ActivityCreated":
        activitiesStore.addActivity(parseActivityFromEvent(event, "Initialized"));
        configStore.currentStep = 3;
        break;
      case "ActivityStateChanged":
        activitiesStore.updateActivity(parseActivityFromEvent(event));
        break;
      case "ActivityDestroyed":
        activitiesStore.updateActivity(parseActivityFromEvent(event, "Terminated"));
        break;
      case "ScriptSent":
        activitiesStore.startScript(event.detail.activityId);
        break;
      case "ScriptExecuted":
        activitiesStore.stopScript(event.detail.activityId);
        break;
      case "InvoiceReceived":
        paymentsStore.addPayment(parsePaymentsFromEvent(event, "invoice", "Received"));
        break;
      case "DebitNoteReceived":
        paymentsStore.addPayment(parsePaymentsFromEvent(event, "debit-note", "Received"));
        break;
      case "PaymentRejected":
        paymentsStore.updatePayment(parsePaymentsFromEvent(event, "invoice", "Rejected"));
        break;
      case "PaymentAccepted":
        configStore.currentStep = 4;
        paymentsStore.updatePayment(parsePaymentsFromEvent(event, "invoice", "Accepted"));
        break;
      case "DebitNoteAccepted":
        paymentsStore.updatePayment(parsePaymentsFromEvent(event, "debit-note", "Accepted"));
        break;
      case "DebitNoteRejected":
        paymentsStore.updatePayment(parsePaymentsFromEvent(event, "debit-note", "Rejected"));
        break;
      case "ComputationFinished":
        configStore.currentStep = 5;
        offersStore.end();
        break;
    }
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
