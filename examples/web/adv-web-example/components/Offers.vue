<template>
  <el-table class="offers" :data="offersStore.offers" :default-sort="{ prop: 'state', order: 'ascending' }">
    <el-table-column prop="time" label="Time" sortable />
    <el-table-column prop="providerName" label="Provider" width="135" sortable />
    <el-table-column prop="cpuBrand" label="CPU" sortable width="120">
      <template #default="scope">
        <el-tooltip :content="scope.row?.cpuBrand" placement="right" effect="light">
          {{ scope.row?.cpuBrand?.substring(0, 13) + "..." }}
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column v-if="!actions" prop="cpuCores" label="Cores" width="80" sortable />
    <el-table-column prop="memory" label="Mem (Gb)" width="105" sortable />
    <el-table-column prop="storage" label="Stor (Gb)" width="100" sortable />
    <el-table-column prop="state" label="State" sortable width="100">
      <template #default="scope">
        <el-tooltip :disabled="!scope.row.reason" :content="scope.row.reason" placement="top" effect="light">
          <el-tag class="tag-state" :type="getStateType(scope.row.state)" v-loading="scope.row.isProcessing">
            {{ scope.row.state }}
          </el-tag>
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column class="actions" label="Actions" :width="actions ? 160 : 80" fixed="right" align="center">
      <template #default="scope">
        <el-button title="Show full offer" size="small" @click="offersStore.show(scope.row.id)">
          <el-icon><Document /></el-icon>
        </el-button>
        <el-button
          title="Respond"
          v-if="actions && scope.row.state === 'Initial'"
          size="small"
          type="success"
          @click="midLevelStore.respondProposalById(scope.row.id)"
          :disabled="scope.row.isProcessing"
        >
          <el-icon><Check /></el-icon
        ></el-button>
        <el-button
          title="Reject"
          v-if="actions && scope.row.state === 'Initial'"
          size="small"
          type="danger"
          @click="midLevelStore.rejectProposalById(scope.row.id)"
          :disabled="scope.row.isProcessing"
        >
          <el-icon><Close /></el-icon>
        </el-button>
        <el-button
          title="Confirm"
          v-if="actions && scope.row.state === 'Draft'"
          size="small"
          type="warning"
          @click="midLevelStore.createAgreementForProposal(scope.row.id)"
          :disabled="scope.row.isProcessing"
        >
          Confirm
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
<script setup>
const { $eventTarget: eventTarget, $logger: logger } = useNuxtApp();
import { Document, Check, Close } from "@element-plus/icons-vue";
import { useOffersStore } from "~/store/offers";
import { useConfigStore } from "~/store/config";
import { useMidLevelStore } from "~/store/mid";
const offersStore = useOffersStore();
const midLevelStore = useMidLevelStore();
const configStore = useConfigStore();

const actions = computed(() => configStore.activeControlActions);

const getStateType = (state) => {
  if (state === "Draft") return "warning";
  if (state === "Rejected") return "danger";
  if (state === "Failed") return "danger";
  if (state === "Confirmed") return "success";
};
</script>
<style scoped lang="scss">
.offers {
  width: 100%;
  height: 370px;
}
.tag-state {
  width: 70px;
  --el-loading-spinner-size: 18px;
  --el-mask-color: rgba(0, 0, 0, 0.4);
}
.actions {
  .el-button {
    margin: 0;
  }
}
</style>
