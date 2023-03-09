<template>
  <el-row :gutter="40">
    <el-col :span="10" style="position: relative">
      <OptionsTask />
      <div class="btn-holders">
        <el-button class="btn-reset" size="small" type="warning" :disabled="isRunning" @click="resetAll">
          Reset
        </el-button>
        <el-button class="btn-start" size="small" type="warning" :disabled="isRunning" @click="start">Start</el-button>
        <el-button class="btn-run" size="small" type="success" :disabled="!isRunning" @click="run">Run</el-button>
        <el-button class="btn-stop" size="small" type="danger" :disabled="!isRunning" @click="stop">Stop</el-button>
      </div>
      <ElementsCodeEditor />
      <el-tabs v-model="activeResults" class="results-tabs">
        <el-tab-pane label="Output" name="output"><Output /></el-tab-pane>
        <el-tab-pane label="Logs" name="logs"><Logs /></el-tab-pane>
      </el-tabs>
    </el-col>
    <el-col :span="14">
      <Steps />
      <el-tabs v-model="activeEntity" class="entities-tabs">
        <el-tab-pane label="Demands" name="demands"><Demands /></el-tab-pane>
        <el-tab-pane label="Offers" name="offers"><Offers /></el-tab-pane>
        <el-tab-pane label="Agreements" name="agreements"><Agreements /></el-tab-pane>
        <el-tab-pane label="Activities" name="activities"><Activities /></el-tab-pane>
        <el-tab-pane label="Payments" name="payments"><Payments /></el-tab-pane>
      </el-tabs>
      <Stats />
    </el-col>
  </el-row>
  <Offer />
  <Demand />
</template>

<script setup>
import { TaskExecutor } from "../../../../dist/yajsapi.min.js";
const { $eventTarget: eventTarget, $logger: logger } = useNuxtApp();

import { useActivitiesStore } from "~/store/activities";
import { useAgreementsStore } from "~/store/agreements";
import { useConfigStore } from "~/store/config";
import { useDemandsStore } from "~/store/demands";
import { useMidLevelStore } from "~/store/mid";
import { useOffersStore } from "~/store/offers";
import { usePaymentsStore } from "~/store/payments";

const activitiesLevelStore = useActivitiesStore();
const agreementsLevelStore = useAgreementsStore();
const configStore = useConfigStore();
const demandsStore = useDemandsStore();
const midLevelStore = useMidLevelStore();
const offersStore = useOffersStore();
const paymentsStore = usePaymentsStore();

const activeResults = ref("output");
const activeEntity = ref("offers");
const isRunning = ref(false);
let executor;
configStore.title = ' - Task API';

const start = async () => {
  configStore.activeControlActions = false;
  const options = configStore.options;
  executor = await TaskExecutor.create({ ...options, package: options.imageHash, eventTarget, logger });
  isRunning.value = true;
}
const run = async () => {
  configStore.stdoutLoading = true;
  await executor.run(async (ctx) => {
    const result = await ctx.run(configStore.command(), [configStore.commandArg(), configStore.code]);
    if (result.stdout) configStore.stdout += result.stdout;
    if (result.stderr) configStore.stdout += result.stderr;
    configStore.stdoutLoading = false;
  }).catch(e => {
    isRunning.value = false;
    throw e;
  });
  configStore.stdoutLoading = false;
};
const stop = async () => {
  await executor.end();
  isRunning.value = false;
};
const resetAll = () => {
  activitiesLevelStore.$reset();
  agreementsLevelStore.$reset();
  configStore.$reset();
  demandsStore.$reset();
  midLevelStore.$reset();
  offersStore.$reset();
  paymentsStore.$reset();
};
</script>
<style scoped lang="scss">
.btn-holders {
  position: absolute;
  right: 20px;
  margin-top: 10px;
  z-index: 999;
}
.btn-start {
}
.btn-run {
}
.btn-stop {
}
.entities-tabs {
  margin-top: 10px;
  margin-bottom: 30px;
}
</style>
