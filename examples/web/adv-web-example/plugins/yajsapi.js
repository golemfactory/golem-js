export default defineNuxtPlugin(() => {
  return {
    provide: {
      yajsapihelper: (msg) => `Hello ${msg}!`,
    },
  };
});
