<template>
  <el-button class="btn-run" size="small" type="warning" v-if="demandStore.demand" disabled>
    Demand crated successfully
  </el-button>
  <el-button class="btn-run" size="small" type="success" @click="createDemand" v-loading="loading" v-else>
    Create Demand
  </el-button>
</template>
<script setup>
const { $eventTarget: eventTarget, $logger: logger } = useNuxtApp();
import { useConfigStore } from "~/store/config";
import { useMidLevelStore } from "~/store/mid";
import { useDemandStore } from "~/store/demand";

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
const demandStore = useDemandStore();

const loading = ref(false);

const createDemand = async () => {
  loading.value = true;
  const options = { ...configStore.options, logger, eventTarget };

  configStore.activeControlActions = true;
  try {
    // 1. Create package
    const taskPackage = await Package.create(options);
    demandStore.taskPackage = taskPackage;

    // 2. For the example purpose chose any account  with platform erc20
    const accounts = await (await Accounts.create(options)).list();
    const account = accounts.find((account) => account?.platform.indexOf("erc20") !== -1);
    if (!account) throw new Error("There is no available account");
    demandStore.account = account;

    // 3. Create allocation on this account
    const allocation = await Allocation.create({ ...options, account });
    demandStore.allocation = allocation;

    // 4. Create demand and listen for new proposal from the market
    const demand = await Demand.create(taskPackage, [allocation], options);
    demand.addEventListener(DemandEventType, async (event) => {
      useMidLevelStore().addProposal(event.proposal);
    });
    demandStore.demand = demand;

    // 5. Create payment and listen for new debit notes and invoices
    const payments = await Payments.create(options);
    payments.addEventListener(PaymentEventType, async (event) => {
      useMidLevelStore().addNote(event.invoice);
    });
  } catch (e) {
    throw new Error("Error occurred when creating demand", e.message);
  }
  loading.value = false;
};
</script>
<style scoped lang="scss">
.btn-run {
  position: absolute;
  right: 20px;
  margin-top: 10px;
  z-index: 999;
}
</style>
