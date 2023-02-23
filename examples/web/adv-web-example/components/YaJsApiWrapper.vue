<template>
  <div>Here will be YA JS API wrapper</div>
  <TaskExecutorApiExample :yaJsEventTarget="yaJsEventTarget" :logger="logger" />
  <StatsWrapper :yaJsEventTarget="yaJsEventTarget" :logger="logger" />
</template>
<script setup>
const yaJsEventTarget = new EventTarget();

const appendLog = console.log;

const logger = {
  log: (msg) => appendLog(`[${new Date().toISOString()}] ${msg}`),
  warn: (msg) => appendLog(`[${new Date().toISOString()}] [warn] ${msg}`),
  debug: (msg) => appendLog(`[${new Date().toISOString()}] [debug] ${msg}`),
  error: (msg) => appendLog(`[${new Date().toISOString()}] [error] ${msg}`),
  info: (msg) => appendLog(`[${new Date().toISOString()}] [info] ${msg}`),
  table: (msg) => appendLog(JSON.stringify(msg, null, "\t")),
};
</script>
