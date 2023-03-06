<template>
  <el-table class="offers" :data="offers" :default-sort="{ prop: 'state', order: 'ascending' }">
    <el-table-column prop="time" label="Time" sortable />
    <el-table-column prop="providerName" label="Provider" width="135" sortable />
    <el-table-column prop="cpuBrand" label="CPU" sortable width="120">
      <template #default="scope">
        <el-tooltip :content="scope.row.cpuBrand" placement="right" effect="light">
          {{ scope.row.cpuBrand.substring(0, 13)+"..." }}
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column prop="cpuCores" label="Cores" width="80" sortable/>
    <el-table-column prop="memory" label="Mem (Gb)" width="105" sortable/>
    <el-table-column prop="storage" label="Stor (Gb)" width="100" sortable/>
    <el-table-column prop="state" label="State" sortable width="100">
      <template #default="scope">
        <el-tooltip :disabled="!scope.row.reason" :content="scope.row.reason" placement="top" effect="light">
          <el-tag class="tag-state" :type="getStateType(scope.row.state)">
            {{ scope.row.state }}
          </el-tag>
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column label="Actions" width="80" fixed="right" align="center">
      <template #default="scope">
        <el-button title="Show full offer" size="small" plain @click="show(scope.row.id)"><el-icon><Document /></el-icon></el-button>
        <el-button v-if="actions" size="small" plain type="success" @click="respond(scope.row.id)">Respond</el-button>
        <el-button
          v-if="actions"
          plain
          size="small"
          type="danger"
          @click="reject(scope.row.id)">Reject</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
<script setup>
import { Document } from "@element-plus/icons-vue"
import { useOffersStore } from "~/store/offers";
import { storeToRefs } from "pinia";
const offerStore = useOffersStore();
const { offers } = storeToRefs(offerStore);

defineProps({
  actions: Boolean
})
const getStateType = (state) => {
  if (state === 'Draft') return 'warning';
  if (state === 'Rejected') return 'error';
  if (state === 'Failed') return 'danger';
  if (state === 'Confirmed') return 'success';
}

const respond = (id) => {
  //todo
}
const reject = (id) => {
  //todo
}
const show = (id) => {
  offerStore.showOffer(id)
}

</script>
<style scoped lang="scss">
.offers {
  width: 100%;
  height: 370px;
}
.tag-state {
  width: 70px;
}
</style>
