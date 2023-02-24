<template>
  <div>Here will be YA JS API wrapper</div>
  <el-row>
    <el-col :span="8">
      <TaskExecutorApiExample :yaJsEventTarget="yaJsEventTarget" :logger="logger" />
    </el-col>
    <el-col :span="16">
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
