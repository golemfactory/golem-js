import { defineStore } from "pinia";
import {
  Script as YaScript,
  Deploy as YaDeploy,
  Start as YaStart,
  Run as YaRun,
} from "../../../../dist/yajsapi.min.js";
import { useDemandStore } from "~/store/demand";

const sleep = (time, inMs = false) => new Promise((resolve) => setTimeout(resolve, time * (inMs ? 1 : 1000)));

export const useMidLevelStore = defineStore("mid-level", {
  state: () => ({
    proposals: new Map(),
    agreements: new Map(),
    activities: new Map(),
    notes: new Map(),
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
    async monitorActivity(id, expectedState, timeoutTime = 10000) {
      const activity = this.getActivityById(id);
      let state = await activity.getState();
      console.log(`monitorActivity`, state);
      let timeout = false;
      const timeoutId = setTimeout(() => (timeout = true), timeoutTime);
      while (state !== expectedState && !timeout) {
        console.log(`monitorActivity`, state);
        await sleep(1000, true);
        state = await activity.getState();
      }
      clearTimeout(timeoutId);
      return state;
    },
    async deployActivity(id) {
      const activity = this.getActivityById(id);
      const script = await YaScript.create([new YaDeploy()]);
      const exeScript = script.getExeScriptRequest();
      await activity.execute(exeScript).catch(console.error);
      await this.monitorActivity(id, "Deployed");
    },
    async startActivity(id) {
      const activity = this.getActivityById(id);
      const script = await YaScript.create([new YaStart()]);
      const exeScript = script.getExeScriptRequest();
      await activity.execute(exeScript).catch(console.error);
      await this.monitorActivity(id, "Ready");
    },
    async stopActivity(id) {
      const activity = this.getActivityById(id);
      await activity.stop().catch(console.error);
      await this.monitorActivity(id, "Terminated");
    },
    async runScript(id, command) {
      const activity = this.getActivityById(id);
      const script = await YaScript.create([new YaRun("/usr/local/bin/node", ["-e", command])]);
      const exeScript = script.getExeScriptRequest();
      const results = await activity.execute(exeScript);
      const allResults = [];
      for await (const result of results) allResults.push(result);
      const commandsErrors = allResults.filter((res) => res.result === "Error");
      if (commandsErrors.length) {
        const errorMessage = commandsErrors
          .map((err) => `Error: ${err.message}. Stdout: ${err.stdout?.trim()}. Stderr: ${err.stderr?.trim()}`)
          .join(". ");
        throw new Error(errorMessage);
      }
      return allResults[0];
    },
    addNote(note) {
      this.notes.set(note.id, note);
    },
    getNoteById(id) {
      const note = this.notes.get(id);
      if (!note) throw new Error(`Note ${id} not found`);
      return note;
    },
    async confirmNoteById(id) {
      const note = this.getNoteById(id);
      console.log(note);
      await note.accept();
    },
    async rejectNoteById(id) {
      const note = this.getNoteById(id);
      await note.reject();
    },
  },
});
