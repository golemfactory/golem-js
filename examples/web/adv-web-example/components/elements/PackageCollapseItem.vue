<template>
  <el-collapse-item name="package">
    <template #title>
      Package
      <el-icon style="margin-right: 10px" :size="22" class="success-icon" v-if="taskPackage">
        <CircleCheck />
      </el-icon>
      <el-icon style="margin-right: 10px" :size="22" class="loading-icon" v-else>
        <Loading />
      </el-icon>
    </template>
    <div>
      <el-descriptions :column="2" size="small" border v-if="taskPackage">
        <el-descriptions-item label="Min Memory">{{ taskPackage.options.minMemGib }} Gib </el-descriptions-item>
        <el-descriptions-item label="Min Storage">{{ taskPackage.options.minStorageGib }} Gib </el-descriptions-item>
        <el-descriptions-item label="Min CPU Threads"
          >{{ taskPackage.options.minCpuThreads }} Threads</el-descriptions-item
        >
        <el-descriptions-item label="Min CPU Cores">{{ taskPackage.options.minCpuCores }} Cores </el-descriptions-item>
        <el-descriptions-item label="Engine">{{ taskPackage.options.engine }} </el-descriptions-item>
        <el-descriptions-item label="Capabilities">{{
          taskPackage.options.capabilities?.join(", ")
        }}</el-descriptions-item>
        <el-descriptions-item label="Image Hash" :span="2">{{ taskPackage.options.imageHash }} </el-descriptions-item>
      </el-descriptions>
    </div>
  </el-collapse-item>
</template>
<script setup>
import { CircleCheck, Loading } from "@element-plus/icons-vue";
import { useDemandStore } from "~/store/demand";
import { storeToRefs } from "pinia";
const demandStore = useDemandStore();
const { taskPackage } = storeToRefs(demandStore);
</script>
<style scoped lang="scss">
.success-icon,
.loading-icon {
  position: absolute;
  right: 1rem;
}
</style>
