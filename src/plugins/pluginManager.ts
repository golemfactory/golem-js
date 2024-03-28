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

export type AllHooks = MarketHooks; // | DeploymentHooks | PaymentHooks | ...
export type AllEvents = MarketEvents; // | DeploymentEvents | PaymentEvents | ...

export class PluginManager {
  private eventEmitter = new EventEmitter<AllEvents>();
  private hooks = new Map<keyof AllHooks, AllHooks[keyof AllHooks][]>();

  private registerHook<T extends keyof AllHooks>(hookName: T, hook: AllHooks[T]) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    this.hooks.get(hookName)!.push(hook as NonNullable<AllHooks[T]>);
  }

  public registerPlugin(plugin: GolemPlugin) {
    const ctx = {
      market: new MarketPluginContext(
        (eventName, callback) => this.eventEmitter.on(eventName, callback),
        (hookName, hook) => this.registerHook(hookName, hook),
      ),
      // deployment: ...
      // payment: ...
      // ...
    };
    plugin.register(ctx);
  }
  public getHooks<T extends keyof AllHooks>(hookName: T): AllHooks[T][] {
    return (this.hooks.get(hookName) || []) as AllHooks[T][];
  }
  public emitEvent<T extends keyof AllEvents>(
    eventName: T,
    ...args: EventEmitter.ArgumentMap<MarketEvents>[Extract<T, keyof MarketEvents>]
  ) {
    this.eventEmitter.emit(eventName, ...args);
  }
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const GlobalPluginManager = new PluginManager();

export function registerGlobalPlugin(...plugins: GolemPlugin[]) {
  plugins.forEach((plugin) => GlobalPluginManager.registerPlugin(plugin));
}
