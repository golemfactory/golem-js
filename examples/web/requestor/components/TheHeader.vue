<template>
  <el-row class="header" fill="true">
    <div class="header-left">
      <img class="logo" src="~/assets/img/logo.svg" alt="img" />
      <div class="title lineH-left">JS API Web Requestor {{ configStore.title }}</div>
    </div>
    <div class="mode">
      <el-button circle @click="mode = mode === 'dark' ? 'light' : 'dark'">
        <el-icon><Sunny /></el-icon>
      </el-button>
    </div>
  </el-row>
</template>
<script setup>
import { useConfigStore } from "~/store/config.js";
import { useColorMode } from "@vueuse/core";
import { Sunny } from "@element-plus/icons-vue";
const configStore = useConfigStore();
const mode = useColorMode();
mode.value = "dark";
</script>
<style>
.el-header {
  background: var(--el-bg-color-overlay);
}
.header,
.header-left {
  height: 100%;
  display: flex;
  justify-content: space-between;
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
.mode {
  height: 100%;
  line-height: 100%;
  display: flex;
  align-items: center;
}
</style>
