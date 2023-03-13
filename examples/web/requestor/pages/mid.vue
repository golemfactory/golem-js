<template>
  <el-row :gutter="40">
    <el-col :span="10" style="position: relative">
      <OptionsMid />
      <ElementsCreateDemandBtn />
      <ElementsCodeEditor />
      <el-tabs v-model="activeResultsTab" class="results-tabs">
        <el-tab-pane v-loading="loading" label="Output" name="output"><Output /></el-tab-pane>
        <el-tab-pane label="Logs" name="logs"><Logs /></el-tab-pane>
      </el-tabs>
    </el-col>
    <el-col :span="14">
      <Steps />
      <el-tabs v-model="activeEntityTab" class="entities-tabs">
        <el-tab-pane label="Demands" name="demand"><Demands /></el-tab-pane>
        <el-tab-pane label="Offers" name="offers"><Offers /></el-tab-pane>
        <el-tab-pane label="Agreements" name="agreements"><Agreements /></el-tab-pane>
        <el-tab-pane label="Activities" name="activities"><Activities /></el-tab-pane>
        <el-tab-pane label="Payments" name="payments"><Payments /></el-tab-pane>
      </el-tabs>
      <Stats />
    </el-col>
  </el-row>
  <Offer/>
  <Demand />
</template>

<script setup>
const { $eventTarget: eventTarget } = useNuxtApp();

import { useConfigStore } from "~/store/config";
const configStore = useConfigStore();
const { stdout, stderr, logs, code } = configStore;

const activeResultsTab = ref("output");
const activeEntityTab = ref("demand");

const loading = ref(false);
configStore.title = ' - Mid-level API';
</script>
<style scoped lang="scss">
.entities-tabs {
  margin-top: 10px;
  margin-bottom: 30px;
}
</style>
