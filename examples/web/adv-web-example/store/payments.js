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
      payment.time = new Date(payment.timestamp).toISOString().substring(11, 19);
      this.payments.push(payment);
    },
    updatePayment(payment) {
      const old = this.payments.find((pay) => pay.id === payment.id);
      Object.assign(old, payment);
    },
  },
});
