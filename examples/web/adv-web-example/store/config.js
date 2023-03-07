import { defineStore } from "pinia";

export const useConfigStore = defineStore("options", () => {
  return {
    options: {
      imageHash: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
      yagnaOptions: {
        apiKey: "30c59fef7d8c4639b62d576bfb624e1a",
        basePath: "http://127.0.0.1:7465",
      },

      taskTimeout: 120,
      offerTimeout: 120,
      offerInterval: 2,
      resultInterval: 2,
      budget: 1,
      subnetTag: "public",

      minCpuThreads: 1,
      minStorageGib: 1,
      minMemGib: 1,
    },
    stdout: ">",
    stderr: "No errors",
    logs: "No logs",
    currentStep: 0,
    code:
      'const message = "Hello World from Golem Network !!!";\n' +
      "console.log(message);\n\n" +
      "const task = () => {\n" +
      "    // do some computations on remote machine\n" +
      '    return "results";\n' +
      "}\n" +
      "console.log(task());",
    monacoEditorOptions: {
      theme: "vs-dark",
      minimap: {
        enabled: false,
      },
    },
  };
});
