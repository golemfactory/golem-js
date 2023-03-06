import { defineStore } from "pinia";

export const useStepStore = defineStore({
  id: "step-store",
  state: () => {
    return {
      step: null,
    };
  },
  actions: {
    setStep(value) {
      this.step = value;
    },
  },
});
