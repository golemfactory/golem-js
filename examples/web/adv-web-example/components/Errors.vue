<template>
  <el-scrollbar height="200px">
    <pre class="errors">{{configStore.stderr}}</pre>
  </el-scrollbar>
</template>
<script setup>
import { useConfigStore } from "~/store/config";
const configStore = useConfigStore();
</script>
<style scoped lang="scss">
.errors {
  background: #0d1822;
  color: #dddddd;
  min-height: 200px;
  padding: 10px;
  word-wrap: break-word;
  word-break: break-all;
}
</style>
