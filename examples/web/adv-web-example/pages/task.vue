<template>
  <el-row :gutter="40">
    <el-col :span="10">
      <Options :options="options" />
      <el-button class="btn-run" size="small" type="success">Run</el-button>
      <el-tabs class="editor-tabs" v-model="codeTab">
        <el-tab-pane label="Your Code" name="code">
          <MonacoEditor class="editor" v-model="code" lang="javascript" :options="monacoOptions"/>
        </el-tab-pane>
      </el-tabs>

      <el-tabs v-model="activeResults" class="results-tabs">
        <el-tab-pane label="Output" name="output">
          <Output :output="stdout"></Output>
        </el-tab-pane>
        <el-tab-pane label="Errors" name="errors">
          <Output :output="stderr"></Output>
        </el-tab-pane>
        <el-tab-pane label="Logs" name="logs">
          <Output :output="logs"></Output>
        </el-tab-pane>
      </el-tabs>
    </el-col>
    <el-col :span="14">
      <el-steps :active="2" align-center>
        <el-step title="Demand" description="Publish demand on the market" />
        <el-step title="Offer" description="Choose best offer" />
        <el-step title="Agreement" description="Confirm agreement with provider" />
        <el-step title="Activity" description="Run your scripts" />
        <el-step title="Payment" description="Accept payments" />
      </el-steps>

      <br/>
      <br/>
      <el-tabs v-model="activeSteps" class="results-tabs">
        <el-tab-pane label="Offers" name="offers">
          <el-table :data="offers" style="width: 100%">
            <el-table-column prop="date" label="Date" width="180" />
            <el-table-column prop="cpu" label="CPU" width="180" />
            <el-table-column prop="mem" label="Mem (Gb)" width="180" />
            <el-table-column prop="storage" label="Storage (Gb)" width="180" />
            <el-table-column prop="state" label="State" />
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="Agreements" name="agreements">Agreements</el-tab-pane>
        <el-tab-pane label="Activities" name="activities">Activities</el-tab-pane>
        <el-tab-pane label="Payments" name="payments">Payments</el-tab-pane>
      </el-tabs>
      <br/>
      <br/>
      <br/>
      <Stats/>
    </el-col>
  </el-row>
</template>

<script setup>
import { TaskExecutor, DemandEventType } from "../../../dist/";
import Stats from "~/components/Stats.vue";
import Options from "~/components/Options.vue";

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
  resultInterval: 2,
  eventTarget
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

const stdout = "Hello World";
const stderr = "No errors";
const logs = "No logs (todo)";

eventTarget.addEventListener(DemandEventType, (event) => {
  console.log(event);
})

const run = async () => {
  const executor = await TaskExecutor.create({ package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae", eventTarget});
  await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  await executor.end();
}

const offers = [
  {
    date: '24.02.2023 10:23:32',
    cpu: 'Intel i5 Core12',
    mem: '4 Gib',
    storage: '2 Tib',
    state: 'draft'
  },
  {
    date: '24.02.2023 10:23:32',
    cpu: 'Intel i5 Core12',
    mem: '4 Gib',
    storage: '2 Tib',
    state: 'draft'
  },
  {
    date: '24.02.2023 10:23:32',
    cpu: 'Intel i5 Core12',
    mem: '4 Gib',
    storage: '2 Tib',
    state: 'draft'
  },
  {
    date: '24.02.2023 10:23:32',
    cpu: 'Intel i5 Core12',
    mem: '4 Gib',
    storage: '2 Tib',
    state: 'draft'
  },
  {
    date: '24.02.2023 10:23:32',
    cpu: 'Intel i5 Core12',
    mem: '4 Gib',
    storage: '2 Tib',
    state: 'draft'
  },
  {
    date: '24.02.2023 10:23:32',
    cpu: 'Intel i5 Core12',
    mem: '4 Gib',
    storage: '2 Tib',
    state: 'draft'
  }
]
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
</style>
