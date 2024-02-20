import { ActivityStateEnum, Result } from "../../activity";
import { RemoteProcess } from "../../task/process";
import { EventEmitter } from "eventemitter3";
import { ProviderInfo } from "../../agreement";
import { GolemError } from "../../error/golem-error";

/**
 * This file contains public API for Golem Deployments.
 */

interface GolemActivityCommandOptions {
  timeout?: number;
  abort?: AbortController;
  env?: Record<string, string>;
}

export interface GolemServiceCommands {
  // All commands throw CommandError when command fails (with result.result == 'Error')

  /**
   * NOTE! Allow plain command is needed!
   * Example use case: await ctx.run("echo -e "${password}\n${password}" | passwd`)
   */
  run(executable: string, args: string[], options?: GolemActivityCommandOptions): Promise<Result>;
  spawn(executable: string, args: string[], options?: GolemActivityCommandOptions): Promise<RemoteProcess>;
  uploadFile(src: string, dst: string, options?: GolemActivityCommandOptions): Promise<Result>;
  uploadJson(json: unknown, dst: string, options?: GolemActivityCommandOptions): Promise<Result>;
  uploadData(data: Uint8Array, dst: string, options?: GolemActivityCommandOptions): Promise<Result>;
  downloadFile(src: string, dst: string, options?: GolemActivityCommandOptions): Promise<Result>;
  downloadData(src: string, options?: GolemActivityCommandOptions): Promise<Result<Uint8Array>>;
  downloadJson(src: string, options?: GolemActivityCommandOptions): Promise<Result>;
  getState(): Promise<ActivityStateEnum>;

  cancelAll(): Promise<void>;
}

export interface GolemActivityEvents {
  /**
   * Fires when activity is started.
   */
  ready: () => void;

  /**
   * Fires when activity encounters an error
   * @param error
   */
  error: (error: Error) => void;

  /**
   * Fires when activity is about to be stopped.
   */
  beforeEnd: () => void;

  /**
   * Fires when activity completely terminated.
   */
  end: () => void;
}

export interface GolemServiceInstanceInfo {
  instanceId: string;
  serviceName: string;
  provider: ProviderInfo;
  agreementId: string;
}

export enum GolemServiceInstanceState {
  /** Instance is not stopped and unavailable for work */
  STOPPED = "stopped",
  /** Instance is currently being started */
  STARTING = "starting",
  /** Instance is ready to work */
  READY = "ready",
  /** Instance is currently being stopped */
  STOPPING = "stopping",
}

export interface GolemServiceInstance {
  readonly events: EventEmitter<GolemActivityEvents>;
  readonly info: GolemServiceInstanceInfo;

  getState(): Promise<GolemServiceInstanceState>;
  commands(): GolemServiceCommands; // should this be async?
  work<R>(worker: (context: GolemServiceCommands) => Promise<R>): Promise<R>;
  getWebsocketUrl(port: number): string;
}

// export interface GolemService {
//   createInstance(): Promise<GolemActivityInstance>;
// }

export interface GolemService {
  // TODO: Add events similar to events in GolemDeployment
  // TODO: State: deploying, ready, stopped, stopping.

  // Service instance is a slot, might have attached activity or not, depending on it's state.
  listInstances(): Promise<GolemServiceInstance[]>;

  // Pool interface:
  acquire(): Promise<GolemServiceInstance>;
  release(instance: GolemServiceInstance): Promise<void>;
  destroy(instance: GolemServiceInstance): Promise<void>;

  work<R>(worker: (context: GolemServiceCommands) => Promise<R>): Promise<R>;
}

//-----------------------------------------
export enum GolemDeploymentState {}

export class ActivityInitError extends GolemError {
  constructor(
    message: string,
    public readonly reason: string,
    public readonly activityInfo: GolemServiceInstanceInfo,
  ) {
    super(message);
  }
}

export interface GolemDeploymentEvents {
  /**
   * Fires when deployment is started.
   */
  ready: () => void;

  /**
   * Fires when deployment encounters an error during ads
   * @param error
   */
  activityInitError: (error: ActivityInitError) => void;

  /**
   * Fires when deployment is about to stopped.
   */
  beforeEnd: () => void;

  /**
   * Fires when deployment completely terminated.
   */
  end: () => void;
}

export interface GolemDeployment {
  // TODO: State: starting, ready, stopped, stopping.
  readonly events: EventEmitter<GolemDeploymentEvents>;

  /**
   * Start all services and resolves only when all services are ready (replicas mins are reached).
   */
  start(): Promise<void>;

  stop(): Promise<void>;
  // Like stop(), but more aggressive?
  cancel(): Promise<void>;
  // Some enum, connected or not, or maybe complex object:
  // { started: boolean, running: boolean, acceptingRequests: boolean  }
  status(): string;

  // The following two don't have to be async, because I'm assuming connecting
  // to requestor agent would return the list, and we discussed this list should
  // not change?.
  service(name: string): GolemService;
  listServices(): string[];
}

/************** How to handle additional events later

export interface GolemLocalDeploymentEvents {
  foo(): void;
  bar(): void;

}

// This will not work, TS will complain that the implementation is incorrect.
export interface GolemDeployment2 extends GolemDeployment {
  readonly events: EventEmitter<GolemDeploymentEvents & GolemLocalDeploymentEvents>;

}
// This will however work. We will need a new events property for additional events,
// however they can share a common object.
let events1: EventEmitter<GolemDeploymentEvents>;
let events2: EventEmitter<GolemLocalDeploymentEvents>;
const events = new EventEmitter<GolemDeploymentEvents & GolemLocalDeploymentEvents>();

events1 = events;
events2 = events;

*/
