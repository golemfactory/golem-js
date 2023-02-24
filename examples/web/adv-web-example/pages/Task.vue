<template>
  <el-row>
    <el-col :span="12">
      <span class="label">Your Code:</span>
      <div class="editor">
        <textarea></textarea>
      </div>
      <span class="label">Options:</span>
      <el-tabs v-model="activeName" class="results-tabs">
        <el-tab-pane label="STDOUT" name="first">User</el-tab-pane>
        <el-tab-pane label="STDERR" name="second">Config</el-tab-pane>
      </el-tabs>
    </el-col>
    <el-col :span="12">
      STATS COMPONENT (TODO)
    </el-col>
  </el-row>
</template>

<script setup>
const value = ref('');
const activeName = ref('first')
</script>

<style scoped lang="scss">
.editor {
  height: 300px;
  width: 500px;
  textarea {
    height: 100%;
    width: 100%;
    background: #212121;
    color: #e0e0e0;
    border: none;
  }

}
</style>
