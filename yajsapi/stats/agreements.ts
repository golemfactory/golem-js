import { AbstractAggregator } from './abstract_aggregator.js';

export enum AgreementStatusEnum {
  Pending = "pending",
  Confirmed = "confirmed",
  Rejected = "rejected",
}

export interface AgreementInfo {
  id: string;
  providerId: string;
  proposalId: string;
  status: AgreementStatusEnum;
}

interface Payload {
  id: string;
  providerId: string;
  proposalId: string;
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
  getByProviderId(providerId: string) {
    return this.getByField("providerId", providerId);
  }
  getByProposalId(proposalId: string) {
    return this.getByField("proposalId", proposalId).first();
  }
  getByStatus(status: AgreementStatusEnum) {
    return this.getByField("status", status);
  }
}
