<template>
  <a-layout id="main-layout">
    <a-layout-header><TheHeader /></a-layout-header>
    <a-layout-content><slot /></a-layout-content>
    <a-layout-footer><TheFooter /></a-layout-footer>
  </a-layout>
</template>
<style lang="scss">
#main-layout {
  min-height: 100vh;
  .intro-card {
    width: 60vw;
    margin: 5vh auto 0 auto;
  }
}
</style>
