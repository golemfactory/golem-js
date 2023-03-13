import { defineStore } from "pinia";

export const useAgreementsStore = defineStore({
  id: "agreements-store",
  state: () => {
    return {
      agreements: [],
    };
  },
  actions: {
    addFromEvent: (event) =>
      useAgreementsStore().add({
        ...event.detail,
        state: "Proposal",
        time: new Date(event.timestamp).toLocaleTimeString(),
        validTo: new Date(event.detail.validTo).toLocaleString(),
      }),
    updateFromEvent: (event, state) =>
      useAgreementsStore().update({
        ...event.detail,
        state,
        time: new Date(event.timestamp).toLocaleTimeString(),
      }),
    add(agreement) {
      this.agreements.push({ ...agreement, isProcessing: false });
    },
    update(agreement) {
      const old = this.agreements.find((agr) => agr.id === agreement.id);
      Object.assign(old, agreement);
    },
    setAgreementStatusById(id, isProcessing = true) {
      const agreement = this.agreements.find((agreement) => agreement.id === id);
      agreement.isProcessing = isProcessing;
    },
  },
  getters: {
    getAgreement: (state) => (id) => state.agreements.find((agreement) => agreement.id === id),
  },
});
