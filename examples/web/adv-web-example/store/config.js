import { defineStore } from "pinia";
// import { ref } from "vue";

export const useConfigStore = defineStore("options", () => {
  return {
    options: {
      imageHash: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
      image: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
      yagnaOptions: {
        apiKey: "411aa8e620954a318093687757053b8d",
        basePath: "http://127.0.0.1:7465",
      },
      taskTimeout: 1000 * 60 * 3,
      marketOfferExpiration: 1000 * 60 * 15,
      offerFetchingInterval: 2_000,
      budget: 1,
      subnetTag: "public",
      minCpuThreads: 1,
      minStorageGib: 1,
      minMemGib: 1,
      agreementRequestTimeout: 30000,
      agreementWaitingForApprovalTimeout: 10000,
      activityRequestTimeout: 10000,
      activityExecuteTimeout: 60000,
      activityExeBatchResultsFetchInterval: 3_000,
      payment: { driver: "erc20", network: "rinkeby" },
      paymentTimeout: 20000,
      allocationExpires: 1000 * 60 * 30, // 30 min
      maxInvoiceEvents: 10,
      maxDebitNotesEvents: 10,
      invoiceFetchingInterval: 2000,
      debitNotesFetchingInterval: 2000,
      paymentRequestTimeout: 10000,
      expires: 1000 * 60 * 30,
    },
    activeControlActions: false,
    stdout: "",
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
