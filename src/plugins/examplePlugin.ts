import { MarketApi } from "ya-ts-client";
import { GolemPlugin, registerGlobalPlugin } from "./pluginManager";
import { LocalPluginManager } from "./localPluginManager";

// plugin that will be registered globally
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

// plugin that will be registered on a particular demand instead of globally
const cpuArchitecturePlugin: GolemPlugin = {
  name: "cpuArchitecturePlugin",
  version: "1.0.0",
  register(golem) {
    golem.market.registerHook("beforeDemandPublished", (demand) => {
      demand.properties["golem.com.cpu.architecture"] = "x86_64";
      return demand;
    });
  },
};

registerGlobalPlugin(linearPricingOnlyPlugin);

class ExampleDemandManager {
  private pluginManager = new LocalPluginManager();
  constructor(plugins?: GolemPlugin[]) {
    if (plugins) {
      plugins.forEach((plugin) => this.pluginManager.registerPlugin(plugin));
    }
  }

  async publish() {
    let demand: MarketApi.DemandDTO = {
      properties: {},
    } as MarketApi.DemandDTO;

    const hooks = this.pluginManager.getHooks("beforeDemandPublished");
    for (const hook of hooks) {
      demand = await hook(demand);
    }
    this.pluginManager.emitEvent("demandPublished", demand);
    return demand;
  }
}

const demandManager0 = new ExampleDemandManager([cpuArchitecturePlugin]);
const demandManager1 = new ExampleDemandManager();

const demandWithCpuArchitecture = await demandManager0.publish();
const demandWithOnlyLinearPricing = await demandManager1.publish();

console.log(demandWithCpuArchitecture);
console.log(demandWithOnlyLinearPricing);
