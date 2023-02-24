<template>
  <el-descriptions size="small" :column="1" border>
    <el-descriptions-item label="ID">{{ agreement.id }}</el-descriptions-item>
    <el-descriptions-item label="Status">{{ agreement.status }}</el-descriptions-item>
    <el-descriptions-item label="Details">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="Activities" name="activities">
          <StatsActivityCard :activities="agreement.activities"
        /></el-tab-pane>
        <el-tab-pane label="Payments" name="payments"><StatsPaymentCard :payments="agreement.payments" /></el-tab-pane>
        <el-tab-pane label="Invoices" name="invoices"><StatsInvoiceCard :invoices="agreement.invoices" /></el-tab-pane>
      </el-tabs>
    </el-descriptions-item>
  </el-descriptions>
</template>
<script setup>
const props = defineProps({
  agreement: Object,
});

const activeTab = "activities";
</script>
