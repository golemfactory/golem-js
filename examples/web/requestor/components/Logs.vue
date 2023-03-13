<template>
  <el-scrollbar height="220px">
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
  word-break: break-all;
  font-size: 0.7rem;
  white-space: pre-wrap;       /* css-3 */
  white-space: -moz-pre-wrap;  /* Mozilla, since 1999 */
  white-space: -pre-wrap;      /* Opera 4-6 */
  white-space: -o-pre-wrap;    /* Opera 7 */
  word-wrap: break-word;
}
</style>
