import EventEmitter from "eventemitter3";

export abstract class PluginContext<
  Hooks extends { [key: string]: (...args: never[]) => unknown },
  Events extends { [key: string]: (...args: never[]) => unknown },
> {
  constructor(
    private registerEventFn: <T extends EventEmitter.EventNames<Events>>(
      eventName: T,
      callback: EventEmitter.EventListener<Events, T>,
    ) => void,
    private registerHookFn: (hookName: keyof Hooks, hook: Hooks[keyof Hooks]) => void,
  ) {}

  registerHook<T extends keyof Hooks>(hookName: T, hook: Hooks[T]) {
    this.registerHookFn(hookName, hook);
  }

  on<T extends EventEmitter.EventNames<Events>>(eventName: T, callback: EventEmitter.EventListener<Events, T>) {
    this.registerEventFn(eventName, callback);
  }
}
