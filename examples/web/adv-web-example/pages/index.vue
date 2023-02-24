<template>
  <div class="home">
    <h1>Run JavaScript code<br />on the <NuxtLink to="https://golem.network">Golem Network</NuxtLink></h1>
    <video class="script" src="~/assets/video/script.mp4" autoplay loop></video>
    <div class="buttons">
      <NuxtLink v-slot="{ navigate }" to="/task" custom>
        <el-button size="large" class="btn-task" @click="navigate"
          ><span>Just RUN<br /><i>(Task API)</i></span></el-button
        >
      </NuxtLink>
      <NuxtLink v-slot="{ navigate }" to="/mid-api" custom>
        <el-button size="large" class="btn-mid" plain @click="navigate"
          ><span>Set and control each step manually<br /><i>(Mid-level API)</i></span></el-button
        >
      </NuxtLink>
    </div>
  </div>
</template>
<script>
export default {
  name: "Home",
};
</script>

<style scoped lang="scss">
.home {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
h1 {
  margin: 30px 0;
  font-size: 2.8rem;
  line-height: 3.5rem;
  text-align: center;
  a {
  }
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
