<template>
  <el-collapse-item name="account">
    <template #title>
      Account
      <el-icon style="margin-right: 10px" :size="22" class="success-icon" v-if="account">
        <CircleCheck />
      </el-icon>
      <el-icon style="margin-right: 10px" :size="22" class="loading-icon" v-else>
        <Loading />
      </el-icon>
    </template>
    <div>
      <el-descriptions :column="2" size="small" border v-if="account">
        <el-descriptions-item label="Platform" :span="2">{{ account.platform }} </el-descriptions-item>
        <el-descriptions-item label="Address" :span="2">{{ account.address }} </el-descriptions-item>
        <el-descriptions-item label="Driver">{{ account.driver }}</el-descriptions-item>
        <el-descriptions-item label="Network">{{ account.network }}</el-descriptions-item>
        <el-descriptions-item label="Send">{{ account.send }} </el-descriptions-item>
        <el-descriptions-item label="Receive">{{ account.receive }} </el-descriptions-item>
        <el-descriptions-item label="Token">{{ account.token }} </el-descriptions-item>
      </el-descriptions>
    </div>
  </el-collapse-item>
</template>
<script setup>
import { CircleCheck, Loading } from "@element-plus/icons-vue";
import { storeToRefs } from "pinia";
import { useDemandStore } from "~/store/demand";
const demandStore = useDemandStore();
const { account } = storeToRefs(demandStore);
</script>
<style scoped lang="scss">
.success-icon,
.loading-icon {
  position: absolute;
  right: 1rem;
}
</style>
