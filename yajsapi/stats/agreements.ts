import { AbstractAggregator } from "./abstract_aggregator";

export enum AgreementStatusEnum {
  Pending = "pending",
  Confirmed = "confirmed",
  Rejected = "rejected",
}

export interface AgreementInfo {
  id: string;
  providerId: string;
  status: AgreementStatusEnum;
}

interface Payload {
  id: string;
  providerId: string;
}

export class Agreements extends AbstractAggregator<Payload, AgreementInfo> {
  beforeAdd(payload): AgreementInfo {
    return { ...payload, status: AgreementStatusEnum.Pending };
  }
  confirm(id: string) {
    this.updateItemInfo(id, { status: AgreementStatusEnum.Confirmed });
  }
  reject(id: string) {
    this.updateItemInfo(id, { status: AgreementStatusEnum.Rejected });
  }
}
