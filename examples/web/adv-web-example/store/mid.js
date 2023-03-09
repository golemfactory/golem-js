import { defineStore } from "pinia";
import {
  Script as YaScript,
  Deploy as YaDeploy,
  Start as YaStart,
  Run as YaRun,
  DebitNote,
  Activity as YaActivity,
  Agreement as YaAgreement,
} from "../../../../dist/yajsapi.min.js";
import { useAgreementsStore } from "~/store/agreements";
import { useConfigStore } from "~/store/config";
import { useActivitiesStore } from "~/store/activities";
import { usePaymentsStore } from "~/store/payments";

const sleep = (time, inMs = false) => new Promise((resolve) => setTimeout(resolve, time * (inMs ? 1 : 1000)));

export const useMidLevelStore = defineStore("mid-level", {
  state: () => ({
    allocation: null,
    demand: null,
    taskPackage: null,
    account: null,
    allocationId: null,
    payments: null,
    proposals: new Map(),
    agreements: new Map(),
    activities: new Map(),
    notes: new Map(),
    options: null,
    isRunning: false,
  }),
  actions: {
    async unsubscribeDemand() {
      await this.demand?.unsubscribe();
      setTimeout(async () => {
        this.allocation.release();
        this.payments.unsubscribe();
      }, 3000);
      this.isRunning = false;
    },
    addProposal(proposal) {
      this.proposals.set(proposal.id, proposal);
    },
    getProposalById(id) {
      const proposal = this.proposals.get(id);
      if (!proposal) throw new Error(`Proposal ${id} not found`);
      return proposal;
    },
    async respondProposalById(id) {
      return await this.getProposalById(id).respond(this.account);
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
    async createAgreementForProposal(id) {
      const agreement = await YaAgreement.create(id, this.options);
      this.addAgreement(agreement);
    },
    async confirmAgreementById(id) {
      useAgreementsStore().setAgreementStatusById(id, true);
      try {
        const result = await this.getAgreementById(id).confirm();
        useAgreementsStore().setAgreementStatusById(id, false);
        return result;
      } catch (e) {
        useAgreementsStore().setAgreementStatusById(id, false);
        throw e;
      }
    },
    async terminateAgreementById(id) {
      useAgreementsStore().setAgreementStatusById(id, true);
      try {
        const result = await this.getAgreementById(id).terminate();
        useAgreementsStore().setAgreementStatusById(id, false);
        return result;
      } catch (e) {
        useAgreementsStore().setAgreementStatusById(id, false);
        throw e;
      }
    },
    async createActivityFromAgreement(id) {
      useAgreementsStore().setAgreementStatusById(id, true);
      try {
        const activity = await YaActivity.create(id, this.options);
        await this.addActivity(activity);
        useAgreementsStore().setAgreementStatusById(id, false);
      } catch (e) {
        useAgreementsStore().setAgreementStatusById(id, false);
        throw e;
      }
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
      let timeout = false;
      const timeoutId = setTimeout(() => (timeout = true), timeoutTime);
      while (state !== expectedState && !timeout) {
        await sleep(1000, true);
        state = await activity.getState();
      }
      clearTimeout(timeoutId);
      return state;
    },
    async deployActivity(id) {
      useActivitiesStore().setActivityStatusById(id, true);
      try {
        const activity = this.getActivityById(id);
        const script = await YaScript.create([new YaDeploy()]);
        const exeScript = script.getExeScriptRequest();
        await activity.execute(exeScript).catch(console.error);
        await this.monitorActivity(id, "Deployed");
        useActivitiesStore().setActivityStatusById(id, false);
      } catch (e) {
        useActivitiesStore().setActivityStatusById(id, false);
        throw e;
      }
    },
    async startActivity(id) {
      useActivitiesStore().setActivityStatusById(id, true);
      try {
        const activity = this.getActivityById(id);
        const script = await YaScript.create([new YaStart()]);
        const exeScript = script.getExeScriptRequest();
        await activity.execute(exeScript).catch(console.error);
        await this.monitorActivity(id, "Ready");
        useActivitiesStore().setActivityStatusById(id, false);
      } catch (e) {
        useActivitiesStore().setActivityStatusById(id, false);
        throw e;
      }
    },
    async stopActivity(id) {
      useActivitiesStore().setActivityStatusById(id, true);
      try {
        useActivitiesStore().setActivityStatusById(id, true);
        const activity = this.getActivityById(id);
        await activity.stop().catch(console.error);
        await this.monitorActivity(id, "Terminated");
        useActivitiesStore().setActivityStatusById(id, false);
      } catch (e) {
        useActivitiesStore().setActivityStatusById(id, false);
        throw e;
      }
    },
    async runScript(id) {
      useActivitiesStore().setActivityStatusById(id, true);
      try {
        const configStore = useConfigStore();
        const command = configStore.command(),
          arg = configStore.commandArg(),
          code = configStore.code;

        const activity = this.getActivityById(id);
        const script = await YaScript.create([new YaRun(command, [arg, code])]);
        const exeScript = script.getExeScriptRequest();
        const results = await activity.execute(exeScript);
        const allResults = [];
        for await (const result of results) allResults.push(result);
        const result = allResults[0];

        if (result.stdout) configStore.stdout += result.stdout;
        if (result.stderr) configStore.stdout += result.stderr;

        useActivitiesStore().setActivityStatusById(id, false);
        return result;
      } catch (e) {
        useActivitiesStore().setActivityStatusById(id, false);
        throw e;
      }
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
      usePaymentsStore().setPaymentStatusById(id, true);
      try {
        const note = this.getNoteById(id);
        const amountDue = note instanceof DebitNote ? note.totalAmountDue : note.amount;
        await note.accept(amountDue, this.allocationId);
        usePaymentsStore().setPaymentStatusById(id, false);
      } catch (e) {
        usePaymentsStore().setPaymentStatusById(id, false);
        throw e;
      }
    },
    async rejectNoteById(id) {
      usePaymentsStore().setPaymentStatusById(id, true);
      try {
        const note = this.getNoteById(id);
        await note.reject({
          rejectionReason: "BAD_SERVICE",
          totalAmountAccepted: "0",
        });
      } catch (e) {
        usePaymentsStore().setPaymentStatusById(id, false);
        throw e;
      }
    },
  },
});
