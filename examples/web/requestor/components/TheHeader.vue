<template>
  <el-row class="header" fill="true">
    <img class="logo" src="~/assets/img/logo.svg" alt="img" />
    <div class="title lineH-left">JS API Web Requestor {{configStore.title}}</div>
  </el-row>
</template>
<script setup>
import { useConfigStore } from "~/store/config.js";
const configStore = useConfigStore();
</script>
<style>
.el-header {
  background: var(--el-bg-color-overlay);
}
.header {
  height: 100%;
  display: flex;
}
.logo {
  height: 100%;
  box-sizing: border-box;
  padding: 10px;
}
.title {
  height: 100%;
  line-height: 100%;
  display: flex;
  align-items: center;
}

</style>
