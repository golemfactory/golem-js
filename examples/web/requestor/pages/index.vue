<template>
  <div class="home">
    <h1>Run code on the <NuxtLink to="https://golem.network">Golem Network</NuxtLink></h1>
    <h5>Run code without provisioning or managing infrastructure. Simply write and execute code on distributed Golem Network.</h5>
    <video class="script" src="~/assets/video/script.mp4" autoplay loop></video>
    <div class="buttons">
      <NuxtLink v-slot="{ navigate }" to="/task" custom>
        <el-button size="large" class="btn-task" @click="navigate"
          ><span>Just RUN<br /><i>(Task API)</i></span></el-button
        >
      </NuxtLink>
      <NuxtLink v-slot="{ navigate }" to="/mid" custom>
        <el-button size="large" class="btn-mid" plain @click="navigate"
          ><span>Set and control each step manually<br /><i>(Mid-level API)</i></span></el-button
        >
      </NuxtLink>
    </div>
  </div>
</template>
<script setup>
import { useConfigStore } from "~/store/config.js";
const configStore = useConfigStore();
configStore.title = '';
</script>

<style scoped lang="scss">
.home {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 170px);
}
h1 {
  font-size: 2.8rem;
  line-height: 3.5rem;
  text-align: center;
  margin: 30px 0 0px;

  a {
    color: #75afe1;
    text-decoration: none;
  }
}
h5 {
  margin-bottom: 60px;
  font-size: 1rem;
  font-weight: 100;
}
.script {
  height: 300px;
  padding-bottom: 30px;
}
.buttons {
  min-width: 530px;
  display: flex;
  justify-content: space-between;
  padding-bottom: 30px;
  button {
    flex-direction: column;
    line-height: 1.4rem;
    font-size: 1rem;
    height: 70px;
    i {
      font-style: italic;
      font-size: 0.7rem;
    }
  }
  .btn-task {
    min-width: 200px;
    color: white;
    background: #58a51b;
    border-color: #58a51b;
  }
  .btn-mid {
    background: #26242f;
    color: darkorange;
    border-color: darkorange;
  }
}
</style>
