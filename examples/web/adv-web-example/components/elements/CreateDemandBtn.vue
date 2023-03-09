<template>
  <el-button class="btn-run" size="small" type="danger" @click="terminateAll" v-if="midLevelStore.isRunning">
    Terminate all
  </el-button>
  <el-button class="btn-run" size="small" type="success" @click="createDemand" v-loading="loading" v-else>
    Create Demand
  </el-button>
</template>
<script setup>
const { $eventTarget: eventTarget, $logger: logger } = useNuxtApp();
import { useConfigStore } from "~/store/config";
import { useMidLevelStore } from "~/store/mid";

import {
  Accounts,
  Allocation,
  Demand,
  Package,
  DemandEventType,
  PaymentEventType,
  InvoiceEvent,
  DebitNoteEvent,
  Payments,
} from "../../../../../dist/yajsapi.min.js";

const configStore = useConfigStore();
const midLevelStore = useMidLevelStore();

logger.setLevel('debug');
const loading = ref(false);

const createDemand = async () => {
  loading.value = true;
  const options = { ...configStore.options, logger, eventTarget };

  configStore.activeControlActions = true;
  try {
    // 1. Create package
    const taskPackage = await Package.create(options);
    midLevelStore.taskPackage = taskPackage;

    // 2. For the example purpose chose any account  with platform erc20
    const accounts = await (await Accounts.create(options)).list();
    const account = accounts.find((account) => account?.platform.indexOf("erc20") !== -1);
    if (!account) throw new Error("There is no available account");
    midLevelStore.account = account;

    // 3. Create allocation on this account
    const allocation = await Allocation.create({ ...options, account });
    midLevelStore.allocation = allocation;
    midLevelStore.allocationId = allocation.id;

    // 4. Create demand and listen for new proposal from the market
    midLevelStore.demand = await Demand.create(taskPackage, [allocation], options);
    midLevelStore.demand.addEventListener(DemandEventType, async (event) => {
      midLevelStore.addProposal(event.proposal);
    });

    // 5. Create payment and listen for new debit notes and invoices
    midLevelStore.payments = await Payments.create(options);
    midLevelStore.payments.addEventListener(PaymentEventType, async (event) => {
      if (event instanceof InvoiceEvent) midLevelStore.addNote(event.invoice);
      else if (event instanceof DebitNoteEvent) midLevelStore.addNote(event.debitNote);
    });
    midLevelStore.isRunning = true;
  } catch (e) {
    throw new Error(`Error occurred when creating demand: ${e.message}`);
  }
  loading.value = false;
};
const terminateAll = async () => {
  const activityPromises = [...midLevelStore.activities].map(([, activity]) => activity.stop());
  await Promise.all(activityPromises).catch(e => {
    console.error(e)
  });
  const agreementPromises = [...midLevelStore.agreements].map(([, agreement]) => agreement.terminate());
  await Promise.all(agreementPromises).catch(e => {
    console.error(e)
  });

  midLevelStore.demand.unsubscribe();
  midLevelStore.isRunning = false;
  setTimeout(async () => {
    midLevelStore.allocation.release();
    midLevelStore.payments.unsubscribe();
    //midLevelStore.$reset();
  }, 3000);
  configStore.currentStep = 0
};
</script>
<style scoped lang="scss">
.btn-run {
  position: absolute;
  right: 20px;
  margin-top: 10px;
  z-index: 999;
  --el-loading-spinner-size: 22px;
  --el-mask-color: rgba(0, 0, 0, 0.4);
}
</style>
