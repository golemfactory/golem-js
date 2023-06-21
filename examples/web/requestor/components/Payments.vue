<template>
  <el-table class="payments" :data="paymentsStore.getAll" :default-sort="{ prop: 'time', order: 'descending' }">
    <el-table-column prop="time" label="Time" sortable width="80" />
    <el-table-column prop="type" label="Type" sortable width="100">
      <template #default="scope">
        <el-tag class="tag-state" :type="scope.row.type === 'invoice' ? '' : 'warning'">
          {{ scope.row.type }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="providerName" label="Provider" sortable min-width="150" />
    <el-table-column prop="amount" label="Amount" sortable min-width="180" width="200" />
    <el-table-column prop="state" label="State" sortable width="100">
      <template #default="scope">
        <el-tooltip :disabled="!scope.row.reason" :content="scope.row.reason" placement="top" effect="light">
          <el-tag class="tag-state" :type="getStateType(scope.row.state)" v-loading="scope.row.isProcessing">
            {{ scope.row.state }}
          </el-tag>
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column label="Actions" width="200" fixed="right" align="center" v-if="actions">
      <template #default="scope">
        <el-button
          v-if="actions && scope.row.state === 'Received'"
          size="small"
          plain
          type="success"
          @click="midLevelStore.confirmNoteById(scope.row.id)"
          :disabled="scope.row.isProcessing"
          >Accept</el-button
        >
        <el-button
          v-if="actions && scope.row.state === 'Received'"
          plain
          size="small"
          type="danger"
          @click="midLevelStore.rejectNoteById(scope.row.id)"
          :disabled="scope.row.isProcessing"
          >Reject</el-button
        >
      </template>
    </el-table-column>
  </el-table>
</template>
<script setup>
const { $eventTarget: eventTarget, $logger: logger } = useNuxtApp();
import { usePaymentsStore } from "~/store/payments";
import { useConfigStore } from "~/store/config";
import { useMidLevelStore } from "~/store/mid";

import { storeToRefs } from "pinia";
const paymentsStore = usePaymentsStore();
const configStore = useConfigStore();
const midLevelStore = useMidLevelStore();

const { payments } = storeToRefs(paymentsStore);
const actions = computed(() => configStore.activeControlActions);

const getStateType = (state) => {
  if (state === "Rejected") return "error";
  if (state === "Accepted") return "success";
};
</script>
<style scoped lang="scss">
.payments {
  width: 100%;
  min-height: 370px;
  height: 60vh;
}
.tag-state {
  width: 70px;
}
</style>
