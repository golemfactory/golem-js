import { EventEmitter } from "eventemitter3";

export interface NetworkEvents {}

export interface NetworkModule {
  events: EventEmitter<NetworkEvents>;
}

export class NetworkModuleImpl implements NetworkModule {
  events: EventEmitter<NetworkEvents> = new EventEmitter<NetworkEvents>();
}
