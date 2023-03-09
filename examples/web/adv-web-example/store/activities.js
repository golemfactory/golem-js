import { defineStore } from "pinia";
import { useAgreementsStore } from "~/store/agreements";

export const useActivitiesStore = defineStore({
  id: "activities-store",
  state: () => {
    return {
      activities: [],
      totalTime: 0,
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
      activity.isProcessing = false;
      this.activities.push(activity);
    },
    updateActivity(activity) {
      const old = this.activities.find((act) => act.id === activity.id);
      Object.assign(old, activity);
    },
    setActivityStatusById(id, isProcessing = true) {
      const activity = this.activities.find((activity) => activity.id === id);
      activity.isProcessing = isProcessing;
    },
    startScript(id) {
      const activity = this.activities.find((act) => act.id === id);
      activity.startScript = +new Date() / 1000;
    },
    stopScript(id) {
      const activity = this.activities.find((act) => act.id === id);
      activity.scripts += 1;
      activity.duration += +new Date() / 1000 - activity.startScript;
      this.totalTime += activity.duration;
    },
  },
  getters: {
    getAgreementsIdsWithActiveActivity() {
      return [
        ...new Set(
          this.activities.filter((activity) => activity.state !== "Terminated").map((activity) => activity.agreementId)
        ),
      ];
    },
  },
});
