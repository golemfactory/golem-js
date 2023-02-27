<template>
  <el-row :gutter="16" class="stats">
    <el-col :span="8">
      <div class="statistic-card">
        <el-statistic :value="3">
          <template #title>
            <div style="display: inline-flex; align-items: center">
              Agreements created
              <el-tooltip
                effect="dark"
                content="Number of users who logged into the product in one day"
                placement="top"
              >
                <el-icon style="margin-left: 4px" :size="12">
                  <Warning />
                </el-icon>
              </el-tooltip>
            </div>
          </template>
        </el-statistic>
      </div>
    </el-col>
    <el-col :span="8">
      <div class="statistic-card">
        <el-statistic :value="235">
          <template #title>
            <div style="display: inline-flex; align-items: center">
              Total cost
              <el-tooltip
                effect="dark"
                content="Number of users who logged into the product in one month"
                placement="top"
              >
                <el-icon style="margin-left: 4px" :size="12">
                  <Warning />
                </el-icon>
              </el-tooltip>
            </div>
          </template>
        </el-statistic>
      </div>
    </el-col>
    <el-col :span="8">
      <div class="statistic-card">
        <el-statistic :value="132" title="Computation time">
          <template #title>
            <div style="display: inline-flex; align-items: center">
              Computation time
            </div>
          </template>
        </el-statistic>
      </div>
    </el-col>
  </el-row>
</template>

<script lang="ts" setup>
import {
  ArrowRight,
  CaretBottom,
  CaretTop,
  Warning,
} from '@element-plus/icons-vue'
</script>

<style scoped>
.stats {
  padding: 0 20px;
}

.el-statistic {
  --el-statistic-content-font-size: 24px;
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
