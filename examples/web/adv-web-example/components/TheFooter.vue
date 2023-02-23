<template>
  <el-row class="footer-row" justify="space-between" align="middle">
    <el-col :span="6">Copyright © 2023 Golem Factory GmbH </el-col>
    <el-col :span="6" class="right">Made with ❤ in Golem Factory</el-col>
  </el-row>
</template>

<style>
.el-footer {
  background: var(--el-color-primary);
  font-size: 0.8rem;
  position: absolute;
  bottom: 0;
  width: 100vw;
}
.footer-row {
  height: 100%;
}
.right {
  text-align: right;
}
</style>
