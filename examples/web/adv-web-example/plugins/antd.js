import { defineNuxtPlugin } from "#app";
import "ant-design-vue/dist/antd.css";
import Antd from "ant-design-vue";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(Antd);
});
