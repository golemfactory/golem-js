import EventEmitter from "eventemitter3";
import { MarketEvents, MarketHooks } from "./marketPluginContext";
import { GlobalPluginManager, PluginManager } from "./pluginManager";

/**
 * Plugin manager that will combine local and global plugins.
 * Global plugins should be registered using `GlobalPluginManager`.
 * Global hooks will be executed before local hooks, in order of registration.
 */
export class LocalPluginManager extends PluginManager {
  getHooks<T extends keyof MarketHooks>(hookName: T): MarketHooks[T][] {
    const localHooks = super.getHooks(hookName);
    const globalHooks = GlobalPluginManager.getHooks(hookName);
    return [...globalHooks, ...localHooks];
  }
  public emitEvent<T extends keyof MarketEvents>(
    eventName: T,
    ...args: EventEmitter.ArgumentMap<MarketEvents>[Extract<T, keyof MarketEvents>]
  ): void {
    GlobalPluginManager.emitEvent(eventName, ...args);
    super.emitEvent(eventName, ...args);
  }
}
