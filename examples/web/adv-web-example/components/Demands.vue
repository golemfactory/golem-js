<template>
  <el-table class="demands" :data="demandsStore.demands" :default-sort="{ prop: 'time', order: 'descending' }">
    <el-table-column prop="time" label="Time" sortable width="80"/>
    <el-table-column prop="id" label="ID" sortable width="185">
      <template #default="scope">
        <el-tooltip :content="scope.row.id" placement="left" effect="light">
          {{ scope.row.id.substring(0, 20) + "..." }}
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column prop="account" label="Account" sortable width="240">
      <template #default="scope">
        <el-tooltip :content="scope.row.account" placement="left" effect="light">
          {{ scope.row.account.substring(0, 25) + "..." }}
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column prop="subnet" label="Subnet" sortable width="110"/>
    <el-table-column prop="state" label="State" sortable width="110">
      <template #default="scope">
        <el-tooltip :disabled="!scope.row.reason" :content="scope.row.reason" placement="top" effect="light">
          <el-tag class="tag-state" :type="getStateType(scope.row.state)" v-loading="scope.row.isProcessing">
            {{ scope.row.state }}
          </el-tag>
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column label="Actions" :width="80" fixed="right" align="center">
      <template #default="scope">
        <el-button title="Show full demand" size="small" @click="show(scope.row.id)">
          <el-icon><Document /></el-icon>
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
<script setup>
import { Document, Close } from "@element-plus/icons-vue";
import { useDemandsStore } from "~/store/demands";
import { useConfigStore } from "~/store/config.js";
const configStore = useConfigStore();
const demandsStore = useDemandsStore();

const actions = computed(() => configStore.activeControlActions);

const getStateType = (state) => {
  if (state === "Subscribed") return "success";
  if (state === "Failed") return "danger";
  if (state === "Unsubscribed") return "danger";
};

const show = async (id) => {

};
</script>
<style scoped lang="scss">
.agreements {
  width: 100%;
  height: 360px;
}
.tag-state {
  width: 90px;
}
</style>
