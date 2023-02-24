<template>
  <el-card class="card-box margin-bottom" v-loading="loading">
    <template #header>
      <div class="card-header">
        <span>Accounts and Allocation</span>
      </div>
    </template>
    <el-table :data="accounts" border table-layout="auto" v-if="!theAllocation">
      <el-table-column label="Platform">
        <template #default="scope">
          {{ scope.row.address }}<br />
          {{ scope.row.platform }}
        </template>
      </el-table-column>
      <el-table-column prop="driver" label="Driver" />
      <el-table-column prop="network" label="Network" />
      <el-table-column prop="token" label="Token" />
      <el-table-column label="Send / Receive">
        <template #default="scope">
          Send: {{ scope.row.send }}<br />
          Receive: {{ scope.row.receive }}
        </template>
      </el-table-column>
      <el-table-column label="Actions" class-name="actions">
        <template #default="scope">
          <el-button type="success" size="small" @click="createAllocation(scope.row)">Create Allocation</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-descriptions :column="2" size="small" border v-else>
      <el-descriptions-item label="ID" :span="2">{{ theAllocation.id }} </el-descriptions-item>
      <el-descriptions-item label="Address" :span="2">{{ theAllocation.address }} </el-descriptions-item>
      <el-descriptions-item label="Platform">{{ theAllocation.paymentPlatform }}</el-descriptions-item>
      <el-descriptions-item label="Timeout">{{ theAllocation.timeout }}</el-descriptions-item>
      <el-descriptions-item label="Remaining Amount">{{ theAllocation.remainingAmount }} </el-descriptions-item>
      <el-descriptions-item label="Total Amount">{{ theAllocation.totalAmount }} </el-descriptions-item>
    </el-descriptions>
  </el-card>
</template>
<script setup>
import { Accounts, Allocation } from "yajsapi";

const props = defineProps({
  yaOptions: Object,
});

const emit = defineEmits(["created"]);

const theAllocation = ref();
const loading = ref(true);

// Retrieving accounts list
const accounts = await (await Accounts.create(props.yaOptions)).list();

setTimeout(() => {
  loading.value = false;
}, 500);
console.log(accounts);

const createAllocation = async (account) => {
  loading.value = true;

  let yaOptions = { ...props.yaOptions, account };
  try {
    const allocation = await Allocation.create(yaOptions);
    setTimeout(() => {
      loading.value = false;
      theAllocation.value = allocation;
      emit("created", allocation);
    }, 500);
  } catch (e) {
    loading.value = false;
    throw new Error("Unable to create allocation");
  }
};
</script>
