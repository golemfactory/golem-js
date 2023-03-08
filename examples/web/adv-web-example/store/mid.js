import { defineStore } from "pinia";
import { useDemandStore } from "~/store/demand";

export const useMidLevelStore = defineStore("mid-level", {
  state: () => ({
    proposals: new Map(),
    agreements: new Map(),
    activities: new Map(),
  }),
  actions: {
    addProposal(proposal) {
      this.proposals.set(proposal.id, proposal);
    },
    getProposalById(id) {
      const proposal = this.proposals.get(id);
      if (!proposal) throw new Error(`Proposal ${id} not found`);
      return proposal;
    },
    async respondProposalById(id) {
      const demandStore = useDemandStore();
      return await this.getProposalById(id).respond(demandStore.account);
    },
    async rejectProposalById(id) {
      return await this.getProposalById(id).reject();
    },
    addAgreement(agreement) {
      this.agreements.set(agreement.id, agreement);
    },
    getAgreementById(id) {
      const agreement = this.agreements.get(id);
      if (!agreement) throw new Error(`Agreement ${id} not found`);
      return agreement;
    },
    async confirmAgreementById(id) {
      return await this.getAgreementById(id).confirm();
    },
    async terminateAgreementById(id) {
      return await this.getAgreementById(id).terminate();
    },
    addActivity(activity) {
      this.activities.set(activity.id, activity);
    },
    getActivityById(id) {
      const activity = this.activities.get(id);
      if (!activity) throw new Error(`Activity ${id} not found`);
      return activity;
    },
  },
});
