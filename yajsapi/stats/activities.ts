import { AbstractAggregator } from "./abstract_aggregator";

export interface ActivityInfo {
  id: string;
  agreementId: string;
  taskId: string;
}

interface Payload {
  id: string;
  taskId: string;
  agreementId: string;
}

export class Activities extends AbstractAggregator<Payload, ActivityInfo> {
  beforeAdd(payload): ActivityInfo {
    return payload;
  }
  getByTaskId(taskId: string) {
    return this.getByField("taskId", taskId);
  }
  getByAgreementId(agreementId: string) {
    return this.getByField("agreementId", agreementId);
  }
}
