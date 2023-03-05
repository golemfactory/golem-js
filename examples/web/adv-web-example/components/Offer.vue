<template>
  <el-drawer class="drawer-offer" v-model="drawer" title="Offer">
    <h3><label>Provider:</label> {{offer.providerName}}</h3>
    <h4>
      <label>ID: </label>
      <el-tooltip :content="offer.id" placement="bottom" effect="light">
        {{ offer?.id?.substring(0, 40)+"..." }}
      </el-tooltip>
    </h4>
    <el-result
      :icon="getOfferIcon(offer.state)"
      :title="offer.state"
      :sub-title="getOfferSubtitle(offer.state)"
      class="drawer-result"
    >
      <template class="error-box" v-if="offer.reason" #extra>
        <div class="error-message">{{offer.reason}}</div>
      </template>
    </el-result>
    <el-row justify="space-between" class="time-state">
      <el-tag class="tag-time" effect="plain">
        <el-icon size="small"><Clock /></el-icon> {{new Date(offer?.timestamp).toLocaleString() }}
      </el-tag>
      <el-tag class="tag-state" :type="getStateType(offer?.state)">
        {{offer?.state}}
      </el-tag>
    </el-row>
    <el-descriptions
      title="Properties"
      :column="1"
      :border="true"
    >
      <el-descriptions-item label="CPU Brand">{{offer.cpuBrand}}</el-descriptions-item>
      <el-descriptions-item label="CPU Cores">{{offer.cpuCores}}</el-descriptions-item>
      <el-descriptions-item label="CPU Threads">{{offer.cpuThreads}}</el-descriptions-item>
      <el-descriptions-item label="Memory">{{offer.memory}} GB</el-descriptions-item>
      <el-descriptions-item label="Storage">{{offer.storage}} GB</el-descriptions-item>
      <el-descriptions-item label="Runtime">{{offer.runtimeName}}</el-descriptions-item>
      <el-descriptions-item label="Public Net">{{offer.publicNet}}</el-descriptions-item>
      <el-descriptions-item label="Transfer Protocol">{{offer?.transferProtocol?.join(", ")}}</el-descriptions-item>
      <el-descriptions-item label="Runtime Capabilities ">{{offer?.runtimeCapabilities?.join(", ")}}</el-descriptions-item>
      <el-descriptions-item label="CPU Capabilities ">{{offer?.cpuCapabilities?.join(", ")}}</el-descriptions-item>
    </el-descriptions>
    <template #footer v-if="actions">
      <div class="drawer-footer">
        <el-button type="danger" @click="reject"><el-icon><CircleClose /></el-icon> Reject</el-button>
        <el-button type="success" @click="confirm"><el-icon><CircleCheck /></el-icon> Respond</el-button>
      </div>
    </template>
  </el-drawer>
</template>
<script setup>
import { Clock, CircleClose, CircleCheck } from "@element-plus/icons-vue"
import { useOffersStore } from "~/store/offers";
import { storeToRefs } from "pinia";
const offerStore = useOffersStore();
const { drawerOffer: offer, drawer } = storeToRefs(offerStore);
const props = defineProps({
  actions: Boolean
});
const getStateType = (state) => {
  if (state === 'Draft') return 'warning';
  if (state === 'Rejected') return 'error';
  if (state === 'Failed') return 'danger';
  if (state === 'Confirmed') return 'success';
}
const getOfferIcon = (state) => {
  if (state === 'Initial') return 'info';
  if (state === 'Draft') return 'warning';
  if (state === 'Rejected') return 'error';
  if (state === 'Failed') return 'error';
  if (state === 'Confirmed') return 'success';
}
const getOfferSubtitle = (state) => {
  if (state === 'Initial') return 'Offer has been responded. Waiting for draft...';
  if (state === 'Draft') return 'Offer is in draft state. Waiting for confirmation...';
  if (state === 'Rejected') return 'Offer has been rejected by provider.';
  if (state === 'Failed') return 'Something went wrong...';
  if (state === 'Confirmed') return 'Offer is confirmed. Waiting for agreement...';
}
</script>
<style scoped lang="scss">
.el-drawer.drawer-offer {
  label {
    color: #b3b3b3;
  }
  h3 {
    text-align: center;
    font-size: 1.1rem;
    margin: 0;
    label {
      font-size: 1rem;
    }
  }
  h4 {
    text-align: center;
    font-size: 0.9rem;
    margin: 20px 0;
    label {
      font-size: 0.9rem;
    }
  }
  .time-state {
    display: flex;
    align-items: baseline;
    margin-top: 30px;
    .tag-time {
      font-size: 0.9rem;
    }
    .tag-state {
      font-size: 0.9rem;
      padding: 5px 20px;
      box-sizing: content-box;
    }
  }
  .el-result.drawer-result {
    padding: 20px 0;
  }
  .error-message {
    text-align: left;
    font-size: 0.8rem;
    overflow-wrap: break-word;
    word-wrap: break-word;
    hyphens: auto;
  }
  .el-descriptions {
    margin-top: 30px;
  }
  .drawer-footer {
    display: flex;
    justify-content: space-between;
    .el-icon {
      padding: 0 5px;
    }
  }
}
</style>
