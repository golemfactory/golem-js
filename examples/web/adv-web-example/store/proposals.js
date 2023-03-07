import { defineStore } from "pinia";
import { useDemandStore } from "~/store/demand";

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
      if (!proposal) throw new Error(`Proposal ${id} not found`);
      return proposal;
    },
    async respondById(id) {
      const demandStore = useDemandStore();
      return await this.getById(id).respond(demandStore.account);
    },
    async rejectById(id) {
      return await this.getById(id).reject();
    },
  },
});
