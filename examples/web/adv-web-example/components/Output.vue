<template>
  <el-scrollbar height="200px">
    <pre class="output">{{output}}</pre>
  </el-scrollbar>
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
  word-wrap: break-word;
  word-break: break-all;
}
.logs {
  font-size: 0.6rem;
}
</style>
