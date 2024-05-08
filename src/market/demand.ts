import { ActivityDemandDirectorConfigOptions } from "./demand/options";
import { BasicDemandDirectorConfigOptions } from "./demand/directors/basic-demand-director-config";
import { PaymentDemandDirectorConfigOptions } from "./demand/directors/payment-demand-director-config";
import { DemandBodyPrototype } from "./demand/demand-body-builder";

/**
 * This type represents a set of *parameters* that the SDK can set to particular *properties* and *constraints*
 * of the demand that's used to subscribe for offers via Yagna
 */
export interface BasicDemandPropertyConfig {
  /**
   * Specify the name of a subnet of Golem Network that should be considered for offers
   *
   * Providers and Requestors can agree to a subnet tag, that they can put on their Offer and Demands
   * so that they can create "segments" within the network for ease of finding themselves.
   *
   * Please note that this subnetTag is public and visible to everyone.
   */
  subnetTag?: string;

  /**
   * Determines the expiration time of the offer and the resulting activity in milliseconds.
   *
   * The value of this field is used to define how long the demand is valid for yagna to match against.
   * In addition, it will determine how long the resulting activity will be active.
   *
   * For example: if `expirationSec` is set to 10 minutes, the demand was created and starting an activity
   * required 2 minutes, this means that the activity will be running for 8 more minutes, and then will get terminated.
   *
   * **IMPORTANT**
   *
   * It is possible that a provider will reject engaging with that demand if it's configured  without using a deadline.
   *
   * **GUIDE**
   *
   * If your activity is about to operate for 5-30 min, {@link expirationSec} is sufficient.
   *
   * If your activity is about to operate for 30min-10h, {@link debitNotesAcceptanceTimeoutSec} should be set as well.
   *
   * If your activity is about to operate longer than 10h, you need set both {@link debitNotesAcceptanceTimeoutSec} and {@link midAgreementPaymentTimeoutSec}.
   */
  expirationSec: number;

  /**
   * Maximum time for allowed provider-sent debit note acceptance (in seconds)
   *
   * Accepting debit notes from the provider is used as a health-check of the agreement between these parties.
   * Failing to accept several debit notes in a row will be considered as a valida reason to terminate the agreement earlier
   * than {@link expirationSec} defines.
   *
   * _Accepting debit notes during a long activity is considered a good practice in Golem Network._
   * The SDK will accept debit notes each 2 minutes by default.
   */
  debitNotesAcceptanceTimeoutSec: number;

  /**
   * The interval between provider sent debit notes to negotiate.
   *
   * If it would not be defined, the activities created for your demand would
   * probably live only 30 minutes, as that's the default value that the providers use to control engagements
   * that are not using mid-agreement payments.
   *
   * As a requestor, you don't have to specify it, as the provider will propose a value that the SDK will simply
   * accept without negotiations.
   *
   * _Accepting payable debit notes during a long activity is considered a good practice in Golem Network._
   * The SDK will accept debit notes each 2 minutes by default.
   */
  midAgreementDebitNoteIntervalSec: number;

  /**
   * Maximum time to receive payment for any debit note. At the same time, the minimum interval between mid-agreement payments.
   *
   * Setting this is relevant in case activities which are running for a long time (like 10 hours and more). Providers control
   * the threshold activity duration for which they would like to enforce mid-agreement payments. This value depends on the
   * provider configuration. Checking proposal rejections from providers in yagna's logs can give you a hint about the
   * market expectations.
   *
   * _Paying in regular intervals for the computation resources is considered a good practice in Golem Network._
   * The SDK will issue payments each 12h by default, and you can control this with this setting.
   */
  midAgreementPaymentTimeoutSec: number;
}

export type BuildDemandOptions = Partial<{
  activity: Partial<ActivityDemandDirectorConfigOptions>;
  payment: Partial<PaymentDemandDirectorConfigOptions>;
  basic: Partial<BasicDemandDirectorConfigOptions>;
}>;

export interface IDemandRepository {
  getById(id: string): Demand | undefined;

  add(demand: Demand): Demand;

  getAll(): Demand[];
}

export class DemandSpecification {
  constructor(
    /** Represents the low level demand request body that will be used to subscribe for offers matching our "computational resource needs" */
    public readonly prototype: DemandBodyPrototype,
    public readonly paymentPlatform: string,
    public readonly expirationSec: number,
  ) {}
}

export class Demand {
  constructor(
    public readonly id: string,
    public readonly details: DemandSpecification,
  ) {}

  get paymentPlatform(): string {
    return this.details.paymentPlatform;
  }
}
