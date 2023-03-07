<template>
  <el-collapse-item name="allocation">
    <template #title>
      Allocation
      <el-icon style="margin-right: 10px" :size="22" class="success-icon" v-if="allocation">
        <CircleCheck />
      </el-icon>
      <el-icon style="margin-right: 10px" :size="22" class="loading-icon" v-else>
        <Loading />
      </el-icon>
    </template>
    <div>
      <el-descriptions :column="2" size="small" border v-if="allocation">
        <el-descriptions-item label="ID" :span="2">{{ allocation.id }} </el-descriptions-item>
        <el-descriptions-item label="Address" :span="2">{{ allocation.address }} </el-descriptions-item>
        <el-descriptions-item label="Platform">{{ allocation.paymentPlatform }}</el-descriptions-item>
        <el-descriptions-item label="Timeout">{{ allocation.timeout }}</el-descriptions-item>
        <el-descriptions-item label="Remaining Amount">{{ allocation.remainingAmount }} </el-descriptions-item>
        <el-descriptions-item label="Total Amount">{{ allocation.totalAmount }} </el-descriptions-item>
      </el-descriptions>
    </div>
  </el-collapse-item>
</template>
<script setup>
import { CircleCheck, Loading } from "@element-plus/icons-vue";
import { useDemandStore } from "~/store/demand";
import { storeToRefs } from "pinia";
const demandStore = useDemandStore();
const { allocation } = storeToRefs(demandStore);
</script>
<style scoped lang="scss">
.success-icon,
.loading-icon {
  position: absolute;
  right: 1rem;
}
</style>
