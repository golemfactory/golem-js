<template>
  <div id="main-layout">
    <el-container>
      <el-header height="50px"><TheHeader /></el-header>
      <el-main><slot /></el-main>
      <el-footer><TheFooter /></el-footer>
    </el-container>
  </div>
</template>
<script setup>
import { useDark } from '@vueuse/core'
const isDark = useDark()
</script>
