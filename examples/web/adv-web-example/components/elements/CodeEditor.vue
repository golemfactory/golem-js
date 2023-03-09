<template>
  <el-tabs class="editor-tabs" v-model="editorActiveTab">
    <el-tab-pane label="Your Code" name="code">
      <MonacoEditor class="editor" v-model="configStore.code" :lang="configStore.lang()" :options="configStore.monacoEditorOptions" />
    </el-tab-pane>
  </el-tabs>
</template>
<script setup>
import { useConfigStore } from "~/store/config";
const configStore = useConfigStore();
const editorActiveTab = ref("code");
watch(configStore.lang, (lang) => {
  configStore.code = configStore.exampleCode()
})
configStore.code = configStore.exampleCode();
</script>

<style scoped lang="scss">
.editor {
  height: 200px;
  width: 100%;
  margin: 0;
}
</style>
