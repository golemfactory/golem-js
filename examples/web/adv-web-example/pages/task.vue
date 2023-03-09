<template>
  <el-row :gutter="40">
    <el-col :span="10" style="position: relative">
      <OptionsTask/>
      <el-button class="btn-start" size="small" type="warning" :disabled="isRunning" @click="start">Start</el-button>
      <el-button class="btn-run" size="small" type="success" :disabled="!isRunning"  @click="run">Run</el-button>
      <el-button class="btn-stop" size="small" type="danger" :disabled="!isRunning"  @click="stop">Stop</el-button>
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

import { useConfigStore } from "~/store/config";
const configStore = useConfigStore();

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
  isRunning.value =false;
}
</script>

<style scoped lang="scss">
.btn-start {
  position: absolute;
  right: 136px;
  margin-top: 10px;
  z-index: 999;
}
.btn-run {
  position: absolute;
  right: 80px;
  margin-top: 10px;
  z-index: 999;
}
.btn-stop {
  position: absolute;
  right: 20px;
  margin-top: 10px;
  z-index: 999;
}
.entities-tabs {
  margin-top: 10px;
  margin-bottom: 30px;
}
</style>
