import { AbstractAggregator } from "./abstract_aggregator";
import { Events } from "../events";

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

export class Agreements extends AbstractAggregator<Events.AgreementCreated, AgreementInfo> {
  beforeAdd(event: Events.AgreementCreated): AgreementInfo {
    const { id, providerId } = event.detail;
    return { id, providerId, status: AgreementStatusEnum.Pending };
  }
  confirm(event: Events.AgreementConfirmed) {
    const { id } = event.detail;
    this.updateItemInfo(id, { status: AgreementStatusEnum.Confirmed });
  }
  reject(event: Events.AgreementRejected) {
    const { id } = event.detail;
    this.updateItemInfo(id, { status: AgreementStatusEnum.Rejected });
  }
}
