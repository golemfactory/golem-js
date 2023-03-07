<template>
  <el-row :gutter="40">
    <el-col :span="10" style="position: relative">
      <Options />
      <ElementsCreateDemandBtn />
      <ElementsCodeEditor />
      <el-tabs v-model="activeResultsTab" class="results-tabs">
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
      <el-tabs v-model="activeEntityTab" class="entities-tabs">
        <el-tab-pane label="Demands" name="demands"></el-tab-pane>
        <el-tab-pane label="Offers" name="offers"><Offers :actions="true" /></el-tab-pane>
        <el-tab-pane label="Agreements" name="agreements"><Agreements :actions="true" /></el-tab-pane>
        <el-tab-pane label="Activities" name="activities"><Activities :actions="true" /></el-tab-pane>
        <el-tab-pane label="Payments" name="payments"><Payments :actions="true" /></el-tab-pane>
      </el-tabs>
      <Stats />
    </el-col>
  </el-row>
  <Offer offer-drawer="offerDrawer" offer="offer" />
</template>

<script setup>
const { $eventTarget: eventTarget } = useNuxtApp();

import { useConfigStore } from "~/store/config";
const configStore = useConfigStore();
const { stdout, stderr, logs, code } = configStore;

const activeResultsTab = ref("output");
const activeEntityTab = ref("offers");

const loading = ref(false);

let platform;
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
