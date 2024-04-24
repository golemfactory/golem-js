import * as YaTsClient from "ya-ts-client";
import * as EnvUtils from "../utils/env";
import { GolemConfigError, GolemPlatformError } from "../error/golem-error";
import { v4 } from "uuid";
import { defaultLogger, ElementOf, Logger } from "../utils";
import semverSatisfies from "semver/functions/satisfies.js"; // .js added for ESM compatibility
import semverCoerce from "semver/functions/coerce.js"; // .js added for ESM compatibility
import { BehaviorSubject } from "rxjs";
import { CancellablePoll, EventReaderFactory } from "./event-reader-factory";

export type YagnaOptions = {
  apiKey?: string;
  basePath?: string;
  logger?: Logger;
};

export const MIN_SUPPORTED_YAGNA = "0.13.2";

// Workarounds for an issue with missing support for discriminators
// {@link https://github.com/ferdikoomen/openapi-typescript-codegen/issues/985}
export type YagnaAgreementOperationEvent = ElementOf<
  Awaited<ReturnType<YaTsClient.MarketApi.RequestorService["collectAgreementEvents"]>>
>;
export type YagnaInvoiceEvent = ElementOf<
  Awaited<ReturnType<YaTsClient.PaymentApi.RequestorService["getInvoiceEvents"]>>
>;
export type YagnaDebitNoteEvent = ElementOf<
  Awaited<ReturnType<YaTsClient.PaymentApi.RequestorService["getDebitNoteEvents"]>>
>;

/**
 * Utility class that groups various Yagna APIs under a single wrapper
 *
 * This class has the following responsibilities:
 *
 * - restructures the services exposed by ya-ts-client hand makes more user-friendly
 * - acts as a dependency container by exposing net, payment, gsb, service, activity services
 * - implements an event reader that collects events from Yagna endpoints and allows subscribing to them on BehaviourSubjects
 *
 * End users of the SDK should not use this class and make use of {@link GolemNetwork} instead. This class is designed for
 * SDK developers to use.
 */
export class YagnaApi {
  public readonly appSessionId: string;

  public readonly yagnaOptions: YagnaOptions;
  /**
   * Base path used to build paths to Yagna's API
   *
   * @example http://localhost:7465
   */
  public readonly basePath: string;

  public readonly identity: YaTsClient.IdentityApi.DefaultService;
  public market: YaTsClient.MarketApi.RequestorService;
  public activity: {
    control: YaTsClient.ActivityApi.RequestorControlService;
    state: YaTsClient.ActivityApi.RequestorStateService;
  };
  public net: YaTsClient.NetApi.RequestorService;
  public payment: YaTsClient.PaymentApi.RequestorService;
  public gsb: YaTsClient.GsbApi.RequestorService;
  public version: YaTsClient.VersionApi.DefaultService;

  public debitNoteEvents$ = new BehaviorSubject<YagnaDebitNoteEvent | null>(null);
  private debitNoteEventsPoll: CancellablePoll<YagnaDebitNoteEvent> | null = null;

  public invoiceEvents$ = new BehaviorSubject<YagnaInvoiceEvent | null>(null);
  private invoiceEventPoll: CancellablePoll<YagnaInvoiceEvent> | null = null;

  public agreementEvents$ = new BehaviorSubject<YagnaAgreementOperationEvent | null>(null);
  private agreementEventsPoll: CancellablePoll<YagnaAgreementOperationEvent> | null = null;

  private readonly logger: Logger;
  private readonly reader: EventReaderFactory;

  constructor(options?: YagnaOptions) {
    const apiKey = options?.apiKey || EnvUtils.getYagnaAppKey();
    this.basePath = options?.basePath || EnvUtils.getYagnaApiUrl();

    const yagnaOptions: Pick<YagnaOptions, "apiKey" | "basePath"> = {
      apiKey: apiKey,
      basePath: this.basePath,
    };

    if (!yagnaOptions.apiKey) {
      throw new GolemConfigError("Yagna API key not defined");
    }

    const commonHeaders = {
      Authorization: `Bearer ${apiKey}`,
    };

    const marketClient = new YaTsClient.MarketApi.Client({
      BASE: `${this.basePath}/market-api/v1`,
      HEADERS: commonHeaders,
    });

    this.market = marketClient.requestor;

    const paymentClient = new YaTsClient.PaymentApi.Client({
      BASE: `${this.basePath}/payment-api/v1`,
      HEADERS: commonHeaders,
    });

    this.payment = paymentClient.requestor;

    const activityApiClient = new YaTsClient.ActivityApi.Client({
      BASE: `${this.basePath}/activity-api/v1`,
      HEADERS: commonHeaders,
    });

    this.activity = {
      control: activityApiClient.requestorControl,
      state: activityApiClient.requestorState,
    };

    const netClient = new YaTsClient.NetApi.Client({
      BASE: `${this.basePath}/net-api/v1`,
      HEADERS: commonHeaders,
    });

    this.net = netClient.requestor;

    const gsbClient = new YaTsClient.GsbApi.Client({
      BASE: `${this.basePath}/gsb-api/v1`,
      HEADERS: commonHeaders,
    });

    this.gsb = gsbClient.requestor;

    this.logger = options?.logger ?? defaultLogger("yagna");

    const identityClient = new YaTsClient.IdentityApi.Client({
      BASE: this.basePath,
      HEADERS: commonHeaders,
    });
    this.identity = identityClient.default;

    const versionClient = new YaTsClient.VersionApi.Client({
      BASE: this.basePath,
    });
    this.version = versionClient.default;

    this.yagnaOptions = yagnaOptions;

    this.appSessionId = v4();

    this.reader = new EventReaderFactory(this.logger);
  }

  /**
   * Effectively starts the Yagna API client including subscribing to events exposed via rxjs subjects
   */
  async connect() {
    this.logger.info("Connecting to yagna");

    await this.assertSupportedVersion();

    const identity = this.identity.getIdentity();

    this.startPollingEvents();

    return identity;
  }

  /**
   * Terminates the Yagna API related activities
   */
  async disconnect() {
    await this.stopPollingEvents();
  }

  public async getVersion(): Promise<string> {
    try {
      const res = await this.version.getVersion();
      return res.current.version;
    } catch (err) {
      throw new GolemPlatformError(`Failed to establish yagna version due to: ${err}`, err);
    }
  }

  private startPollingEvents() {
    this.logger.info("Starting to poll for events from Yagna");

    const pollIntervalSec = 5;
    const maxEvents = 100;

    this.agreementEventsPoll = this.reader.createEventReader("AgreementEvents", (lastEventTimestamp) =>
      this.market.collectAgreementEvents(pollIntervalSec, lastEventTimestamp, maxEvents, this.appSessionId),
    );

    this.debitNoteEventsPoll = this.reader.createEventReader("DebitNoteEvents", (lastEventTimestamp) => {
      return this.payment.getDebitNoteEvents(pollIntervalSec, lastEventTimestamp, maxEvents, this.appSessionId);
    });

    this.invoiceEventPoll = this.reader.createEventReader("InvoiceEvents", (lastEventTimestamp) =>
      this.payment.getInvoiceEvents(pollIntervalSec, lastEventTimestamp, maxEvents, this.appSessionId),
    );

    // Run the readers and don't block execution
    this.reader
      .pollToSubject(this.agreementEventsPoll.pollValues(), this.agreementEvents$)
      .then(() => this.logger.info("Finished polling agreement events from Yagna"))
      .catch((err) => this.logger.error("Error while polling agreement events from Yagna", err));

    this.reader
      .pollToSubject(this.debitNoteEventsPoll.pollValues(), this.debitNoteEvents$)
      .then(() => this.logger.info("Finished polling debit note events from Yagna"))
      .catch((err) => this.logger.error("Error while polling debit note events from Yagna", err));

    this.reader
      .pollToSubject(this.invoiceEventPoll.pollValues(), this.invoiceEvents$)
      .then(() => this.logger.info("Finished polling invoice events from Yagna"))
      .catch((err) => this.logger.error("Error while polling invoice events from Yagna", err));
  }

  private async stopPollingEvents() {
    this.logger.debug("Stopping polling events from Yagna");

    if (this.invoiceEventPoll) {
      await this.invoiceEventPoll.cancel();
    }

    if (this.debitNoteEventsPoll) {
      await this.debitNoteEventsPoll.cancel();
    }

    if (this.agreementEventsPoll) {
      await this.agreementEventsPoll.cancel();
    }

    this.logger.debug("Stopped polling events form Yagna");
  }

  private async assertSupportedVersion() {
    const version = await this.getVersion();
    const normVersion = semverCoerce(version);

    this.logger.debug("Checking Yagna version support", {
      userInstalled: normVersion?.raw,
      minSupported: MIN_SUPPORTED_YAGNA,
    });

    if (!normVersion) {
      throw new GolemPlatformError(
        `Unreadable yana version '${version}'. Can't proceed without checking yagna version support status.`,
      );
    }

    if (!semverSatisfies(normVersion, `>=${MIN_SUPPORTED_YAGNA}`)) {
      throw new GolemPlatformError(
        `You run yagna in version ${version} and the minimal version supported by the SDK is ${MIN_SUPPORTED_YAGNA}. ` +
          `Please consult the golem-js README to find matching SDK version or upgrade your yagna installation.`,
      );
    }

    return normVersion.version;
  }
}
