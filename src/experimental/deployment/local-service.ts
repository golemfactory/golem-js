import {
  GolemActivityEvents,
  GolemService,
  GolemServiceCommands,
  GolemServiceInstance,
  GolemServiceInstanceInfo,
  GolemServiceInstanceState,
} from "./deployment";
import { GolemReplicasSpec, GolemServiceSpec } from "./deployment-types";
import { EventEmitter } from "eventemitter3";
import { Promise } from "cypress/types/cy-bluebird";
import { GolemConfigError } from "../../error/config-error";

class GolemLocalServiceInstance implements GolemServiceInstance {
  readonly events: EventEmitter<GolemActivityEvents>;
  readonly info: GolemServiceInstanceInfo;

  commands(): GolemServiceCommands {
    return undefined;
  }

  getState(): Promise<GolemServiceInstanceState> {
    return Promise.resolve(undefined);
  }

  getWebsocketUrl(port: number): string {
    return "";
  }

  work<R>(worker: (context: GolemServiceCommands) => Promise<R>): Promise<R> {
    return Promise.resolve(undefined);
  }
}

export class GolemLocalService implements GolemService {
  private readonly repicasSpec: GolemReplicasSpec;
  private readonly instances: GolemLocalServiceInstance[] = [];

  constructor(
    private name: string,
    private spec: GolemServiceSpec,
  ) {
    this.repicasSpec = this.configureReplicas(spec);

    this.initInstances();
  }

  private configureReplicas(spec: GolemServiceSpec): GolemReplicasSpec {
    const min = spec.replicas?.min ?? 1;
    const max = spec.replicas?.max ?? min;

    if (min < 1) {
      throw new GolemConfigError("Replicas min must be greater than 0");
    }

    if (max < min) {
      throw new GolemConfigError("Replicas max must be greater or equal to min");
    }

    return {
      min,
      max,
      // acquireTimeoutSec,
      // downscaleIntervalSec,
    };
  }

  private initInstances() {
    for (let i = 0; i < this.repicasSpec.max; i++) {
      this.instances.push(new GolemLocalServiceInstance());
    }
  }

  start(): Promise<void> {
    return Promise.resolve();
  }

  stop(): Promise<void> {
    return Promise.resolve();
  }

  listInstances(): Promise<GolemServiceInstance[]> {
    return Promise.resolve([]);
  }

  acquire(): Promise<GolemServiceInstance> {
    return Promise.resolve(undefined);
  }

  destroy(instance: GolemServiceInstance): Promise<void> {
    return Promise.resolve(undefined);
  }

  release(instance: GolemServiceInstance): Promise<void> {
    return Promise.resolve(undefined);
  }

  async work<R>(worker: (context: GolemServiceCommands) => Promise<R>): Promise<R> {
    const instance = await this.acquire();

    return instance
      .work(worker)
      .then((result: R) => {
        this.release(instance);
        return result;
      })
      .catch((error: Error) => {
        this.destroy(instance);
        throw error;
      });
  }
}
