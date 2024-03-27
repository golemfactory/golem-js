import { MarketApi } from "ya-ts-client";
import { GlobalPluginManager, GolemPlugin, registerGlobalPlugin } from "./globalPluginManager";

const linearPricingOnlyPlugin: GolemPlugin = {
  name: "linearPricingOnlyPlugin",
  version: "1.0.0",
  register(golem) {
    golem.market.registerHook("beforeDemandPublished", (demand) => {
      demand.properties["golem.com.pricing.model"] = "linear";
      return demand;
    });

    golem.market.registerHook("filterInitialProposal", (proposal) => {
      if (proposal.properties["golem.com.pricing.model"] !== "linear") {
        return { isAccepted: false, reason: "Invalid pricing model" };
      }
      return { isAccepted: true };
    });

    golem.market.on("demandPublished", (demand) => {
      console.log("demand has been published", demand);
    });
  },
};

registerGlobalPlugin(linearPricingOnlyPlugin);

// inside demand publishing logic
const createDemandDTO = () => ({}) as MarketApi.DemandDTO;
let demand = createDemandDTO();
const hooks = GlobalPluginManager.getHooks("beforeDemandPublished");
for (const hook of hooks) {
  demand = await hook(demand);
}
