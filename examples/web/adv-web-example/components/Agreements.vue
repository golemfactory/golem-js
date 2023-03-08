<template>
  <el-table class="agreements" :data="agreements" :default-sort="{ prop: 'time', order: 'descending' }">
    <el-table-column prop="time" label="Time" sortable />
    <el-table-column prop="providerName" label="Provider" sortable width="140" />
    <el-table-column prop="id" label="ID" sortable width="150">
      <template #default="scope">
        <el-tooltip :content="scope.row.id" placement="left" effect="light">
          {{ scope.row.id.substring(0, 12) + "..." }}
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column prop="proposalId" label="Offer" sortable width="150">
      <template #default="scope">
        <el-link @click="showOffer(scope.row.proposalId)">{{ scope.row.proposalId.substring(0, 12) + "..." }}</el-link>
      </template>
    </el-table-column>
    <el-table-column prop="validTo" label="Valid to" width="150" sortable />
    <el-table-column prop="state" label="State" sortable width="110">
      <template #default="scope">
        <el-tooltip :disabled="!scope.row.reason" :content="scope.row.reason" placement="top" effect="light">
          <el-tag class="tag-state" :type="getStateType(scope.row.state)">
            {{ scope.row.state }}
          </el-tag>
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column label="Actions" :width="actions ? 120 : 80" fixed="right" align="center" v-if="actions">
      <template #default="scope">
        <el-button
          title="Confirm"
          v-if="actions && scope.row.state === 'Initial'"
          size="small"
          type="success"
          @click="confirm(scope.row.id)"
          :disabled="scope.row.isProcessing"
        >
          <el-icon><Check /></el-icon>
        </el-button>
        <el-button
          title="Create activity"
          v-if="actions && scope.row.state === 'Approved'"
          size="small"
          type="warning"
          @click="createActivity(scope.row.id)"
          :disabled="scope.row.isProcessing"
        >
          <el-icon><Setting /></el-icon>
        </el-button>
        <el-button
          title="Terminate"
          v-if="(actions && scope.row.state === 'Initial') || scope.row.state === 'Approved'"
          size="small"
          type="danger"
          @click="terminate(scope.row.id)"
          :disabled="scope.row.isProcessing"
        >
          <el-icon><Close /></el-icon>
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
<script setup>
const { $eventTarget: eventTarget, $logger: logger } = useNuxtApp();
import { Activity } from "../../../../dist/yajsapi.min.js";
import { Setting, Check, Close } from "@element-plus/icons-vue";
import { useOffersStore } from "~/store/offers";
import { useConfigStore } from "~/store/config";
import { useAgreementsStore } from "~/store/agreements";
import { useMidLevelStore } from "~/store/mid";
import { storeToRefs } from "pinia";
const agreementStore = useAgreementsStore();
const offerStore = useOffersStore();
const configStore = useConfigStore();
const midLevelStore = useMidLevelStore();
const { agreements } = storeToRefs(agreementStore);
const agreement = ref({});

const actions = computed(() => configStore.activeControlActions);

const getStateType = (state) => {
  if (state === "Cancelled" || state === "Expired") return "warning";
  if (state === "Rejected" || state === "Terminated") return "danger";
  if (state === "Approved") return "success";
};

const confirm = async (id) => {
  try {
    await midLevelStore.confirmAgreementById(id);
  } catch (e) {
    console.error(e.message);
  }
};
const terminate = async (id) => {
  try {
    await midLevelStore.terminateAgreementById(id);
  } catch (e) {
    console.error(e.message);
  }
};
const createActivity = async (id) => {
  try {
    const options = { ...configStore.options, logger, eventTarget };
    const activity = await Activity.create(id, options);
    await midLevelStore.addActivity(activity);
  } catch (e) {
    console.error(e.message);
  }
};

const showOffer = (id) => {
  offerStore.show(id);
};
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
