import { defineStore } from "pinia";
import { useAgreementsStore } from "~/store/agreements";
const agreementStore = useAgreementsStore();

export const useActivitiesStore = defineStore({
  id: "activities-store",
  state: () => {
    return {
      activities: [],
    };
  },
  actions: {
    addActivity(activity) {
      const agreement = agreementStore.getAgreement(activity.agreementId);
      activity.providerName = agreement.providerName;
      activity.time = new Date(activity.timestamp).toISOString().substring(11, 19);
      activity.scripts = 0;
      this.activities.push(activity);
    },
    updateActivity(activity) {
      const old = this.activities.find((act) => act.id === activity.id);
      Object.assign(old, activity);
    },
    addScript(id) {
      const activity = this.activities.find((act) => act.id === id);
      activity.scripts += 1;
    },
  },
  getters: {
    getActivity: (state) => (id) => state.activities.find((activity) => activity.id === id),
  },
});
