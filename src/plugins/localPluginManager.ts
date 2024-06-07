import EventEmitter from "eventemitter3";
import { AllEvents, AllHooks, GlobalPluginManager, PluginManager } from "./pluginManager";

/**
 * Plugin manager that will combine local and global plugins.
 * Global plugins should be registered using `GlobalPluginManager`.
 * Global hooks will be executed before local hooks, in order of registration.
 */
export class LocalPluginManager extends PluginManager {
  getHooks<T extends keyof AllHooks>(hookName: T): AllHooks[T][] {
    const localHooks = super.getHooks(hookName);
    const globalHooks = GlobalPluginManager.getHooks(hookName);
    return [...globalHooks, ...localHooks];
  }
  public emitEvent<T extends keyof AllEvents>(
    eventName: T,
    ...args: EventEmitter.ArgumentMap<AllEvents>[Extract<T, keyof AllEvents>]
  ): void {
    GlobalPluginManager.emitEvent(eventName, ...args);
    super.emitEvent(eventName, ...args);
  }
}
