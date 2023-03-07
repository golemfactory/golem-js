<template>
  <el-table class="demands" :data="demands" :default-sort="{ prop: 'state', order: 'ascending' }">
    <el-table-column prop="time" label="Time" sortable />
    <el-table-column prop="providerName" label="Provider" width="135" sortable />
    <el-table-column prop="cpuBrand" label="CPU" sortable width="120">
      <template #default="scope">
        <el-tooltip :content="scope.row.cpuBrand" placement="right" effect="light">
          {{ scope.row.cpuBrand.substring(0, 13) + "..." }}
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column v-if="!actions" prop="cpuCores" label="Cores" width="80" sortable />
    <el-table-column prop="memory" label="Mem (Gb)" width="105" sortable />
    <el-table-column prop="storage" label="Stor (Gb)" width="100" sortable />
    <el-table-column prop="state" label="State" sortable width="100">
      <template #default="scope">
        <el-tooltip :disabled="!scope.row.reason" :content="scope.row.reason" placement="top" effect="light">
          <el-tag class="tag-state" :type="getStateType(scope.row.state)">
            {{ scope.row.state }}
          </el-tag>
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column class="actions" label="Actions" :width="actions ? 160 : 80" fixed="right" align="center">
      <template #default="scope">
        <el-button title="Show full offer" size="small" @click="show(scope.row.id)">
          <el-icon><Document /></el-icon>
        </el-button>
        <el-button
          title="Respond"
          v-if="actions && (scope.row.state === 'Initial' || scope.row.state === 'Failed')"
          size="small"
          type="success"
          @click="respond(scope.row.id)"
        >
          <el-icon><Check /></el-icon
        ></el-button>
        <el-button
          title="Reject"
          v-if="actions && (scope.row.state === 'Initial' || scope.row.state === 'Failed')"
          size="small"
          type="danger"
          @click="reject(scope.row.id)"
        >
          <el-icon><Close /></el-icon>
        </el-button>
        <el-button
          title="Reject"
          v-if="actions && scope.row.state === 'Draft'"
          size="small"
          type="warning"
          @click="confirm(scope.row.id)"
        >
          Confirm
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
<script setup>
import { Document, Check, Close } from "@element-plus/icons-vue";
import { useOffersStore } from "~/store/offers";
import { storeToRefs } from "pinia";
const offerStore = useOffersStore();
const { offers } = storeToRefs(offerStore);
const emit = defineEmits(["respond", "reject", "confirm"]);
defineProps({
  actions: Boolean,
});
const getStateType = (state) => {
  if (state === "Draft") return "warning";
  if (state === "Rejected") return "error";
  if (state === "Failed") return "danger";
  if (state === "Confirmed") return "success";
};

const respond = (id) => emit("respond", id);
const reject = (id) => emit("reject", id);
const confirm = (id) => emit("confirm", id);
const show = (id) => offerStore.showOffer(id);
</script>
<style scoped lang="scss">
.offers {
  width: 100%;
  height: 370px;
}
.tag-state {
  width: 70px;
}
.actions {
  .el-button {
    margin: 0;
  }
}
</style>
