import { defineStore } from "pinia";

export const useProposalsStore = defineStore("proposals", {
  state: () => ({
    proposals: new Map(),
  }),
  actions: {
    add(proposal) {
      this.proposals.set(proposal.id, proposal);
    },
    getById(id) {
      const proposal = this.proposals.get(id);
      if (!proposal) {
        throw new Error(`Proposal ${proposal.id} not found`);
      }
      return proposal;
    },
    async respondById(id) {
      return await useProposalsStore().getById(id).respond();
    },
    async rejectById(id) {
      return await useProposalsStore().getById(id).reject();
    },
  },
});
