export const EventType = "GolemEvent";

// Temporary polyfill
// It is now implemented natively only for nodejs 19 and newest browsers
// https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent
// https://github.com/nodejs/node/issues/40678
class CustomEvent<DataType> extends Event {
  readonly detail: DataType;
  constructor(type, data) {
    super(type, data);
    this.detail = data.detail;
  }
}

export abstract class BaseEvent<DataType> extends CustomEvent<DataType> {
  constructor(data: DataType) {
    super(EventType, { detail: data });
  }
}

export class ComputationStarted extends BaseEvent<{ startTime: number }> {}
export class ComputationFinished extends BaseEvent<{ stopTime: number; duration: number }> {}
export class ComputationFailed extends BaseEvent<{ reason?: string }> {}
export class SubscriptionCreated extends BaseEvent<{ id: string }> {}
export class SubscriptionFailed extends BaseEvent<{ reason?: string }> {}
export class CollectFailed extends BaseEvent<{ id: string }> {}
export class NoProposalsConfirmed extends BaseEvent<{ proposalsCount: number; timeout: number }> {}
export class ProposalReceived extends BaseEvent<{ id: string; providerId: string }> {}
export class ProposalRejected extends BaseEvent<{ id: string; providerId: string; reason?: string }> {}
export class ProposalResponded extends BaseEvent<{ id: string; providerId: string }> {}
export class ProposalFailed extends BaseEvent<{ id: string; providerId: string; reason?: string }> {}
export class ProposalConfirmed extends BaseEvent<{ id: string; providerId: string }> {}
export class AgreementCreated extends BaseEvent<{ id: string; providerId: string }> {}
export class AgreementConfirmed extends BaseEvent<{ id: string }> {}
export class AgreementRejected extends BaseEvent<{ id: string; reason?: string }> {}
export class DebitNoteReceived extends BaseEvent<{ id: string; agreementId: string; amount: string }> {}
export class PaymentAccepted extends BaseEvent<{ id: string; agreementId: string; amount: string }> {}
export class PaymentPrepared extends BaseEvent<{ agreementId: string }> {}
export class PaymentFailed extends BaseEvent<{ agreementId: string; reason?: string }> {}
export class PaymentQueued extends BaseEvent<{ agreementId: string }> {}
export class PaymentsFinished extends BaseEvent<null> {}
export class CheckingPayments extends BaseEvent<null> {}
export class InvoiceReceived extends BaseEvent<{ id: string; agreementId: string; amount: string }> {}
export class ActivityCreated extends BaseEvent<{ id: string; agreementId: string }> {}
export class ActivityCreateFailed extends BaseEvent<{ id: string; reason?: string }> {}
export class TaskStarted extends BaseEvent<{ activityId: string; agreementId: string; data?: object }> {}
export class ScriptSent extends BaseEvent<{ activityId: string; agreementId: string; providerId: string }> {}
export class TaskFinished extends BaseEvent<null> {}
export class TaskRejected extends BaseEvent<{ reason?: string }> {}
export class ScriptExecuted extends BaseEvent<{
  activityId: string;
  agreementId: string;
  providerId: string;
  success: boolean;
}> {}
