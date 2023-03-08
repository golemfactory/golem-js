<template>
  <el-row :gutter="40">
    <el-col :span="10" style="position: relative">
      <OptionsTask/>
      <el-button class="btn-run" size="small" type="success" @click="run">Run</el-button>
      <ElementsCodeEditor />
      <el-tabs v-model="activeResults" class="results-tabs">
        <el-tab-pane v-loading="loading" label="Output" name="output"><Output /></el-tab-pane>
        <el-tab-pane label="Errors" name="errors"><Errors /></el-tab-pane>
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
</template>

<script setup>
import { TaskExecutor } from "../../../../dist/yajsapi.min.js";
const { $eventTarget: eventTarget, $logger: logger } = useNuxtApp();

import { useConfigStore } from "~/store/config";
const configStore = useConfigStore();

const activeResults = ref("output");
const activeEntity = ref("offers");
const loading = ref(false);

const run = async () => {
  configStore.activeControlActions = false;
  const options = configStore.options;
  loading.value = true;
  const executor = await TaskExecutor.create({ ...options, package: options.imageHash, eventTarget, logger });
  await executor.run(async (ctx) => {
    configStore.stdout += (await ctx.run("/usr/local/bin/node", ["-e", configStore.code])).stdout;
    loading.value = false;
  });
  await executor.end();
};
</script>

<style scoped lang="scss">
.btn-run {
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
