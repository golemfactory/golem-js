<template>
  <el-collapse-item name="demand">
    <template #title>
      Demand
      <el-icon style="margin-right: 10px" :size="22" class="success-icon" v-if="demand">
        <CircleCheck />
      </el-icon>
      <el-icon style="margin-right: 10px" :size="22" class="loading-icon" v-else>
        <Loading />
      </el-icon>
    </template>
    <div>
      <el-descriptions :column="2" size="small" border v-if="demand">
        <el-descriptions-item label="ID" :span="2">{{ demand.id }} </el-descriptions-item>
      </el-descriptions>
    </div>
  </el-collapse-item>
</template>
<script setup>
import { CircleCheck, Loading } from "@element-plus/icons-vue";
import { useDemandStore } from "~/store/demand";
import { storeToRefs } from "pinia";
const demandStore = useDemandStore();
const { demand } = storeToRefs(demandStore);
</script>
<style scoped lang="scss">
.success-icon,
.loading-icon {
  position: absolute;
  right: 1rem;
}
</style>
