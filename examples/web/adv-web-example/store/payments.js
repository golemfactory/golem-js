import { defineStore } from "pinia";
import { useAgreementsStore } from "~/store/agreements";
const agreementStore = useAgreementsStore();

export const usePaymentsStore = defineStore({
  id: "payments-store",
  state: () => {
    return {
      payments: [],
    };
  },
  actions: {
    addPayment(payment) {
      const agreement = agreementStore.getAgreement(payment.agreementId);
      payment.providerName = agreement.providerName;
      payment.amount = Number(payment.amount);
      payment.time = new Date(payment.timestamp).toLocaleTimeString();
      this.payments.push(payment);
    },
    updatePayment(payment) {
      const old = this.payments.find((pay) => pay.id === payment.id);
      old.amount = Number(old.amount);
      Object.assign(old, payment);
    },
  },
  getters: {
    totalCost: (state) =>
      Number(
        state.payments
          .filter((pay) => pay.type === "invoice")
          .reduce((t, { amount }) => t + amount, 0)
          ?.toFixed(8)
      ),
  },
});
