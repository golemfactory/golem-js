<template>
  <el-table class="offers" :data="offers" :default-sort="{ prop: 'time', order: 'descending' }">
    <el-table-column prop="time" label="Time" sortable>
      <template #default="scope">
        {{ scope.row.time.substring(1) }}
      </template>
    </el-table-column>
    <el-table-column prop="provider" label="Provider" width="140" sortable />
    <el-table-column prop="cpu" label="CPU" sortable width="160">
      <template #default="scope">
        <el-tooltip :content="scope.row.cpu" placement="right" effect="light">
          {{ scope.row.cpu.substring(0, 20)+"..." }}
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column prop="cores" label="Cores" sortable/>
    <el-table-column prop="memory" label="Mem (Gb)" width="110" sortable/>
    <el-table-column prop="storage" label="Stor (Gb)" width="110" sortable/>
    <el-table-column prop="state" label="State" sortable width="100">
      <template #default="scope">
        <el-tooltip :disabled="!scope.row.reason" :content="scope.row.reason" placement="top" effect="light">
          <el-tag class="tag-state" :type="getStateType(scope.row.state)">
            {{ scope.row.state }}
          </el-tag>
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column v-if="actions" label="Actions" width="180">
      <template #default="scope">
        <el-button size="small" plain type="success" @click="respond(scope.row.id)">Respond</el-button>
        <el-button
          plain
          size="small"
          type="danger"
          @click="reject(scope.row.id)">Reject</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
<script setup>
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

}
const reject = (id) => {

}
</script>
<style scoped lang="scss">
.offers {
  width: 100%;
  height: 360px;
}
.tag-state {
  width: 70px;
}
</style>
