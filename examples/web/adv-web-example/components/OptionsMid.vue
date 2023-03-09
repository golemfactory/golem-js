<template>
  <el-form label-position="right" label-width="135px">
    <el-tabs v-model="activeTab" class="options-tabs">
      <el-tab-pane label="Yagna options" name="yagna">
        <el-row :gutter="10">
          <el-col :span="14">
            <el-form-item label="Yagna App Key:" label-width="95px">
              <el-input v-model="options.yagnaOptions.apiKey" placeholder="Paste your Yagna App Key" />
            </el-form-item>
          </el-col>
          <el-col :span="10">
            <el-form-item label="Yagna Api Url:" label-width="88px">
              <el-input v-model="options.yagnaOptions.basePath" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-tab-pane>
      <el-tab-pane label="Demand" name="demand">
        <el-row :gutter="10">
          <el-col :span="12">
            <el-form-item label="Image:">
              <el-select v-model="options.imageHash">
                <el-option
                  v-for="item in configStore.images"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                  :disabled="item.disabled"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Subnet:">
              <el-input v-model="options.subnetTag" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="10">
          <el-col :span="12">
            <el-form-item label="Allocation expires (ms)">
              <el-input-number v-model="options.expires" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Min Storage (Gb)">
              <el-input-number v-model="options.minStorageGib" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="10">
          <el-col :span="12">
            <el-form-item label="Min CPU threads">
              <el-input-number v-model="options.minCpuThreads" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Min Mem (Gb)">
              <el-input-number v-model="options.minMemGib" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="10">
          <el-col :span="12">
            <el-form-item label="Offer interval (ms)">
              <el-input-number v-model="options.offerFetchingInterval" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Offer timeout (ms)">
              <el-input-number v-model="options.marketOfferExpiration" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-tab-pane>
      <el-tab-pane label="Agreement" name="agreement">
        <el-row :gutter="10">
          <el-col :span="24">
            <el-form-item label="Agreement creation timeout (ms)" label-width="50%">
              <el-input-number v-model="options.agreementRequestTimeout" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="Agreement approval timeout (ms)" label-width="50%">
              <el-input-number v-model="options.agreementWaitingForApprovalTimeout" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-tab-pane>
      <el-tab-pane label="Activity" name="activity">
        <el-row :gutter="10">
          <el-col :span="24">
            <el-form-item label="Activity creation timeout (ms)" label-width="50%">
              <el-input-number v-model="options.activityRequestTimeout" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="Activity execute timeout (ms)" label-width="50%">
              <el-input-number v-model="options.activityExecuteTimeout" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="Activity fetching results interval (ms)" label-width="50%">
              <el-input-number v-model="options.activityExeBatchResultsFetchInterval" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-tab-pane>
      <el-tab-pane label="Payment" name="payment">
        <el-row :gutter="10">
          <el-col :span="12">
            <el-form-item label="Driver">
              <el-input v-model="options.payment.driver" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Network">
              <el-input v-model="options.payment.network" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="10">
          <el-col :span="12">
            <el-form-item label="Budget (GLM)">
              <el-input-number v-model="options.budget" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Payment timeout (ms)">
              <el-input-number v-model="options.paymentRequestTimeout" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="10">
          <el-col :span="12">
            <el-form-item label="Invoice interval (ms)">
              <el-input-number v-model="options.invoiceFetchingInterval" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Debit notes interval">
              <el-input-number v-model="options.debitNotesFetchingInterval" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="10">
          <el-col :span="12">
            <el-form-item label="Max invoice events">
              <el-input-number v-model="options.maxInvoiceEvents" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Max debit notes events">
              <el-input-number v-model="options.maxDebitNotesEvents" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-tab-pane>
    </el-tabs>
  </el-form>
</template>

<script setup>
import { useConfigStore } from "~/store/config";
const configStore = useConfigStore();
const options = configStore.options;
const activeTab = ref("yagna");

const images = [
  {
    value: "xxxxx",
    label: "Node.js 14.19",
  },
  {
    value: "yyyyy",
    label: "Node.js 16.12",
  },
  {
    value: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
    label: "Node.js 18.14",
  },
  {
    value: "zzzzz222",
    label: "Custom - Dockerfile (not yet implemented)",
    disabled: true,
  },
];
</script>
