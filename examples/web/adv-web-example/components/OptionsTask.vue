<template>
  <el-tabs v-model="activeTab" class="options-tabs">
    <el-tab-pane label="Options" name="base">
      <el-form>
        <el-row :gutter="20">
          <el-col :span="10">
            <el-form-item label="Image:">
              <el-select v-model="options.imageHash" @change="imageChanged">
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
          <el-col :span="14">
            <el-form-item label="Yagna App Key:">
              <el-input v-model="options.yagnaOptions.apiKey" placeholder="Paste your Yagna App Key" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-tab-pane>
    <el-tab-pane label="Additional options" name="additional">
      <el-form label-position="right" label-width="125px">
        <el-row :gutter="10">
          <el-col :span="12">
            <el-form-item label="Yagna Api Url:">
              <el-input v-model="options.yagnaOptions.basePath" />
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
            <el-form-item label="Task timeout (ms)">
              <el-input-number v-model="options.taskTimeout" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Offer timeout (ms)">
              <el-input-number v-model="options.marketOfferExpiration" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="5">
          <el-col :span="12">
            <el-form-item label="Offer interval (ms)">
              <el-input-number v-model="options.offerFetchingInterval" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Results interval (ms)">
              <el-input-number v-model="options.activityExeBatchResultsFetchInterval" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-tab-pane>
  </el-tabs>
</template>

<script setup>
import { useConfigStore } from "~/store/config";
const configStore = useConfigStore();
const options = configStore.options;
const activeTab = ref("base");

const imageChanged = (newValue) => {
  configStore.determinateLang(newValue);
};
</script>
<style lang="scss">
.options-tabs {
  .el-form-item__label {
    font-size: 0.7rem !important;
  }
}
</style>
