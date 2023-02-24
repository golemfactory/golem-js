<template>
  <h1>Advanced JaYaApi</h1>
  <el-row>
    <el-col :span="16" :offset="4">
      <MidApiExample :yaJsEventTarget="yaJsEventTarget" :logger="logger" />
      <StatsWrapper :yaJsEventTarget="yaJsEventTarget" :logger="logger" />
    </el-col>
  </el-row>
</template>
<script setup>
const yaJsEventTarget = new EventTarget();
const appendLog = () => {}; //console.log;

const logger = {
  log: (msg) => appendLog(`[${new Date().toISOString()}] ${msg}`),
  warn: (msg) => appendLog(`[${new Date().toISOString()}] [warn] ${msg}`),
  debug: (msg) => appendLog(`[${new Date().toISOString()}] [debug] ${msg}`),
  error: (msg) => appendLog(`[${new Date().toISOString()}] [error] ${msg}`),
  info: (msg) => appendLog(`[${new Date().toISOString()}] [info] ${msg}`),
  table: (msg) => appendLog(JSON.stringify(msg, null, "\t")),
};
</script>
