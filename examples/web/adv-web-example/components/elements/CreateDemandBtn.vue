<template>
  <el-button class="btn-run" size="small" type="success" @click="createDemand">Create Demand</el-button>
</template>
<script setup>
const { $eventTarget: eventTarget, $logger: logger } = useNuxtApp();
import { useConfigStore } from "~/store/config";
import { useProposalsStore } from "~/store/proposals";
import { Accounts, Allocation, Demand, Package, DemandEventType } from "../../../../../dist/yajsapi.min.js";

const createDemand = async () => {
  const configStore = useConfigStore();
  const options = { ...configStore.options, logger, eventTarget };

  const taskPackage = await Package.create(options);
  const accounts = await (await Accounts.create(options)).list();
  const account = accounts.find((account) => account?.platform.indexOf("erc20") !== -1);
  if (!account) throw new Error("There is no available account");
  let platform = account.platform;
  const allocation = await Allocation.create({ ...options, account });
  const demand = await Demand.create(taskPackage, [allocation], options);
  demand.addEventListener(DemandEventType, async (event) => {
    useProposalsStore().add(event.proposal);
  });
};
</script>
