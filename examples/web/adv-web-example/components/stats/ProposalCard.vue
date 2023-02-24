<template>
  <el-table :data="proposals" style="width: 100%" border table-layout="auto" :row-class-name="tableRowClassName">
    <el-table-column type="expand">
      <template #default="props">
        <div class="expandable">
          <h4>Agreement</h4>
          <StatsAgreementCard :agreement="props.row.agreement" v-if="props.row.agreement" />
        </div>
      </template>
    </el-table-column>
    <el-table-column label="Id" prop="id" />
  </el-table>
</template>
<script setup>
const props = defineProps({
  proposals: Array,
});

const tableRowClassName = ({ row, rowIndex }) => {
  let className = row.agreement ? "expandable-row" : "no-expandable-row";

  if (row.agreement) {
    className += " success-row";
  }

  return className;
};
</script>
<style scoped>
.expandable {
  padding-left: 1rem;
  margin-left: 1rem;
  border-left: 4px solid var(--el-border-color);
}
</style>
<style lang="scss">
.no-expandable-row {
  .el-table__expand-column {
    .cell {
      display: none !important;
    }
  }
}
</style>
