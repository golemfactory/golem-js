import { AbstractAggregator, ItemInfo } from './abstract_aggregator';

export enum TaskStatusEnum {
  Pending = "pending",
  Finished = "finished",
  Rejected = "rejected",
}

export interface TaskInfo extends ItemInfo {
  agreementId: string;
  startTime: number;
  stopTime: number;
  retriesCount: number;
  reason?: string;
  status: TaskStatusEnum;
}

interface Payload {
  id: string;
  agreementId: string;
  startTime: number;
}

export class Tasks extends AbstractAggregator<Payload, TaskInfo> {
  beforeAdd(payload): TaskInfo {
    return {
      ...payload,
      stopTime: 0,
      retriesCount: 0,
      status: TaskStatusEnum.Pending,
    };
  }
  retry(id: string, retriesCount: number) {
    this.updateItemInfo(id, { retriesCount });
  }
  reject(id: string, timeStamp: number, reason?: string) {
    this.updateItemInfo(id, { stopTime: timeStamp, reason: reason, status: TaskStatusEnum.Rejected });
  }
  finish(id: string, timeStamp: number) {
    this.updateItemInfo(id, { stopTime: timeStamp, status: TaskStatusEnum.Finished });
  }
  getByAgreementId(agreementId: string) {
    return this.getByField("agreementId", agreementId);
  }
}
