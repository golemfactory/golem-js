<template>
  <el-drawer class="drawer-demand" v-model="drawerDemandId" v-if="demand" title="Demand">
    <h3><label>Account:</label> {{ demand.account }}</h3>
    <h4>
      <label>ID: </label>
      <el-tooltip :content="demand.id" placement="bottom" effect="light">
        {{ demand?.id?.substring(0, 40) + "..." }}
      </el-tooltip>
    </h4>
    <el-result
      :icon="getDemandIcon(demand.state)"
      :title="demand.state"
      :sub-title="getDemandSubtitle(demand.state)"
      class="drawer-result"
    >
      <template class="error-box" v-if="demand.reason" #extra>
        <div class="error-message">{{ demand.reason }}</div>
      </template>
    </el-result>
    <el-row justify="space-between" class="time-state">
      <el-tag class="tag-time" effect="plain">
        <el-icon size="small"><Clock /></el-icon> {{ new Date(demand?.timestamp).toLocaleString() }}
      </el-tag>
      <el-tag class="tag-state" :type="getStateType(demand?.state)">
        {{ demand?.state }}
      </el-tag>
    </el-row>
    <el-descriptions title="Properties" :column="1" :border="true">
      <template v-for="property in demand.properties">
        <el-descriptions-item :label="property.key">{{ property.value }}</el-descriptions-item>
      </template>
    </el-descriptions>
    <el-descriptions title="Constraints" :column="1" :border="true">
      <template v-for="(constraint, i) in demand.constraints">
        <el-descriptions-item :label="i+1">{{ constraint }}</el-descriptions-item>
      </template>
    </el-descriptions>
    <template #footer v-if="configStore.activeControlActions && demand.state === 'Subscribed'">
      <div class="drawer-footer">
        <el-button type="danger" @click="midLevelStore.unsubscribeDemand()">
          <el-icon><CircleClose /></el-icon> Unsubscribe
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>
<script setup>
import { Clock, CircleClose } from "@element-plus/icons-vue";
import { useDemandsStore } from "~/store/demands";
import { useConfigStore } from "~/store/config";
import { useMidLevelStore } from "~/store/mid";
import { storeToRefs } from "pinia";
const demandsStore = useDemandsStore();
const midLevelStore = useMidLevelStore();
const configStore = useConfigStore();
const { drawerDemand: demand, drawerDemandId } = storeToRefs(demandsStore);

const getStateType = (state) => {
  if (state === "Subscribed") return "success";
  if (state === "Failed") return "error";
  if (state === "Unsubscribed") return "error";
};
const getDemandIcon = (state) => {
  if (state === "Subscribed") return "success";
  if (state === "Failed") return "error";
  if (state === "Unsubscribed") return "error";
};
const getDemandSubtitle = (state) => {
  if (state === "Subscribed") return "Demand published on the market. Listening for new offers...";
  if (state === "Failed") return "Something went wrong...";
  if (state === "Unsubscribed") return "Demand unsubscribed";
};
</script>
<style lang="scss">
.el-drawer.drawer-demand {
  label {
    color: #b3b3b3;
  }
  h3 {
    text-align: center;
    font-size: 0.8rem;
    margin: 0;
    label {
      font-size: 0.7rem;
    }
  }
  h4 {
    text-align: center;
    font-size: 0.8rem;
    margin: 20px 0;
    label {
      font-size: 0.7rem;
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
    td {
      word-break: break-all;
      white-space: pre-wrap;       /* css-3 */
      white-space: -moz-pre-wrap;  /* Mozilla, since 1999 */
      white-space: -pre-wrap;      /* Opera 4-6 */
      white-space: -o-pre-wrap;    /* Opera 7 */
      word-wrap: break-word;
    }
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
