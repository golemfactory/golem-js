// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  plugins: ["@/plugins/antd"],
  modules: ["nuxt-monaco-editor"],
  monacoEditor: {
    // These are default values:
    dest: "_monaco",
    locale: "en",
    componentName: {
      codeEditor: "monaco-editor",
    },
  },
});
