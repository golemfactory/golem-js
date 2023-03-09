import { defineStore } from "pinia";
// import { ref } from "vue";

const initStore = {
  imageHash: "3ddb225352af0c2f44dfa9d5b59b4f197670aac73bdd323d137751dc",
  yagnaOptions: {
    apiKey: "30c59fef7d8c4639b62d576bfb624e1a",
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
  allocationExpires: 1000 * 60 * 30,
  maxInvoiceEvents: 10,
  maxDebitNotesEvents: 10,
  invoiceFetchingInterval: 2000,
  debitNotesFetchingInterval: 2000,
  paymentRequestTimeout: 10000,
  expires: 1000 * 60 * 30,
};

export const useConfigStore = defineStore("options", () => {
  const pythonImages = [
    "e1d53511476b7eb7e6798399a163e164e2acb0eed84e8ecd87b1b282",
    "9b5145c5e53f17455d86d48f847b890688dbf3f0dd9cd6bec689a396",
  ];
  const images = [
    {
      value: "95ded44210ead403d60293bf93223225792aa7b0d6b29df709c52d15",
      label: "Node.js 10.24.1",
    },
    {
      value: "599e0b314534bad5406c927756d916f68e716de110a4131c43a652d7",
      label: "Node.js 12.12.12",
    },
    {
      value: "e64a1653aaec30846fd0ff1fa7c23b98ea92e93f6cb2340c21eb160b",
      label: "Node.js 16.19.1",
    },
    {
      value: "2c963f73d29af0fa450a13bb9d7e916569f1dd136e9ca2f9cfd94331",
      label: "Node.js 18.15.0",
    },
    {
      value: "3ddb225352af0c2f44dfa9d5b59b4f197670aac73bdd323d137751dc",
      label: "Node.js 19.7.0",
    },
    {
      value: "e1d53511476b7eb7e6798399a163e164e2acb0eed84e8ecd87b1b282",
      label: "Python 3.9.16",
    },
    {
      value: "9b5145c5e53f17455d86d48f847b890688dbf3f0dd9cd6bec689a396",
      label: "Python 3.11.2",
    },
    {
      value: "todo",
      label: "Custom - Dockerfile (not yet implemented)",
      disabled: true,
    },
  ];
  const $reset = () => (options.value = initStore);

  const options = ref(initStore);
  const command = () =>
    pythonImages.includes(options.value.imageHash) ? "/usr/local/bin/python3" : "/usr/local/bin/node";
  const commandArg = () => (pythonImages.includes(options.value.imageHash) ? "-c" : "-e");
  const lang = () => (pythonImages.includes(options.value.imageHash) ? "python" : "javascript");
  const exampleCode = () =>
    !pythonImages.includes(options.value.imageHash)
      ? 'const message = "Hello World from Golem Network !!!";\n' +
        "console.log(message);\n\n" +
        "const task = () => {\n" +
        "    // do some computations on remote machine\n" +
        '    return "results";\n' +
        "}\n" +
        "console.log(task());"
      : 'message = "Hello World from Golem Network !!!"\n' +
        "print(message)\n\n" +
        "def task():\n" +
        "    # do some computations on remote machine\n" +
        '    return "results"\n\n' +
        "print(task())";
  return {
    $reset,
    images,
    options,
    command,
    commandArg,
    lang,
    activeControlActions: false,
    stdout: "",
    stdoutLoading: false,
    stderr: "",
    logs: "",
    currentStep: 0,
    code: "",
    exampleCode,
    title: "",
    monacoEditorOptions: {
      theme: "vs-dark",
      minimap: {
        enabled: false,
      },
    },
  };
});
