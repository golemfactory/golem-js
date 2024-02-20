import { GolemDeployment, GolemDeploymentEvents, GolemService } from "./deployment";
import { GolemError } from "../../error/golem-error";
import { EventEmitter } from "eventemitter3";
import { GolemLocalService } from "./local-service";

export class LocalDeployment implements GolemDeployment {
  readonly events = new EventEmitter<GolemDeploymentEvents>();

  private serviceMap = new Map<string, GolemLocalService>();

  cancel(): Promise<void> {
    return Promise.resolve(undefined);
  }

  listServices(): string[] {
    return [];
  }

  service(name: string): GolemService {
    const pool = this.serviceMap.get(name) as GolemService;
    if (!pool) {
      throw new GolemError(`Service ${name} not found`);
    }

    return pool;
  }

  start(): Promise<void> {
    return Promise.resolve(undefined);
  }

  status(): string {
    return "";
  }

  stop(): Promise<void> {
    return Promise.resolve(undefined);
  }
}
