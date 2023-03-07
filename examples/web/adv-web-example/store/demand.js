import { defineStore } from "pinia";

export const useDemandStore = defineStore("demand", {
  state: () => ({
    allocation: null,
    demand: null,
    taskPackage: null,
    account: null,
  }),
});
