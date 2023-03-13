import { ElNotification } from "element-plus";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.errorHandler = (error, context) => {
    const open = () => {
      ElNotification({
        title: "Error",
        message: error,
        type: "error",
      });
    };
    open();
  };
});
