<template>
  <el-steps :active="currentStep" align-center finish-status="success">
    <el-step title="Demand" description="Publish demand on the market" />
    <el-step title="Offer" description="Choose the best offer" />
    <el-step title="Agreement" description="Confirm agreement with provider" />
    <el-step title="Activity" description="Run your scripts" />
    <el-step title="Payment" description="Accept payments" />
  </el-steps>
</template>
<script setup>
import { useConfigStore } from "~/store/config";
const { currentStep } = useConfigStore();
</script>
<style scoped lang="scss"></style>
