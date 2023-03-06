<template>
  <el-row :gutter="16" class="stats">
    <el-col :span="8">
      <div class="statistic-card">
        <el-statistic :value="agreements.length">
          <template #title>
            <div style="display: inline-flex; align-items: center">
              <el-icon style="margin-right: 10px" :size="22">
                <Document />
              </el-icon>
              Agreements created
            </div>
          </template>
        </el-statistic>
      </div>
    </el-col>
    <el-col :span="8">
      <div class="statistic-card">
        <el-statistic :value="totalCost">
          <template #title>
            <div style="display: inline-flex; align-items: center">
              <el-icon style="margin-right: 10px" :size="22">
                <Money />
              </el-icon>
              Total cost
            </div>
          </template>
        </el-statistic>
      </div>
    </el-col>
    <el-col :span="8">
      <div class="statistic-card">
        <el-statistic :value="totalTime">
          <template #title>
            <div style="display: inline-flex; align-items: center">
              <el-icon style="margin-right: 10px" :size="22">
                <Timer />
              </el-icon>
              Computation time
            </div>
          </template>
        </el-statistic>
      </div>
    </el-col>
  </el-row>
</template>

<script setup>
import { Document, Timer, Money } from "@element-plus/icons-vue";
import { useAgreementsStore } from "~/store/agreements";
import { useActivitiesStore } from "~/store/activities";
import { usePaymentsStore } from "~/store/payments";
import { storeToRefs } from "pinia";
const agreementsStore = useAgreementsStore();
const activitiesStore = useActivitiesStore();
const paymentsStore = usePaymentsStore();
const { agreements } = storeToRefs(agreementsStore);
const { totalTime } = storeToRefs(activitiesStore);
const { totalCost } = storeToRefs(paymentsStore);
</script>
<style scoped lang="scss">
.stats {
  padding: 0 20px;
}

.el-statistic {
  --el-statistic-content-font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  .el-statistic__head {
    line-height: initial;
    margin-bottom: 0;
  }
}

.statistic-card {
  padding: 15px;
  border-radius: 4px;
  background-color: var(--el-bg-color-overlay);

}

.green {
  color: var(--el-color-success);
}
.red {
  color: var(--el-color-error);
}
</style>
