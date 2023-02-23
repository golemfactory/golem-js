// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    // head
    head: {
      title: "Advanced web example",
      meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
      link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.png" }],
    },
  },

  // css
  css: ["~/assets/scss/index.scss"],
  modules: ["nuxt-monaco-editor", "@element-plus/nuxt", "@nuxtjs/google-fonts"],
  googleFonts: {
    download: true,
    inject: true,
    families: {
      "Noto+Sans": true,
    },
  },

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
    icon: "ElIcon",
    importStyle: "scss",
    themes: ["dark"],
  },
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@use "@/assets/scss/element/index.scss" as element;`,
        },
      },
    },
  },
});
