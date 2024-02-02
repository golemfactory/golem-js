import { AbstractAggregator } from "./abstract_aggregator";
import { ProviderInfo } from "../agreement";

export enum AgreementStatusEnum {
  Pending = "pending",
  Confirmed = "confirmed",
  Rejected = "rejected",
}

export interface AgreementInfo {
  id: string;
  proposalId: string;
  provider: ProviderInfo;
  status: AgreementStatusEnum;
}

interface Payload {
  id: string;
  proposalId: string;
  provider: ProviderInfo;
}

export class Agreements extends AbstractAggregator<Payload, AgreementInfo> {
  beforeAdd(payload: AgreementInfo): AgreementInfo {
    return { ...payload, status: AgreementStatusEnum.Pending };
  }
  confirm(id: string) {
    this.updateItemInfo(id, { status: AgreementStatusEnum.Confirmed });
  }
  reject(id: string) {
    this.updateItemInfo(id, { status: AgreementStatusEnum.Rejected });
  }
  getByProviderId(providerId: string) {
    return this.getByField("provider.id", providerId);
  }
  getByProposalId(proposalId: string) {
    return this.getByField("proposalId", proposalId).first();
  }
  getByStatus(status: AgreementStatusEnum) {
    return this.getByField("status", status);
  }
}
