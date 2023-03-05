<template>
  <el-table class="activities" :data="activities" :default-sort="{ prop: 'time', order: 'descending' }">
    <el-table-column prop="time" label="Time" sortable />
    <el-table-column prop="providerName" label="Provider" sortable width="140"/>
    <el-table-column prop="id" label="ID" sortable width="200">
      <template #default="scope">
        <el-tooltip :content="scope.row.id" placement="left" effect="light">
          {{ scope.row.id.substring(0, 20)+"..." }}
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column prop="agreementId" label="Agreement" sortable width="200">
      <template #default="scope">
        <el-tooltip :content="scope.row.agreementId" placement="left" effect="light">
            {{ scope.row.agreementId.substring(0, 20)+"..." }}
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column prop="scripts" label="Scripts" sortable width="88"/>
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
import { useActivitiesStore } from "~/store/activities";
import { storeToRefs } from "pinia";
const activitiesStore = useActivitiesStore();
const { activities } = storeToRefs(activitiesStore);
defineProps({
  actions: Boolean
})

const getStateType = (state) => {
  if (state === 'Initialized' || state === 'Deployed') return 'warning';
  if (state === 'Unresponsive' || state === 'Terminated') return 'error';
  if (state === 'Ready') return 'success';
}

const respond = (id) => {
  //todo
}
const reject = (id) => {
  //todo
}

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
