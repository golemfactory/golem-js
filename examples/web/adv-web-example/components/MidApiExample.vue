<template>
  <div>
    <h2>Mid API Example</h2>
    <ElementsPackage :yaOptions="yaOptions" @created="(p) => extendYaTask({ package: p })" />
    <ElementsAllocation :yaOptions="yaOptions" @created="(a) => extendYaTask({ allocation: a })" />
    <ElementsDemand :yaOptions="yaOptions" :yaTask="yaTask" />
  </div>
</template>
<script setup>
const props = defineProps({
  yaJsEventTarget: EventTarget,
  logger: Object,
});

const yaTask = ref({});

const extendYaTask = (extension) => {
  yaTask.value = { ...yaTask.value, ...extension };
};

const yaOptions = {
  yagnaOptions: {
    apiKey: "30c59fef7d8c4639b62d576bfb624e1a",
    basePath: "http://127.0.0.1:7465",
  },
  imageHash: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
  subnetTag: "public",
  logger: props.logger,
  eventTarget: props.yaJsEventTarget,

  minCpuThreads: 1,
  minStorageGib: 1,
  minMemGib: 1,
};
//
// const runTask = async () => {
//   const executor = await TaskExecutor.create({
//     yagnaOptions: {
//       apiKey: "30c59fef7d8c4639b62d576bfb624e1a",
//       basePath: "http://127.0.0.1:7465",
//     },
//     package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
//     subnetTag: "public",
//     logger: props.logger,
//     eventTarget: props.yaJsEventTarget,
//   });
//
//   await executor
//     .run(async (ctx) => appendResults((await ctx.run("echo 'Hello World'")).stdout))
//     .catch((e) => logger.error(e));
//   await executor.end();
// };
</script>
