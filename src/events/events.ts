import { ProposalDetails } from "../market";
import { PackageDetails } from "../package/package";
import { DemandDetails } from "../market/demand";

import { RequireAtLeastOne } from "../utils/types";
import { ProviderInfo } from "../agreement";
/**
 * Global Event Type with which all API events will be emitted. It should be used on all listeners that would like to handle events.
 */
export const EVENT_TYPE = "GolemEvent";

// Temporary polyfill
// It is now implemented natively only for nodejs 19 and newest browsers
// https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent
// https://github.com/nodejs/node/issues/40678
class CustomEvent<DataType> extends Event {
  readonly detail: DataType;
  readonly name: string;
  readonly timestamp: number;
  constructor(type: string, data: { detail: DataType } & EventInit) {
    super(type, data);
    this.detail = data.detail;
    this.name = this.constructor.name;
    this.timestamp = new Date().valueOf();
  }
}

export abstract class BaseEvent<DataType> extends CustomEvent<DataType> {
  constructor(data: DataType) {
    super(EVENT_TYPE, { detail: data });
  }
}

export class ComputationStarted extends BaseEvent<undefined> {
  constructor() {
    super(undefined);
  }
}
export class ComputationFinished extends BaseEvent<undefined> {
  constructor() {
    super(undefined);
  }
}
export class ComputationFailed extends BaseEvent<{ reason?: string }> {}
export class TaskStarted extends BaseEvent<{
  id: string;
  agreementId: string;
  activityId: string;
  provider: ProviderInfo;
}> {}

/**
 * Represents the situation in which running the task failed for some reason, but it will be retried
 */
export class TaskRedone extends BaseEvent<{
  id: string;
  agreementId?: string;
  provider?: ProviderInfo;
  retriesCount: number;
  /**
   * The activity that was involved
   *
   * This might be not set when there was an issue with starting the activity on the provider
   */
  activityId?: string;
  reason?: string;
}> {}

/**
 * Represents the situation where all attempts to execute the task have been unsuccessful and no further processing
 * will be conducted.
 */
export class TaskRejected extends BaseEvent<{
  id: string;
  agreementId?: string;

  provider?: ProviderInfo;
  /**
   * The activity that was involved when the rejection took place
   *
   * This might be not set when there was an issue with starting the activity on the provider
   */
  activityId?: string;
  reason?: string;
}> {}
export class TaskFinished extends BaseEvent<{ id: string }> {}
export class AllocationCreated extends BaseEvent<{ id: string; amount: number; platform?: string }> {}
export class DemandSubscribed extends BaseEvent<{ id: string; details: DemandDetails }> {}
export class DemandFailed extends BaseEvent<{ reason?: string }> {}
export class DemandUnsubscribed extends BaseEvent<{ id: string }> {}
export class CollectFailed extends BaseEvent<{ id: string; reason?: string }> {}
export class ProposalReceived extends BaseEvent<{
  id: string;
  provider: ProviderInfo;
  parentId: string | null;
  details: ProposalDetails;
}> {}
export class ProposalRejected extends BaseEvent<{
  id: string;
  reason?: string;
  provider?: ProviderInfo;
  parentId: string | null;
}> {}
export class ProposalResponded extends BaseEvent<{
  id: string;
  provider: ProviderInfo;
  counteringProposalId: string;
}> {}
export class ProposalFailed extends BaseEvent<{
  id: string;
  provider: ProviderInfo;
  parentId: string | null;
  reason?: string;
}> {}
export class ProposalConfirmed extends BaseEvent<{ id: string; provider: ProviderInfo }> {}
export class PackageCreated extends BaseEvent<{
  packageReference: RequireAtLeastOne<{
    imageHash: string;
    imageTag: string;
    manifest: string;
  }>;
  details: PackageDetails;
}> {}
export class AgreementCreated extends BaseEvent<{
  id: string;
  provider: ProviderInfo;
  proposalId: string;
  validTo?: string;
}> {}
export class AgreementConfirmed extends BaseEvent<{ id: string; provider: ProviderInfo }> {}
export class AgreementRejected extends BaseEvent<{ id: string; provider: ProviderInfo; reason?: string }> {}
export class AgreementTerminated extends BaseEvent<{ id: string; provider: ProviderInfo; reason?: string }> {}
export class InvoiceReceived extends BaseEvent<{
  id: string;
  provider: ProviderInfo;
  agreementId: string;
  amount: number;
}> {}
export class DebitNoteReceived extends BaseEvent<{
  id: string;
  agreementId: string;
  activityId: string;
  amount: number;
  provider: ProviderInfo;
}> {}
export class PaymentAccepted extends BaseEvent<{
  id: string;
  agreementId: string;
  amount: number;
  provider: ProviderInfo;
}> {}
export class DebitNoteAccepted extends BaseEvent<{
  id: string;
  agreementId: string;
  amount: number;
  provider: ProviderInfo;
}> {}
export class PaymentFailed extends BaseEvent<{ id: string; agreementId: string; reason?: string }> {}
export class ActivityCreated extends BaseEvent<{ id: string; agreementId: string }> {}
export class ActivityDestroyed extends BaseEvent<{ id: string; agreementId: string }> {}
export class ActivityStateChanged extends BaseEvent<{ id: string; state: string }> {}
export class ScriptSent extends BaseEvent<{ activityId: string; agreementId: string }> {}
export class ScriptExecuted extends BaseEvent<{ activityId: string; agreementId: string; success: boolean }> {}
