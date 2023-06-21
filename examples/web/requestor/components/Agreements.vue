<template>
  <el-table class="agreements" :data="agreements" :default-sort="{ prop: 'time', order: 'descending' }">
    <el-table-column prop="time" label="Time" sortable />
    <el-table-column prop="providerName" label="Provider" sortable min-width="140" />
    <el-table-column v-if="!actions" prop="id" label="ID" sortable min-width="150">
      <template #default="scope">
        <el-tooltip :content="scope.row.id" placement="left" effect="light">
          {{ scope.row.id.substring(0, 12) + "..." }}
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column prop="proposalId" label="Offer" sortable width="150">
      <template #default="scope">
        <el-link @click="offerStore.show(scope.row.proposalId)">{{
          scope.row.proposalId.substring(0, 12) + "..."
        }}</el-link>
      </template>
    </el-table-column>
    <el-table-column prop="validTo" label="Valid to" width="150" sortable />
    <el-table-column prop="state" label="State" sortable width="110">
      <template #default="scope">
        <el-tooltip :disabled="!scope.row.reason" :content="scope.row.reason" placement="top" effect="light">
          <el-tag class="tag-state" :type="getStateType(scope.row.state)" v-loading="scope.row.isProcessing">
            {{ scope.row.state }}
          </el-tag>
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column label="Actions" :width="actions ? 120 : 80" fixed="right" align="center" v-if="actions">
      <template #default="scope">
        <el-button
          title="Confirm"
          v-if="actions && scope.row.state === 'Proposal'"
          size="small"
          type="success"
          @click="midLevelStore.confirmAgreementById(scope.row.id)"
          :disabled="scope.row.isProcessing"
        >
          <el-icon><Check /></el-icon>
        </el-button>
        <el-button
          title="Create activity"
          v-if="actions && scope.row.state === 'Approved' && !getAgreementsIdsWithActiveActivity.includes(scope.row.id)"
          size="small"
          type="warning"
          @click="midLevelStore.createActivityFromAgreement(scope.row.id)"
          :disabled="scope.row.isProcessing"
        >
          <el-icon><Finished /></el-icon>
        </el-button>
        <el-button
          title="Terminate"
          v-if="actions && scope.row.state === 'Approved'"
          size="small"
          type="danger"
          @click="midLevelStore.terminateAgreementById(scope.row.id)"
          :disabled="scope.row.isProcessing"
        >
          <el-icon><Close /></el-icon>
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
<script setup>
import { Finished, Check, Close } from "@element-plus/icons-vue";
import { useOffersStore } from "~/store/offers";
import { useConfigStore } from "~/store/config";
import { useAgreementsStore } from "~/store/agreements";
import { useActivitiesStore } from "~/store/activities";
import { useMidLevelStore } from "~/store/mid";
import { storeToRefs } from "pinia";
const agreementStore = useAgreementsStore();
const activitiesStore = useActivitiesStore();
const offerStore = useOffersStore();
const configStore = useConfigStore();
const midLevelStore = useMidLevelStore();
const { agreements } = storeToRefs(agreementStore);
const { getAgreementsIdsWithActiveActivity } = storeToRefs(activitiesStore);

const agreement = ref({});

const actions = computed(() => configStore.activeControlActions);

const getStateType = (state) => {
  if (state === "Cancelled" || state === "Expired") return "warning";
  if (state === "Rejected" || state === "Terminated") return "danger";
  if (state === "Approved") return "success";
};
</script>
<style scoped lang="scss">
.agreements {
  width: 100%;
  min-height: 370px;
  height: 60vh;
}
.tag-state {
  width: 80px;
}
</style>
