<template>
  <el-table class="offers" :data="offers" style="width: 100%">
    <el-table-column prop="time" label="Time" />
    <el-table-column prop="providerName" label="Provider" />
    <el-table-column prop="cpu" label="CPU" width="140"/>
    <el-table-column prop="mem" label="Mem" />
    <el-table-column prop="storage" label="Storage" />
    <el-table-column prop="state" label="State">
      <template #default="scope">
        <el-tag
          :type="scope.row.state === 'initial' ? '' : 'warning'"
          disable-transitions
        >{{ scope.row.state }}</el-tag
        >
      </template>
    </el-table-column>
    <el-table-column label="Actions" width="180">
      <template #default="scope">
        <el-button size="small" plain type="success" @click="respond(scope.row.id)">Respond</el-button>
        <el-button
          plain
          size="small"
          type="danger"
          @click="reject(scope.row.id)">Reject</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
<script setup>
defineProps();
const respond = (id) => {

}
const reject = (id) => {

}
const offers = [
  {
    id: 1,
    time: '10:23:32',
    providerName: 'stefan',
    cpu: 'Intel i5 Core12',
    mem: '4 Gib',
    storage: '2 Tib',
    state: 'draft'
  },
  {
    id: 2,
    time: '10:23:32',
    providerName: 'zdzichu',
    cpu: 'Intel i5 Core12',
    mem: '4 Gib',
    storage: '2 Tib',
    state: 'draft'
  },
  {
    id: 3,
    time: '10:23:32',
    providerName: 'stachu',
    cpu: 'Intel i5 Core12',
    mem: '4 Gib',
    storage: '2 Tib',
    state: 'initial'
  },
  {
    id: 4,
    time: '10:23:32',
    providerName: 'antek',
    cpu: 'Intel i5 Core12',
    mem: '4 Gib',
    storage: '2 Tib',
    state: 'draft'
  },
  {
    id: 5,
    time: '10:23:32',
    providerName: 'jozek',
    cpu: 'Intel i5 Core12',
    mem: '4 Gib',
    storage: '2 Tib',
    state: 'initial'
  },
  {
    id: 6,
    time: '10:23:32',
    providerName: 'zbychu',
    cpu: 'Intel i5 Core12',
    mem: '4 Gib',
    storage: '2 Tib',
    state: 'draft'
  }
]
</script>
<style scoped lang="scss">

</style>
