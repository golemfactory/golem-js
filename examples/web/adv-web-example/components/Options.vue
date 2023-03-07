<template>
  <el-form>
    <el-tabs v-model="activeTab" class="options-tabs">
      <el-tab-pane label="Image" name="base">
        <el-form-item label="Image:">
          <el-select v-model="options.imageHash">
            <el-option
              v-for="item in images"
              :key="item.value"
              :label="item.label"
              :value="item.value"
              :disabled="item.disabled"
            />
          </el-select>
        </el-form-item>
      </el-tab-pane>
      <el-tab-pane label="Yagna options" name="yagna">
        <el-form-item label="Yagna App Key:">
          <el-input v-model="options.yagnaOptions.apiKey" placeholder="Paste your Yagna App Key" />
        </el-form-item>
        <el-form-item label="Yagna Api Url:">
          <el-input v-model="options.yagnaOptions.basePath" />
        </el-form-item>
        <el-form-item label="Subnet:">
          <el-input v-model="options.subnetTag" />
        </el-form-item>
      </el-tab-pane>
      <el-tab-pane label="Demand" name="demand">
        <el-row :gutter="10">
          <el-col :span="12">
            <el-form-item label="Budget (GLM)">
              <el-input-number v-model="options.budget" />
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
            <el-form-item label="Task timeout (s)">
              <el-input-number v-model="options.taskTimeout" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Offer timeout (s)">
              <el-input-number v-model="options.offerTimeout" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-tab-pane>
      <el-tab-pane label="Payment" name="payment">
        <el-row :gutter="10">
          <el-col :span="12">
            <el-form-item label="Offer interval (s)">
              <el-input-number v-model="options.offerInterval" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Results interval (s)">
              <el-input-number v-model="options.resultInterval" />
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

const activeTab = ref("image");

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
