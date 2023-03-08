<template>
  <el-table class="activities" :data="activities" :default-sort="{ prop: 'time', order: 'descending' }">
    <el-table-column prop="time" label="Time" sortable />
    <el-table-column prop="providerName" label="Provider" sortable width="140" />
    <el-table-column v-if="!actions" prop="id" label="ID" sortable width="140">
      <template #default="scope">
        <el-tooltip :content="scope.row.id" placement="left" effect="light">
          {{ scope.row.id.substring(0, 10) + "..." }}
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column prop="agreementId" label="Agreement" sortable width="140">
      <template #default="scope">
        <el-tooltip :content="scope.row.agreementId" placement="left" effect="light">
          {{ scope.row.agreementId.substring(0, 10) + "..." }}
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column prop="scripts" label="Scripts" sortable width="88" />
    <el-table-column prop="duration" label="Duration" sortable width="100">
      <template #default="scope"> {{ scope.row.duration.toFixed(3) }} s </template>
    </el-table-column>
    <el-table-column prop="state" label="State" sortable width="100">
      <template #default="scope">
        <el-tooltip :disabled="!scope.row.reason" :content="scope.row.reason" placement="top" effect="light">
          <el-tag class="tag-state" :type="getStateType(scope.row.state)">
            {{ scope.row.state }}
          </el-tag>
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column label="Actions" width="140" fixed="right" align="center" v-if="actions">
      <template #default="scope">
        <el-button
          v-if="actions && scope.row.state === 'Initialised'"
          size="small"
          plain
          type="warning"
          @click="deploy(scope.row.id)"
        >
          Deploy
        </el-button>
        <el-button
          v-if="actions && scope.row.state === 'Deployed'"
          size="small"
          plain
          type="success"
          @click="start(scope.row.id)"
        >
          Start
        </el-button>
        <el-button
          v-if="actions && scope.row.state === 'Ready'"
          size="small"
          plain
          type="success"
          @click="runScript(scope.row.id)"
        >
          Run
        </el-button>
        <el-button v-if="actions" plain size="small" type="danger" @click="stop(scope.row.id)">
          <el-icon><Close /></el-icon>
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
<script setup>
const { $eventTarget: eventTarget, $logger: logger } = useNuxtApp();
import { Close } from "@element-plus/icons-vue";
import { useActivitiesStore } from "~/store/activities";
import { useMidLevelStore } from "~/store/mid";
import { useConfigStore } from "~/store/config";
const configStore = useConfigStore();
import { storeToRefs } from "pinia";
const activitiesStore = useActivitiesStore();
const { activities } = storeToRefs(activitiesStore);
const actions = computed(() => configStore.activeControlActions);
const midLevelStore = useMidLevelStore();

const getStateType = (state) => {
  if (state === "Initialized" || state === "Deployed") return "warning";
  if (state === "Unresponsive" || state === "Terminated") return "danger";
  if (state === "Ready") return "success";
};

const sleep = (time, inMs = false) => new Promise((resolve) => setTimeout(resolve, time * (inMs ? 1 : 1000)));

const deploy = async (id) => {
  await midLevelStore.deployActivity(id);
};

const start = async (id) => {
  await midLevelStore.startActivity(id);
};

const runScript = async (id) => {
  const command = configStore.code;
  const result = await midLevelStore.runScript(id, command);
  configStore.stdout += result.stdout;
};
const stop = async (id) => {
  await midLevelStore.stopActivity(id);
};
</script>
<style scoped lang="scss">
.activities {
  width: 100%;
  height: 360px;
}
.tag-state {
  width: 80px;
}
</style>
