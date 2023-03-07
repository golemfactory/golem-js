<template>
  <el-tabs class="editor-tabs" v-model="editorActiveTab">
    <el-tab-pane label="Your Code" name="code">
      <MonacoEditor class="editor" v-model="code" lang="javascript" :options="monacoEditorOptions" />
    </el-tab-pane>
  </el-tabs>
</template>
<script setup>
import { useConfigStore } from "~/store/config";
const configStore = useConfigStore();
const { code, monacoEditorOptions } = configStore;
const editorActiveTab = ref("code");
</script>

<style scoped lang="scss">
.editor {
  height: 200px;
  width: 100%;
  margin: 0;
}
</style>
