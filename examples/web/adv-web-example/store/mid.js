import { defineStore } from "pinia";
import {
  Script as yaScript,
  Deploy as yaDeploy,
  Start as yaStart,
  Run as yaRun,
} from "../../../../dist/yajsapi.min.js";
import { useDemandStore } from "~/store/demand";

const sleep = (time, inMs = false) => new Promise((resolve) => setTimeout(resolve, time * (inMs ? 1 : 1000)));

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
    async monitorActivity(id, timeoutTime = 10000) {
      const activity = this.getActivityById(id);
      let state = activity.state;
      let timeout = false;
      const timeoutId = setTimeout(() => (timeout = true), timeoutTime);
      while (state !== "Ready" && !timeout) {
        await sleep(1000, true);
        state = await activity.getState();
        console.log(state);
      }
      clearTimeout(timeoutId);
    },
    async deployActivity(id) {
      const activity = this.getActivityById(id);
      const script = await yaScript.create([new yaDeploy()]);
      const exeScript = script.getExeScriptRequest();
      await activity.execute(exeScript).catch(console.error);
      await this.monitorActivity(id);
    },
    async startActivity(id) {
      const activity = this.getActivityById(id);
      const script = await yaScript.create([new yaStart()]);
      const exeScript = script.getExeScriptRequest();
      await activity.execute(exeScript).catch(console.error);
      await this.monitorActivity(id);
    },
    async runScript(id, command) {
      const activity = this.getActivityById(id);
      const script = await yaScript.create([new yaRun("/bin/sh", ["-c", command])]);
      const exeScript = script.getExeScriptRequest();
      const results = await activity.execute(exeScript).catch(console.error);
      console.log(results);
      await this.monitorActivity(id);
    },
  },
});
