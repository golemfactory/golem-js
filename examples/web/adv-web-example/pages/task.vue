<template>
  <el-row :gutter="40">
    <el-col :span="10">
      <Options :options="options" />
      <el-button class="btn-run" size="small" type="success" @click="run">Run</el-button>
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
      <Steps :step="step"/>
      <el-tabs v-model="activeSteps" class="entities-tabs">
        <el-tab-pane label="Offers" name="offers"><Offers :actions="false" /></el-tab-pane>
        <el-tab-pane label="Agreements" name="agreements"><Agreements :actions="false"/></el-tab-pane>
        <el-tab-pane label="Activities" name="activities"><Activities :actions="false"/></el-tab-pane>
        <el-tab-pane label="Payments" name="payments"><Payments :actions="false"/></el-tab-pane>
      </el-tabs>
      <Stats/>
    </el-col>
  </el-row>
  <Offer offer-drawer="offerDrawer" offer="offer"/>
</template>

<script setup>
import { TaskExecutor, EventType } from "../../../../dist/yajsapi.min.js";
import Stats from "~/components/Stats.vue";
import Options from "~/components/Options.vue";
import Offers from "~/components/Offers.vue";
import { useOffersStore } from '~/store/offers'
import { useAgreementsStore } from '~/store/agreements'
import { useActivitiesStore } from '~/store/activities'
import { usePaymentsStore } from '~/store/payments'

const monacoOptions = {
  theme: 'vs-dark',
  minimap: {
    enabled: false
  }
}

const eventTarget = new EventTarget();
const options = reactive({
  image: '529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4',
  apiUrl: 'http://127.0.0.1:7465',
  subnet: 'public',
  budget: 1,
  minStorage: 1,
  minCpu: 2,
  minMem: 1,
  taskTimeout: 120,
  offerTimeout: 120,
  offerInterval: 2,
  resultInterval: 2
});

const activeResults = ref('output');
const activeSteps = ref('offers');
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
const step = ref("");
const loading = ref(false);
const offersStore = useOffersStore();
const agreementsStore = useAgreementsStore();
const activitiesStore = useActivitiesStore();
const paymentsStore = usePaymentsStore();
const { addOffer } = offersStore;
const { addAgreement, updateAgreement } = agreementsStore;
const { addActivity, updateActivity, addScript } = activitiesStore;
const { addPayment, updatePayment } = paymentsStore;

eventTarget.addEventListener(EventType, (event) => {
  if (event.name === 'ComputationStarted') step.value = 'demand';
  else if (event.name === 'SubscriptionCreated') step.value = 'offer';
  else if (event.name === 'ProposalReceived') addOffer(parseOfferFromEvent(event));
  else if (event.name === 'ProposalRejected') addOffer(parseOfferFromErrorEvent(event, 'Rejected'));
  else if (event.name === 'ProposalFailed') addOffer(parseOfferFromErrorEvent(event, 'Failed'));
  else if (event.name === 'AgreementCreated') {
    addOffer(parseOfferFormAgreementEvent(event));
    addAgreement(parseAgreementFromEvent(event, 'Proposal'));
    step.value = 'agreement';
  }
  else if (event.name === 'AgreementConfirmed') updateAgreement(parseAgreementFromEvent(event, 'Approved'));
  else if (event.name === 'AgreementTerminated') updateAgreement(parseAgreementFromEvent(event, 'Terminated'));
  else if (event.name === 'ActivityCreated') {
    addActivity(parseActivityFromEvent(event, 'New'))
    step.value = 'activity';
  }
  else if (event.name === 'ActivityStateChanged') updateActivity(parseActivityFromEvent(event))
  else if (event.name === 'ScriptExecuted') addScript(event.detail.activityId)
  else if (event.name === 'ActivityDestroyed') updateActivity(parseActivityFromEvent(event, 'Terminated'))
  else if (event.name === 'InvoiceReceived') addPayment(parsePaymentsFromEvent(event, 'invoice', 'Received'))
  else if (event.name === 'DebitNoteReceived') addPayment(parsePaymentsFromEvent(event, 'debit-note', 'Received'))
  else if (event.name === 'PaymentAccepted') {
    step.value = 'payment';
    updatePayment(parsePaymentsFromEvent(event, 'invoice', 'Accepted'))
  }
  else if (event.name === 'DebitNoteAccepted') updatePayment(parsePaymentsFromEvent(event, 'debit-note', 'Accepted'))
  else if (event.name === 'PaymentRejected') updatePayment(parsePaymentsFromEvent(event, 'invoice', 'Rejected'))
  else if (event.name === 'DebitNoteRejected') updatePayment(parsePaymentsFromEvent(event, 'debit-note', 'Rejected'))
  else if (event.name === 'ComputationFinished') step.value = 'end';
})

const parseOfferFromEvent = (event) => ({
  ...event.detail,
  ...event.detail.details,
  detail: undefined,
  timestamp: event.timestamp,
});
const parseOfferFromErrorEvent = (event, state) => ({
  ...event.detail,
  ...event.detail.details,
  timestamp: event.timestamp,
  state
})
const parseOfferFormAgreementEvent = (event) => ({
  timestamp: event.timestamp,
  parentId: event.detail.proposalId,
  state: 'Confirmed'
})
const parseAgreementFromEvent = (event, state) => ({
  ...event.detail,
  state,
  timestamp: event.timestamp,
})
const parseActivityFromEvent = (event, state) => ({
  state,
  ...event.detail,
  timestamp: event.timestamp,
})
const parsePaymentsFromEvent = (event, type, state) => ({
  type,
  state,
  ...event.detail,
  timestamp: event.timestamp,
})

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

const run = async () => {
  loading.value = true;
  logs.value = '';
  stdout.value = '';
  stderr.value = '';
  const executor = await TaskExecutor.create({
    package: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
    eventTarget,
    logger,
    yagnaOptions: {
      basePath: 'http://127.0.0.1:7465',
      apiKey: '411aa8e620954a318093687757053b8d'
    }});
  await executor.run(async (ctx) => {
    loading.value = false;
    stdout.value += ((await ctx.run("/usr/local/bin/node", ["-e", code.value])).stdout)
  });
  await executor.end();
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
