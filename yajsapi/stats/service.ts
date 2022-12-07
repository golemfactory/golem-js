import { Events, EventType, BaseEvent } from "../events";
import { Logger } from "../utils";

interface StatsOptions {
  eventTarget: EventTarget;
  logger?: Logger;
  timeout: number;
}

export class StatsService {
  private eventTarget: EventTarget;
  private logger?: Logger;

  constructor(options: StatsOptions) {
    this.eventTarget = options.eventTarget;
    this.logger = options.logger;
  }

  async run() {
    this.eventTarget.addEventListener(EventType, (event) => this.handleEvents(event as BaseEvent<unknown>));
    this.logger?.info("Stats service has started");
  }

  async end() {
    this.eventTarget.removeEventListener(EventType, null);
    this.logger?.info("Stats service has stopped");
  }

  getProviderInfo(providerId: string) {
    // todo
  }

  getAllCosts() {
    // todo
  }

  getComputationsInfo() {
    // todo
  }

  getTimes() {
    // todo
  }

  private handleEvents(event: BaseEvent<unknown>) {
    if (event instanceof Events.ComputationStarted) {
      console.log("Computation started at time: ", event.detail.startTime);
    }
  }
}
