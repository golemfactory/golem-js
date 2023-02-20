<template>
  <a-card class="intro-card" title="Simple usage">
    <a-form
      :model="formState"
      v-bind="layout"
      name="nest-messages"
      :validate-messages="validateMessages"
      @finish="onFinish"
    >
      <a-form-item label="Package" required>
        <a-select v-model:value="formState.image" placeholder="select image">
          <a-select-option :value="image.value" v-for="image in formValues.images">{{ image.label }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="min CPU Cores" required>
        <a-select v-model:value="formState.cores" placeholder="select cpu cores">
          <a-select-option :value="core.value" v-for="core in formValues.cores">{{ core.label }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="Min available RAM" required>
        <a-select v-model:value="formState.memory" placeholder="select RAM">
          <a-select-option :value="memory.value" v-for="memory in formValues.memory">{{
            memory.label
          }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="Min available disk space" required>
        <a-select v-model:value="formState.disk" placeholder="select disk space">
          <a-select-option :value="disk.value" v-for="disk in formValues.memory">{{ disk.label }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="Place your lambda code" required>
        <monaco-editor v-model="formState.lambdaCode" lang="typescript" :style="{ height: '300px' }" />
      </a-form-item>
    </a-form>
  </a-card>
</template>

<script>
import { defineComponent, reactive } from "vue";

export default defineComponent({
  setup() {
    const layout = {
      labelCol: { span: 8 },
      wrapperCol: { span: 16 },
    };

    const validateMessages = {
      required: "${label} is required!",
      types: {
        email: "${label} is not a valid email!",
        number: "${label} is not a valid number!",
      },
      number: {
        range: "${label} must be between ${min} and ${max}",
      },
    };

    const formValues = {
      images: [
        { label: "Node 14.x", value: "node:14" },
        { label: "Node 16.x", value: "node:16" },
        { label: "Node 18.x", value: "node:18" },
        { label: "Python 2.7.x", value: "py:27" },
        { label: "Python 3.6.x", value: "py:36" },
        { label: "Python 3.8.x", value: "py:38" },
      ],
      cores: [
        { label: "1 core", value: "1" },
        { label: "2 cores", value: "2" },
        { label: "4 cores", value: "4" },
        { label: "8 cores", value: "8" },
      ],
      memory: [
        { label: "1 GB", value: "1" },
        { label: "2 GB", value: "2" },
        { label: "4 GB", value: "4" },
        { label: "8 GB", value: "8" },
        { label: "16 GB", value: "16" },
        { label: "32 GB", value: "32" },
        { label: "64 GB", value: "62" },
      ],
      disk: [
        { label: "2 GB", value: "2" },
        { label: "4 GB", value: "4" },
        { label: "8 GB", value: "8" },
        { label: "16 GB", value: "16" },
        { label: "32 GB", value: "32" },
        { label: "64 GB", value: "62" },
        { label: "128 GB", value: "128" },
      ],
    };

    const formState = reactive({
      env: {
        package: null,
      },
      lambdaCode: "",
    });
    const onFinish = (values) => {
      console.log("Success:", values);
    };
    return {
      formState,
      onFinish,
      layout,
      validateMessages,
      formValues,
    };
  },
});
</script>
