<template>
  <el-table :data="invoices" style="width: 100%" border table-layout="auto">
    <el-table-column label="Id" prop="id" />
    <el-table-column label="Amount (GMT)" prop="amount" />
  </el-table>
</template>
<script setup>
const props = defineProps({
  invoices: Array,
});
</script>
