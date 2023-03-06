import { defineStore } from "pinia";

export const useStepStore = defineStore({
  id: "step-store",
  state: () => {
    return {
      step: [],
    };
  },
  actions: {
    setStep(value) {
      this.step = value;
    },
  },
});
