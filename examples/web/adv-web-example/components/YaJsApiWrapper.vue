<template>
  <div>Here will be YA JS API wrapper</div>
  <el-button @click="runTask">Run</el-button>
</template>
<script>
import { TaskExecutor } from "yajsapi";

const logger = {
  log: (msg) => appendLog(`[${new Date().toISOString()}] ${msg}`),
  warn: (msg) => appendLog(`[${new Date().toISOString()}] [warn] ${msg}`),
  debug: (msg) => appendLog(`[${new Date().toISOString()}] [debug] ${msg}`),
  error: (msg) => appendLog(`[${new Date().toISOString()}] [error] ${msg}`),
  info: (msg) => appendLog(`[${new Date().toISOString()}] [info] ${msg}`),
  table: (msg) => appendLog(JSON.stringify(msg, null, "\t")),
};

export default {
  methods: {
    async runTask() {
      const executor = await TaskExecutor.create({
        yagnaOptions: {
          apiKey: "30c59fef7d8c4639b62d576bfb624e1a",
          basePath: "http://127.0.0.1:7465",
        },
        package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
        subnetTag: "public",
        logger: console,
      });
      await executor
        .run(async (ctx) => appendResults((await ctx.run("echo 'Hello World'")).stdout))
        .catch((e) => logger.error(e));
      await executor.end();
    },
  },
};
</script>
