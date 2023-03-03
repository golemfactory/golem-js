<template>
  <el-steps :active="currentStep" align-center finish-status="success">
    <el-step title="Demand" description="Publish demand on the market" />
    <el-step title="Offer" description="Choose best offer" />
    <el-step title="Agreement" description="Confirm agreement with provider" />
    <el-step title="Activity" description="Run your scripts" />
    <el-step title="Payment" description="Accept payments" />
  </el-steps>
</template>
<script setup>
const currentStep = ref(null);
const props = defineProps({
  step: String
});
watch(() => props.step, (step) => {
  if (step === 'demand') currentStep.value = 0;
  else if (step === 'offer') currentStep.value = 1;
  else if (step === 'agreement') currentStep.value = 2;
  else if (step === 'activity') currentStep.value = 3;
  else if (step === 'payment') currentStep.value = 4;
  else if (step === 'end') currentStep.value = 5;
});

</script>
<style scoped lang="scss">

</style>
