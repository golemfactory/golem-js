// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  plugins: [],
  modules: ["nuxt-monaco-editor", "@element-plus/nuxt"],
  monacoEditor: {
    // These are default values:
    dest: "_monaco",
    locale: "en",
    componentName: {
      codeEditor: "monaco-editor",
    },
  },
  elementPlus: {
    /** Options */
  },
});
