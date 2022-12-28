import { AbstractAggregator, ItemInfo } from "./abstract_aggregator";
import { Events } from "../events";

export enum TaskStatusEnum {
  Pending = "pending",
  Finished = "finished",
  Rejected = "rejected",
}

export interface TaskInfo extends ItemInfo {
  agreementId: string;
  activityId: string;
  startTime: number;
  stopTime: number;
  retriesCount: number;
  reason?: string;
  status: TaskStatusEnum;
}

export class Tasks extends AbstractAggregator<Events.TaskStarted, TaskInfo> {
  beforeAdd(event: Events.TaskStarted): TaskInfo {
    return {
      ...event.detail,
      startTime: event.timeStamp,
      stopTime: 0,
      retriesCount: 0,
      status: TaskStatusEnum.Pending,
    };
  }
  retry(event: Events.TaskRedone) {
    const { id, retriesCount } = event.detail;
    this.updateItemInfo(id, { retriesCount });
  }
  reject(event: Events.TaskRejected) {
    const { id, reason } = event.detail;
    this.updateItemInfo(id, { stopTime: event.timeStamp, reason: reason, status: TaskStatusEnum.Rejected });
  }
  finish(event: Events.TaskFinished) {
    const { id } = event.detail;
    this.updateItemInfo(id, { stopTime: event.timeStamp, status: TaskStatusEnum.Finished });
  }
}
