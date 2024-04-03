import { GolemAbortError, GolemUserError } from "../../error/golem-error";
import { defaultLogger, Logger, YagnaApi } from "../../utils";
import { EventEmitter } from "eventemitter3";
import { ActivityPool } from "./pool";

export enum DeploymentState {
  INITIAL = "INITIAL",
  STARTING = "STARTING",
  READY = "READY",
  STOPPING = "STOPPING",
  STOPPED = "STOPPED",
  ERROR = "ERROR",
}

export interface DeploymentEvents {
  /**
   * Fires when backend is started.
   */
  ready: () => void;

  /**
   * Fires when a new instance encounters an error during initialization.
   * @param error
   */
  // activityInitError: (error: ActivityInitError) => void;

  /**
   * Fires when backend is about to be stopped.
   */
  beforeEnd: () => void;

  /**
   * Fires when backend is completely terminated.
   */
  end: () => void;
}

interface DeploymentOptions {
  // TODO
  logger?: Logger;
  abortController?: AbortController;
  api: {
    key: string;
    url: string;
  };
}

/**
 * @experimental This feature is experimental!!!
 */
export class Deployment {
  readonly events = new EventEmitter<DeploymentEvents>();

  private state: DeploymentState = DeploymentState.INITIAL;

  private readonly logger: Logger;
  private readonly abortController: AbortController;

  private readonly yagnaApi: YagnaApi;

  private readonly activityPools = new Map<string, ActivityPool>();

  // private readonly networks: Network[] = [];
  // private readonly managedNetwork?: Network;

  constructor(private readonly options: DeploymentOptions) {
    this.logger = options.logger ?? defaultLogger("deployment");
    this.abortController = options.abortController ?? new AbortController();

    this.abortController.signal.addEventListener("abort", () => {
      this.logger.info("Abort signal received");
      this.stop().catch((e) => {
        this.logger.error("stop() error on abort", { error: e });
        // TODO: should the error be sent to event listener?
      });
    });

    this.yagnaApi = new YagnaApi({
      apiKey: options.api.key,
      basePath: options.api.url,
    });

    // TODO
  }

  getState(): DeploymentState {
    return this.state;
  }

  async start() {
    if (this.abortController.signal.aborted) {
      throw new GolemAbortError("Calling start after abort signal received");
    }

    if (this.state != DeploymentState.INITIAL) {
      throw new GolemUserError(`Cannot start backend, expected backend state INITIAL, current state is ${this.state}`);
    }

    // TODO

    this.events.emit("ready");
  }

  async stop() {
    if (this.state != DeploymentState.READY) {
      return;
    }

    this.state = DeploymentState.STOPPING;
    this.events.emit("beforeEnd");

    // TODO: consider if we should catch and ignore individual errors here in order to release as many resource as we can.
    try {
      // Call destroyInstance() on all active instances
      const promises: Promise<void>[] = Array.from(this.activityPools.values()).map((pool) => pool.stop());
      await Promise.allSettled(promises);

      // TODO

      this.state = DeploymentState.STOPPED;
    } catch (e) {
      this.state = DeploymentState.ERROR;
      throw e;
    }

    this.events.emit("end");
  }

  getActivityPool(name: string): ActivityPool {
    const pool = this.activityPools.get(name);
    if (!pool) {
      throw new GolemUserError(`ActivityPool ${name} not found`);
    }
    return pool;
  }
}
