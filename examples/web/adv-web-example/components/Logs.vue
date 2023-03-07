<template>
  <el-scrollbar height="200px">
    <pre class="logs">{{configStore.logs}}</pre>
  </el-scrollbar>
</template>
<script setup>
import { useConfigStore } from "~/store/config";
const configStore = useConfigStore();
</script>
<style scoped lang="scss">
.logs {
  background: #0d1822;
  color: #dddddd;
  min-height: 200px;
  padding: 10px;
  word-wrap: break-word;
  word-break: break-all;
  font-size: 0.6rem;
}
</style>
