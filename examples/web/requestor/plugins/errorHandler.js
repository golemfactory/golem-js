import { ElNotification } from "element-plus";

// eslint-disable-next-line no-undef
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.errorHandler = (error) => {
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
