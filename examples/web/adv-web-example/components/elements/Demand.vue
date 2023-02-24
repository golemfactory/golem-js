<template>
  <el-card class="card-box" v-loading="loading">
    <template #header>
      <div class="card-header">
        <span>Demand</span>
        <el-button type="success" @click="createDemand" v-if="!theDemand && isReady">Create Demand</el-button>
      </div>
    </template>
    <p v-if="!isReady">To create demand create allocation and package first</p>
    <p v-else-if="!theDemand">To start receiving proposals create a demand first</p>
    <p v-else>Table will be here {{ JSON.stringify(proposals) }}</p>
  </el-card>
</template>
<script setup>
import { Demand, DemandEventType } from "yajsapi";

const props = defineProps({
  yaTask: Object,
  yaOptions: Object,
});

const loading = ref(false);
const theDemand = ref();
const proposals = ref();
const isReady = computed(() => props.yaTask.package && props.yaTask.allocation);

const createDemand = async () => {
  loading.value = true;

  const demand = await Demand.create(props.yaTask.package, [props.yaTask.allocation], props.yaOptions).catch(
    console.error
  );
  loading.value = false;
  theDemand.value = demand;
  demand.addEventListener(DemandEventType, async (event) => {
    console.log(event.proposal);
    proposals.value.push(event.proposal);
  });
};
</script>
