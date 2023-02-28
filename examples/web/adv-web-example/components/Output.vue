<template>
  <pre class="output">{{output}}</pre>
</template>
<script setup>
defineProps({
  output: String,
})
</script>
<style scoped lang="scss">
.output {
  background: #0d1822;
  color: #dddddd;
  min-height: 200px;
  padding: 10px;
}
.logs {
  font-size: 0.6rem;
}
</style>
