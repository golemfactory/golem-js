<template>
  <el-row :gutter="40">
    <el-col :span="10">
      <Options :options=demandOptions />
      <el-button class="btn-run" size="small" type="success" @click="createDemand">Create Demand</el-button>
      <el-tabs class="editor-tabs" v-model="codeTab">
        <el-tab-pane label="Your Code" name="code">
          <MonacoEditor class="editor" v-model="code" lang="javascript" :options="monacoOptions"/>
        </el-tab-pane>
      </el-tabs>
      <el-tabs v-model="activeResults" class="results-tabs">
        <el-tab-pane v-loading="loading" label="Output" name="output">
          <Output :output="stdout"></Output>
        </el-tab-pane>
        <el-tab-pane label="Errors" name="errors">
          <Output :output="stderr"></Output>
        </el-tab-pane>
        <el-tab-pane label="Logs" name="logs">
          <Output :output="logs" class="logs"></Output>
        </el-tab-pane>
      </el-tabs>
    </el-col>
    <el-col :span="14">
      <Steps />
      <el-tabs v-model="activeEntity" class="entities-tabs">
        <el-tab-pane label="Demands" name="demands"><Demands :actions="true" /></el-tab-pane>
        <el-tab-pane label="Offers" name="offers">
          <Offers @respond="respondOffer" @reject="rejectOffer" @confirm="createAgreement" :actions="true" />
        </el-tab-pane>
        <el-tab-pane label="Agreements" name="agreements"><Agreements :actions="true"/></el-tab-pane>
        <el-tab-pane label="Activities" name="activities"><Activities :actions="true"/></el-tab-pane>
        <el-tab-pane label="Payments" name="payments"><Payments :actions="true"/></el-tab-pane>
      </el-tabs>
      <Stats/>
    </el-col>
  </el-row>
  <Offer offer-drawer="offerDrawer" offer="offer"/>
</template>

<script setup>
import { Accounts, Allocation, Demand, Package, DemandEventType, Agreement } from "../../../../dist/yajsapi.min.js";
import Stats from "~/components/Stats.vue";
import Options from "~/components/Options.vue";
import Offers from "~/components/Offers.vue";
const { $eventTarget: eventTarget } = useNuxtApp()

const monacoOptions = {
  theme: 'vs-dark',
  minimap: {
    enabled: false
  }
}

const demandOptions = reactive({});
const agreementOptions = reactive({});
const activityOptions = reactive({});
const paymentOptions = reactive({});

const activeResults = ref('output');
const activeEntity = ref('offers');
const codeTab = ref('code');
const code = ref('const message = "Hello World from Golem Network !!!";\n' +
  'console.log(message);\n\n' +
  'const task = () => {\n' +
  '    // do some computations on remote machine\n' +
  '    return "results";\n' +
  '}\n' +
  'console.log(task());');

const stdout = ref(">");
const stderr = ref("No errors");
const logs = ref("No logs (todo)");
const loading = ref(false);

const appendLog = (msg) => {
  logs.value += msg + "\n";
}

const logger = {
  log: (msg) => appendLog(`[${new Date().toLocaleTimeString()}] ${msg}`),
  warn: (msg) => appendLog(`[${new Date().toLocaleTimeString()}] [warn] ${msg}`),
  debug: (msg) => appendLog(`[${new Date().toLocaleTimeString()}] [debug] ${msg}`),
  error: (error) => {
    appendLog(`[${new Date().toLocaleTimeString()}] [error] ${error?.response?.data?.message || error}`);
    stderr.value += error?.response?.data?.message || error
  },
  info: (msg) => appendLog(`[${new Date().toLocaleTimeString()}] [info] ${msg}`)
}
const accounts = new Map();
const allocations = new Map();
const demands = new Map();
const proposals = new Map();
const offers = new Map();
const agreements = new Map();
const activities = new Map();
const debitNotes = new Map();
const invoices = new Map();

const tmpOptions = {
  yagnaOptions: {
    basePath: 'http://127.0.0.1:7465',
    apiKey: '411aa8e620954a318093687757053b8d'
  },
  imageHash: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
  logger,
  subnetTag: 'public',
  eventTarget
}

let platform;

const createDemand = async () => {
  const taskPackage = await Package.create(tmpOptions);
  const accounts = await (await Accounts.create(tmpOptions)).list();
  const account = accounts.find((account) => account?.platform.indexOf("erc20") !== -1);
  if (!account) throw new Error("There is no available account");
  platform = account.platform;
  const allocation = await Allocation.create({ ...tmpOptions, account });
  const demand = await Demand.create(taskPackage, [allocation], tmpOptions);
  demands.set(demand.id, demand);
  demand.addEventListener(DemandEventType, async (event) => {
    if (event.proposal.isInitial()) {
      proposals.set(event.proposal.id, event.proposal);
    } else if (event.proposal.isDraft()) {
      offers.set(event.proposal.id, event.proposal);
    }
  })
}
const respondOffer = async (id) => {
  console.log({platform});
  const proposal = proposals.get(id);
  await proposal.respond(platform);
  console.log('RESPONSE', id);
}
const rejectOffer = async (id) => {
  const proposal = proposals.get(id);
  await proposal.respond();
  console.log('REJECT', id);
}

const createAgreement = async (offerId) => {
  const agreement = await Agreement.create(offerId, tmpOptions)
  agreements.set(agreement.id, agreement);
}
</script>

<style scoped lang="scss">
.btn-run {
  position: absolute;
  left: calc(40% - 45px);
  margin-top: 10px;
  z-index: 999;
}
.editor {
  height: 200px;
  width: 100%;
  margin: 0;
}
.entities-tabs {
  margin-top: 10px;
  margin-bottom: 30px;
}
</style>
