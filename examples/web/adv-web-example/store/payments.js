import { defineStore } from "pinia";
import { useAgreementsStore } from "~/store/agreements";

export const usePaymentsStore = defineStore({
  id: "payments-store",
  state: () => {
    return {
      payments: new Map(),
    };
  },
  actions: {
    addPayment(payment) {
      const agreementStore = useAgreementsStore();
      const agreement = agreementStore.getAgreement(payment.agreementId);
      payment.providerName = agreement.providerName;
      payment.amount = Number(payment.amount);
      payment.time = new Date(payment.timestamp).toLocaleTimeString();
      this.payments.set(payment.id, payment);
    },
    getById(id) {
      const payment = usePaymentsStore().payments.get(id);
      if (!payment) throw new Error(`Payment ${id} not found`);
      return payment;
    },
    updatePayment(payment) {
      const old = this.getById(payment.id);
      old.amount = Number(old.amount);
      Object.assign(old, payment);
    },
  },
  getters: {
    getAll: (state) => Array.from(state.payments.values()),
    totalCost: (state) =>
      Number(
        Array.from(state.payments.values())
          .filter((pay) => pay.type === "invoice")
          .reduce((t, { amount }) => t + amount, 0)
          ?.toFixed(8)
      ),
  },
});
