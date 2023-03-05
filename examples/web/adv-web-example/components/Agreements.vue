<template>
  <el-table class="agreements" :data="agreements" :default-sort="{ prop: 'time', order: 'descending' }">
    <el-table-column prop="time" label="Time" sortable />
    <el-table-column prop="providerName" label="Provider" sortable width="140"/>
    <el-table-column prop="id" label="ID" sortable width="150">
      <template #default="scope">
        <el-tooltip :content="scope.row.id" placement="left" effect="light">
          {{ scope.row.id.substring(0, 12)+"..." }}
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column prop="proposalId" label="Offer" sortable width="150">
      <template #default="scope">
        <el-link @click="showOffer(scope.row.proposalId)">{{scope.row.proposalId.substring(0, 12)+'...'}}</el-link>
      </template>
    </el-table-column>
    <el-table-column prop="validTo" label="Valid to" width="135" sortable />
    <el-table-column prop="state" label="State" sortable width="110">
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
import { useOffersStore } from "~/store/offers";
import { useAgreementsStore } from "~/store/agreements";
import { storeToRefs } from "pinia";
const agreementStore = useAgreementsStore();
const offerStore = useOffersStore();
const { agreements } = storeToRefs(agreementStore);
const agreement = ref({});
defineProps({
  actions: Boolean
})

const getStateType = (state) => {
  if (state === 'Cancelled' || state === 'Expired') return 'warning';
  if (state === 'Rejected' || state === 'Terminated') return 'error';
  if (state === 'Approved') return 'success';
}

const respond = (id) => {
  //todo
}
const reject = (id) => {
  //todo
}
const showOffer = (id) => {
  offerStore.showOffer(id)
}

</script>
<style scoped lang="scss">
.agreements {
  width: 100%;
  height: 360px;
}
.tag-state {
  width: 80px;
}
</style>
