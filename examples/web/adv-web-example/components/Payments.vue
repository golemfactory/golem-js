<template>
  <el-table class="payments" :data="paymentsStore.getAll" :default-sort="{ prop: 'time', order: 'descending' }">
    <el-table-column prop="time" label="Time" sortable width="150"/>
    <el-table-column prop="type" label="Type" sortable width="150">
      <template #default="scope">
        <el-tag class="tag-state" :type="scope.row.type==='invoice' ? '' : 'warning'">
          {{ scope.row.type }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="providerName" label="Provider" sortable width="160"/>
    <el-table-column prop="amount" label="Amount" sortable/>
    <el-table-column prop="state" label="State" sortable width="100">
      <template #default="scope">
        <el-tooltip :disabled="!scope.row.reason" :content="scope.row.reason" placement="top" effect="light">
          <el-tag class="tag-state" :type="getStateType(scope.row.state)">
            {{ scope.row.state }}
          </el-tag>
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column label="Actions" width="80" fixed="right" align="center" v-if="actions" >
      <template #default="scope">
        <el-button v-if="actions" size="small" plain type="success" @click="accept(scope.row.id)">Accept</el-button>
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
import { usePaymentsStore } from "~/store/payments";
import { storeToRefs } from "pinia";
const paymentsStore = usePaymentsStore();
const { payments } = storeToRefs(paymentsStore);
defineProps({
  actions: Boolean
})

const getStateType = (state) => {
  if (state === 'Rejected') return 'error';
  if (state === 'Accepted') return 'success';
}

const accept = (id) => {
  //todo
}
const reject = (id) => {
  //todo
}

</script>
<style scoped lang="scss">
.payments {
  width: 100%;
  height: 360px;
}
.tag-state {
  width: 70px;
}
</style>
