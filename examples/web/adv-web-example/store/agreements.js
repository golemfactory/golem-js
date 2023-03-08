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
      this.agreements.push(agreement);
    },
    update(agreement) {
      const old = this.agreements.find((agr) => agr.id === agreement.id);
      Object.assign(old, agreement);
    },
    confirmAgreement() {
      // todo
    },
    rejectAgreement() {
      // todo
    },
    updateAgreement() {
      // todo
    },
  },
  getters: {
    getAgreement: (state) => (id) => state.agreements.find((agreement) => agreement.id === id),
  },
});
