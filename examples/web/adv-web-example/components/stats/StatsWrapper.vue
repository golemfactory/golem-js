<template>
  <div>Here will be stats</div>
</template>
<script setup>
import { StatsService } from "yajsapi";

const props = defineProps({
  yaJsEventTarget: EventTarget,
  logger: Object,
});

const statService = new StatsService({ eventTarget: props.yaJsEventTarget, logger: props.logger });
statService.run();
setInterval(() => {
  console.log(statService.getStatsTree());
}, 3000);
</script>
