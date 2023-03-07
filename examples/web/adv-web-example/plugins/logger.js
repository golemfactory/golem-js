import { defineNuxtPlugin } from "nuxt/app";
import { useConfigStore } from "~/store/config.js";

export default defineNuxtPlugin((nuxtApp) => {
  const configStore = useConfigStore(nuxtApp.$pinia);
  const appendLog = (msg) => {
    configStore.logs += msg + "\n";
  };

  const logger = {
    log: (msg) => appendLog(`[${new Date().toLocaleTimeString()}] ${msg}`),
    warn: (msg) => appendLog(`[${new Date().toLocaleTimeString()}] [warn] ${msg}`),
    debug: (msg) => appendLog(`[${new Date().toLocaleTimeString()}] [debug] ${msg}`),
    error: (error) => {
      appendLog(`[${new Date().toLocaleTimeString()}] [error] ${error?.response?.data?.message || error}`);
      configStore.stderr += error?.response?.data?.message || error;
    },
    info: (msg) => appendLog(`[${new Date().toLocaleTimeString()}] [info] ${msg}`),
  };
  return {
    provide: {
      logger: console,
    },
  };
});
