<template>
  <el-steps :active="step" align-center finish-status="success">
    <el-step title="Demand" description="Publish demand on the market" />
    <el-step title="Offer" description="Choose the best offer" />
    <el-step title="Agreement" description="Confirm agreement with provider" />
    <el-step title="Activity" description="Run your scripts" />
    <el-step title="Payment" description="Accept payments" />
  </el-steps>
</template>
<script setup>
import { useStepStore } from "~/store/step";
import { storeToRefs } from "pinia";
const stepStore = useStepStore();
const { step } = storeToRefs(stepStore);
</script>
<style scoped lang="scss">

</style>
