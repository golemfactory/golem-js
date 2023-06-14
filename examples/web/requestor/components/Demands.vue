<template>
  <el-table class="demands" :data="demandsStore.demands" :default-sort="{ prop: 'time', order: 'descending' }">
    <el-table-column prop="time" label="Time" sortable width="80" />
    <el-table-column prop="id" label="ID" sortable min-width="175">
      <template #default="scope">
        <el-tooltip :content="scope.row.id" placement="left" effect="light">
          {{ isWideScreen ? scope.row.id : scope.row.id.substring(0, 18) + "..." }}
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column prop="account" label="Account" sortable width="220">
      <template #default="scope">
        <el-tooltip :content="scope.row.account" placement="left" effect="light">
          {{ scope.row.account.substring(0, 20) + "..." }}
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column prop="subnet" label="Subnet" sortable width="110" />
    <el-table-column prop="state" label="State" sortable width="110">
      <template #default="scope">
        <el-tooltip :disabled="!scope.row.reason" :content="scope.row.reason" placement="top" effect="light">
          <el-tag class="tag-state" :type="getStateType(scope.row.state)" v-loading="scope.row.isProcessing">
            {{ scope.row.state }}
          </el-tag>
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column label="Actions" :width="120" fixed="right" align="center">
      <template #default="scope">
        <el-button title="Show full demand" size="small" @click="demandsStore.show(scope.row.id)">
          <el-icon><Document /></el-icon>
        </el-button>
        <el-button
          title="Unsubscribe"
          size="small"
          v-if="scope.row.state === 'Subscribed'"
          type="danger"
          @click="midLevelStore.unsubscribeDemand(scope.row.id)"
        >
          <el-icon><Close /></el-icon>
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
<script setup>
import { Document, Close } from "@element-plus/icons-vue";
import { useDemandsStore } from "~/store/demands";
import { useConfigStore } from "~/store/config.js";
import { useMidLevelStore } from "~/store/mid";
const configStore = useConfigStore();
const demandsStore = useDemandsStore();
const midLevelStore = useMidLevelStore();

const actions = computed(() => configStore.activeControlActions);

const getStateType = (state) => {
  if (state === "Subscribed") return "success";
  if (state === "Failed") return "danger";
  if (state === "Unsubscribed") return "danger";
};
const isWideScreen = () => window.innerWidth > 1400;
</script>
<style scoped lang="scss">
.demands {
  width: 100%;
  min-height: 370px;
  height: 60vh;
}
.tag-state {
  width: 90px;
}
</style>
