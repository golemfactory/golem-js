import { defineStore } from "pinia";
import { useAgreementsStore } from "~/store/agreements";

export const useActivitiesStore = defineStore({
  id: "activities-store",
  state: () => {
    return {
      activities: [],
    };
  },
  actions: {
    addActivity(activity) {
      const agreementStore = useAgreementsStore();
      const agreement = agreementStore.getAgreement(activity.agreementId);
      activity.providerName = agreement.providerName;
      activity.time = new Date(activity.timestamp).toLocaleTimeString();
      activity.scripts = 0;
      activity.duration = 0;
      this.activities.push(activity);
    },
    updateActivity(activity) {
      const old = this.activities.find((act) => act.id === activity.id);
      Object.assign(old, activity);
    },
    startScript(id) {
      const activity = this.activities.find((act) => act.id === id);
      activity.startScript = +new Date() / 1000;
    },
    stopScript(id) {
      const activity = this.activities.find((act) => act.id === id);
      activity.scripts += 1;
      activity.duration += +new Date() / 1000 - activity.startScript;
    },
  },
  getters: {
    totalTime: (state) => Number(state.activities.reduce((t, { duration }) => t + duration, 0)?.toFixed?.(1)),
  },
});
