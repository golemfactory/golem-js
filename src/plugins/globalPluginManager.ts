import EventEmitter from "eventemitter3";
import { MarketEvents, MarketHooks, MarketPluginContext } from "./marketPluginContext";

type GolemPluginContext = {
  market: MarketPluginContext;
};
export type GolemPlugin = {
  name: string;
  version: string;
  register(context: GolemPluginContext): void;
};

type AllHooks = MarketHooks; // | DeploymentHooks | PaymentHooks | ...
type AllEvents = MarketEvents; // | DeploymentEvents | PaymentEvents | ...

export class GlobalPluginManager {
  static eventEmitter = new EventEmitter<AllEvents>();
  static hooks = new Map<keyof AllHooks, AllHooks[keyof AllHooks][]>();

  static registerHook<T extends keyof AllHooks>(hookName: T, hook: AllHooks[T]) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    this.hooks.get(hookName)!.push(hook as NonNullable<AllHooks[T]>);
  }

  static registerPlugin(plugin: GolemPlugin) {
    const ctx = {
      market: new MarketPluginContext(
        (eventName, callback) => GlobalPluginManager.eventEmitter.on(eventName, callback),
        (hookName, hook) => GlobalPluginManager.registerHook(hookName, hook),
      ),
      // deployment: ...
      // payment: ...
      // ...
    };
    plugin.register(ctx);
  }
  static getHooks<T extends keyof AllHooks>(hookName: T): AllHooks[T][] {
    return (this.hooks.get(hookName) || []) as AllHooks[T][];
  }
}

export function registerGlobalPlugin(...plugins: GolemPlugin[]) {
  plugins.forEach((plugin) => GlobalPluginManager.registerPlugin(plugin));
}
