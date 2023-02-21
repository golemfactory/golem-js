<template>
  <el-card>
    <h1>Run your Lambda on Golem Network</h1>
    <div>
      <NuxtLink v-slot="{ navigate }" to="/simple" custom>
        <el-button type="primary" @click="navigate">Simple way</el-button>
      </NuxtLink>
      <NuxtLink v-slot="{ navigate }" to="/advanced" custom>
        <el-button type="success" @click="navigate">Advanced way</el-button>
      </NuxtLink>
    </div>
  </el-card>
</template>
