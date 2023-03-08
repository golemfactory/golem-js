import { defineNuxtPlugin } from "nuxt/app";
import { useConfigStore } from "~/store/config.js";

export default defineNuxtPlugin((nuxtApp) => {
  const configStore = useConfigStore(nuxtApp.$pinia);
  const appendLog = (msg, type) => {
    configStore.logs += `[${new Date().toLocaleTimeString()}] ${type ? "[" + type + "] " : ""}${msg}\n`;
  };
  const logger = {
    log: (msg) => appendLog(msg),
    info: (msg) => appendLog(msg, "info"),
    warn: (msg) => appendLog(msg, "warn"),
    // debug: (msg) => appendLog(msg, "debug"),
    debug: () => null,
    error: (error) => {
      appendLog(error?.response?.data?.message || error, "error");
      configStore.stderr += error?.response?.data?.message || error;
    },
  };
  return {
    provide: {
      logger,
    },
  };
});
