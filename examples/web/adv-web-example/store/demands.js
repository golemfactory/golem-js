import { defineStore } from "pinia";

export const useDemandsStore = defineStore("demands-store", {
  state: () => {
    return {
      demands: [],
    };
  },
  actions: {
    add(event) {
      this.demands.push({
        ...event.detail,
        ...event.detail.details,
        detail: undefined,
        details: undefined,
        state: "Subscribed",
        time: new Date(event.timestamp).toLocaleTimeString(),
        subnet: event.detail.details.properties?.find((prop) => prop.key === "golem.node.debug.subnet")?.value,
        account: event.detail.details.properties?.find(
          (prop) => prop.key === "golem.com.payment.platform.erc20-rinkeby-tglm.address"
        )?.value,
      });
      console.log(this.demands[0]);
    },
    unsubscribe(event) {
      const demand = this.demands.find((demand) => demand.id === event.detail.id);
      demand.state = "Unsubscribed";
      demand.time = new Date(event.timestamp).toLocaleTimeString();
    },
    fail(event) {
      const demand = this.demands.find((demand) => demand.id === event.detail.id);
      demand.state = "Failed";
      demand.time = new Date(event.timestamp).toLocaleTimeString();
    },
  },
});
