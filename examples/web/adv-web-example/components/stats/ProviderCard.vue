<template>
  <el-table :data="providers" style="width: 100%" border table-layout="auto" :row-class-name="tableRowClassName">
    <el-table-column type="expand">
      <template #default="props">
        <div class="expandable">
          <h4>Proposals</h4>
          <StatsProposalCard :proposals="props.row.proposals" />
        </div>
      </template>
    </el-table-column>
    <el-table-column label="Id" prop="id" />
    <el-table-column label="Name" prop="providerName" />
  </el-table>
</template>
<script setup>
const props = defineProps({
  providers: Array,
});

const tableRowClassName = ({ row, rowIndex }) => {
  let className = row.proposals.length > 0 ? "expandable-row" : "no-expandable-row";

  if (row.providerName !== "unknown") {
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
.success-row {
  .el-table__expand-column {
    background-color: var(--el-color-success-light-5) !important;
  }
}
.no-expandable-row {
  .el-table__expand-column {
    .cell {
      display: none !important;
    }
  }
}
</style>
