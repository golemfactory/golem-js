<template>
    <el-tabs v-model="activeOptions" class="options-tabs">
      <el-tab-pane label="Options" name="base">
        <el-form>
          <el-row :gutter="20">
          <el-col :span="10">
            <el-form-item label="Image:">
              <el-select v-model="options.image">
                <el-option
                  v-for="item in images"
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
              <el-input v-model="options.appKey" placeholder="Paste your Yagna App Key" />
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
                <el-input v-model="options.apiUrl" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="Subnet:">
                <el-input v-model="options.subnet" />
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
                <el-input-number v-model="options.minStorage" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="10">
            <el-col :span="12">
              <el-form-item label="Min CPU threads">
                <el-input-number v-model="options.minCpu" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="Min Mem (Gb)">
                <el-input-number v-model="options.minMem" />
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
        </el-form>
      </el-tab-pane>
    </el-tabs>
</template>
<script setup>
const activeOptions = ref('base');
defineProps({
  options: {
    image: {
      type: String,
      required: true,
      default: '529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4'
    },
    appKey: {
      type: String,
      required: true
    },
    apiUrl: {
      type: String,
      required: true,
      default: 'http://127.0.0.1:7465'
    }
  }
})
const images = [
  {
    value: 'xxxxx',
    label: 'Node.js 14.19',
  },
  {
    value: 'yyyyy',
    label: 'Node.js 16.12',
  },
  {
    value: '529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4',
    label: 'Node.js 18.14',
  },
  {
    value: 'zzzzz222',
    label: 'Custom - Dockerfile (not yet implemented)',
    disabled: true
  },
];
</script>
