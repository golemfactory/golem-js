<template>
  <el-table :data="allocations" style="width: 100%" border table-layout="auto">
    <el-table-column label="Id" prop="id" />
  </el-table>
</template>
<script setup>
const props = defineProps({
  allocations: Array,
});
</script>
