<template>
  <el-row :gutter="40">
    <el-col :span="10" style="position: relative">
      <Options />
      <el-button class="btn-run" size="small" type="success" @click="run">Run</el-button>

      <ElementsCodeEditor />

      <el-tabs v-model="activeResults" class="results-tabs">
        <el-tab-pane v-loading="loading" label="Output" name="output">
          <Output :output="stdout"></Output>
        </el-tab-pane>
        <el-tab-pane label="Errors" name="errors">
          <Output :output="stderr"></Output>
        </el-tab-pane>
        <el-tab-pane label="Logs" name="logs">
          <Output :output="logs" class="logs"></Output>
        </el-tab-pane>
      </el-tabs>
    </el-col>
    <el-col :span="14">
      <Steps />
      <el-tabs v-model="activeEntity" class="entities-tabs">
        <el-tab-pane label="Offers" name="offers"><Offers /></el-tab-pane>
        <el-tab-pane label="Agreements" name="agreements"><Agreements /></el-tab-pane>
        <el-tab-pane label="Activities" name="activities"><Activities /></el-tab-pane>
        <el-tab-pane label="Payments" name="payments"><Payments /></el-tab-pane>
      </el-tabs>
      <Stats />
    </el-col>
  </el-row>
  <Offer offer-drawer="offerDrawer" offer="offer" />
</template>

<script setup>
import { TaskExecutor } from "../../../../dist/yajsapi.min.js";
const { $eventTarget: eventTarget, $logger: logger } = useNuxtApp();

import { useConfigStore } from "~/store/config";
const configStore = useConfigStore();
const { stdout, stderr, logs, code } = configStore;

const activeResults = ref("output");
const activeEntity = ref("offers");

const loading = ref(false);

const run = async () => {
  configStore.activeControlActions = false;

  const options = configStore.options;
  loading.value = true;
  const executor = await TaskExecutor.create({ ...options, eventTarget, logger: console });
  await executor.run(async (ctx) => {
    loading.value = false;
    stdout.value += (await ctx.run("/usr/local/bin/node", ["-e", code])).stdout;
  });
  await executor.end();
};
</script>

<style scoped lang="scss">
.btn-run {
  position: absolute;
  right: 0;
  margin-top: 10px;
  z-index: 999;
}
.entities-tabs {
  margin-top: 10px;
  margin-bottom: 30px;
}
</style>
