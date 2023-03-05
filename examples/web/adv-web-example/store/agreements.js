import { defineStore } from "pinia";

export const useAgreementsStore = defineStore({
  id: "agreements-store",
  state: () => {
    return {
      agreements: [],
    };
  },
  actions: {
    addAgreement(agreement) {
      agreement.time = new Date(agreement.timestamp).toISOString().substring(11, 19);
      this.agreements.push(agreement);
    },
    updateAgreement(agreement) {
      const old = this.agreements.find((agr) => agr.id === agreement.id);
      Object.assign(old, agreement);
    },
  },
  getters: {
    getAgreement: (state) => (id) => state.agreements.find((agreement) => agreement.id === id),
  },
});
