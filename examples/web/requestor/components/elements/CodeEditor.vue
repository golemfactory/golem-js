<template>
  <el-tabs class="editor-tabs" v-model="editorActiveTab">
    <el-tab-pane label="Your Code" name="code">
      <div class="editor-wrap">
        <MonacoEditor
          class="editor"
          v-model="configStore.code"
          :lang="configStore.lang"
          :options="configStore.monacoEditorOptions"
        />
      </div>
    </el-tab-pane>
  </el-tabs>
</template>
<script setup>
import { useConfigStore } from "~/store/config";
const configStore = useConfigStore();
const editorActiveTab = ref("code");
configStore.code = configStore.exampleCode;
</script>

<style scoped lang="scss">
.editor-wrap {
  height: 32vh;
  width: 100%;
}
.editor {
  min-height: 200px;
  height: 100%;
  width: 100%;
  margin: 0;
}
</style>
