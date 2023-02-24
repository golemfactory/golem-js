<template>
  <el-card class="card-box margin-bottom" v-loading="loading">
    <template #header>
      <div class="card-header">
        <span>Package</span>
        <el-button type="success" @click="createPackage" v-if="!thePackage">Create Package</el-button>
      </div>
    </template>

    <el-descriptions :column="2" size="small" border v-if="thePackage">
      <el-descriptions-item label="Min Memory">{{ thePackage.minMemGib }} Gib </el-descriptions-item>
      <el-descriptions-item label="Min Storage">{{ thePackage.minStorageGib }} Gib </el-descriptions-item>
      <el-descriptions-item label="Min CPU Threads">{{ thePackage.minCpuThreads }} Threads</el-descriptions-item>
      <el-descriptions-item label="Min CPU Cores">{{ thePackage.minCpuCores }} Cores </el-descriptions-item>
      <el-descriptions-item label="Engine">{{ thePackage.engine }} </el-descriptions-item>
      <el-descriptions-item label="Capabilities">{{ thePackage.capabilities.join(", ") }}</el-descriptions-item>
      <el-descriptions-item label="Image Hash" :span="2">{{ thePackage.imageHash }} </el-descriptions-item>
    </el-descriptions>
    <p v-else>Create package first</p>
  </el-card>
</template>
<script setup>
import { Package } from "yajsapi";

const props = defineProps({
  yaOptions: Object,
});

const emit = defineEmits(["created"]);

const thePackage = ref();
const loading = ref(false);

const createPackage = async () => {
  loading.value = true;
  const taskPackage = await Package.create(props.yaOptions);
  setTimeout(() => {
    loading.value = false;
    if (!taskPackage.options) {
      throw new Error("Unable to create package");
    }
    thePackage.value = taskPackage.options;
    emit("created", taskPackage);
  }, 500);
};
</script>
