import { ProposalDetails } from "../market/proposal";
import { PackageDetails } from "../package/package";

/**
 * Global Event Type with which all API events will be emitted. It should be used on all listeners that would like to handle events.
 */
export const EventType = "GolemEvent";

// Temporary polyfill
// It is now implemented natively only for nodejs 19 and newest browsers
// https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent
// https://github.com/nodejs/node/issues/40678
class CustomEvent<DataType> extends Event {
  readonly detail: DataType;
  readonly name: string;
  constructor(type, data) {
    super(type, data);
    this.detail = data.detail;
    this.name = this.constructor.name;
  }
}

export abstract class BaseEvent<DataType> extends CustomEvent<DataType> {
  constructor(data?: DataType) {
    super(EventType, { detail: data });
  }
}

export class ComputationStarted extends BaseEvent<undefined> {}
export class ComputationFinished extends BaseEvent<undefined> {}
export class ComputationFailed extends BaseEvent<{ reason?: string }> {}
export class TaskStarted extends BaseEvent<{ id: string; agreementId: string; activityId: string }> {}
export class TaskRedone extends BaseEvent<{ id: string; retriesCount: number }> {}
export class TaskRejected extends BaseEvent<{ id: string; reason?: string }> {}
export class TaskFinished extends BaseEvent<{ id: string }> {}
export class AllocationCreated extends BaseEvent<{ id: string; amount: number; platform?: string }> {}
export class SubscriptionCreated extends BaseEvent<{ id: string }> {}
export class SubscriptionFailed extends BaseEvent<{ reason?: string }> {}
export class CollectFailed extends BaseEvent<{ id: string; reason?: string }> {}
export class ProposalReceived extends BaseEvent<{ id: string; providerId: string; details: ProposalDetails }> {}
export class ProposalRejected extends BaseEvent<{ id: string; providerId: string; reason?: string }> {}
export class ProposalResponded extends BaseEvent<{ id: string; providerId: string; parentId: string | null }> {}
export class ProposalConfirmed extends BaseEvent<{ id: string; providerId: string }> {}
export class PackageCreated extends BaseEvent<{ imageHash: string; details: PackageDetails }> {}
export class AgreementCreated extends BaseEvent<{
  id: string;
  providerId: string;
  providerName: string;
  proposalId: string;
}> {}
export class AgreementConfirmed extends BaseEvent<{ id: string; providerId: string }> {}
export class AgreementRejected extends BaseEvent<{ id: string; providerId: string; reason?: string }> {}
export class AgreementTerminated extends BaseEvent<{ id: string; providerId: string; reason?: string }> {}
export class InvoiceReceived extends BaseEvent<{
  id: string;
  providerId: string;
  agreementId: string;
  amount: string; // It is coming as a string
}> {}
export class DebitNoteReceived extends BaseEvent<{
  id: string;
  agreementId: string;
  amount: string; // It is coming as a string
}> {}
export class PaymentAccepted extends BaseEvent<{
  id: string;
  providerId: string;
  agreementId: string;
  amount: string; // It is coming as a string
}> {}
export class PaymentFailed extends BaseEvent<{ id: string; agreementId: string; reason?: string }> {}
export class ActivityCreated extends BaseEvent<{ id: string; agreementId: string }> {}
export class ActivityDestroyed extends BaseEvent<{ id: string; agreementId: string }> {}
export class ScriptSent extends BaseEvent<{ activityId: string; agreementId: string }> {}
export class ScriptExecuted extends BaseEvent<{ activityId: string; agreementId: string; success: boolean }> {}
