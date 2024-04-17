import * as YaTsClient from "ya-ts-client";
import * as EnvUtils from "../env";
import { GolemConfigError, GolemPlatformError } from "../../error/golem-error";
import { v4 } from "uuid";
import { Logger } from "../logger/logger";
import { defaultLogger } from "../logger/defaultLogger"; // .js added for ESM compatibility
import semverSatisfies from "semver/functions/satisfies.js";
import semverCoerce from "semver/functions/coerce.js";
import { BehaviorSubject } from "rxjs";
import { EventDTO } from "ya-ts-client/dist/market-api";

export type YagnaOptions = {
  apiKey?: string;
  basePath?: string;
  logger?: Logger;
};

export const MIN_SUPPORTED_YAGNA = "0.13.2";

type CancellablePoll<T> = {
  /** User defined name of the event stream for ease of debugging */
  eventType: string;
  pollValues: () => AsyncGenerator<T>;
  cancel: () => void;
};

/**
 * Utility type extracting the type of the element of a typed array
 */
type ElementOf<T> = T extends Array<infer U> ? U : never;

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
 */
export class YagnaApi {
  public readonly appSessionId: string;

  public readonly yagnaOptions: YagnaOptions;

  private readonly logger: Logger;

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

  private debitNoteEventsPoll: CancellablePoll<YagnaDebitNoteEvent> | null = null;
  public debitNoteEvents$ = new BehaviorSubject<YagnaDebitNoteEvent | null>(null);

  private invoiceEventPoll: CancellablePoll<YagnaInvoiceEvent> | null = null;
  public invoiceEvents$ = new BehaviorSubject<YagnaInvoiceEvent | null>(null);

  private agreementEventsPoll: CancellablePoll<YagnaAgreementOperationEvent> | null = null;
  public agreementEvents$ = new BehaviorSubject<YagnaAgreementOperationEvent | null>(null);

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
    this.stopPollingEvents();
  }

  private startPollingEvents() {
    this.logger.info("Starting to poll for events from Yagna");

    const pollIntervalSec = 5;
    const maxEvents = 100;

    this.agreementEventsPoll = this.createEventPoller("AgreementEvents", (lastEventTimestamp) =>
      this.market.collectAgreementEvents(pollIntervalSec, lastEventTimestamp, maxEvents, this.appSessionId),
    );

    this.debitNoteEventsPoll = this.createEventPoller("DebitNoteEvents", (lastEventTimestamp) => {
      return this.payment.getDebitNoteEvents(pollIntervalSec, lastEventTimestamp, maxEvents, this.appSessionId);
    });

    this.invoiceEventPoll = this.createEventPoller("InvoiceEvents", (lastEventTimestamp) =>
      this.payment.getInvoiceEvents(pollIntervalSec, lastEventTimestamp, maxEvents, this.appSessionId),
    );

    // Run the readers and don't block execution
    this.pollToSubject(this.agreementEventsPoll.pollValues(), this.agreementEvents$)
      .then(() => this.logger.info("Finished polling agreement events from Yagna"))
      .catch((err) => this.logger.error("Error while polling agreement events from Yagna", err));

    this.pollToSubject(this.debitNoteEventsPoll.pollValues(), this.debitNoteEvents$)
      .then(() => this.logger.info("Finished polling debit note events from Yagna"))
      .catch((err) => this.logger.error("Error while polling debit note events from Yagna", err));

    this.pollToSubject(this.invoiceEventPoll.pollValues(), this.invoiceEvents$)
      .then(() => this.logger.info("Finished polling invoice events from Yagna"))
      .catch((err) => this.logger.error("Error while polling invoice events from Yagna", err));
  }

  private stopPollingEvents() {
    this.logger.info("Stopping polling events from Yagna");
    this.invoiceEventPoll?.cancel();
    this.debitNoteEventsPoll?.cancel();
    this.agreementEventsPoll?.cancel();
  }

  private async pollToSubject<T>(generator: AsyncGenerator<T>, subject: BehaviorSubject<T>) {
    for await (const value of generator) {
      subject.next(value);
    }
  }

  private createEventPoller<T extends EventDTO>(
    eventType: string,
    eventsFetcher: (lastEventTimestamp: string) => Promise<T[]>,
  ): CancellablePoll<T> {
    let keepReading = true;
    let lastTimestamp = new Date().toISOString();

    const logger = this.logger;

    return {
      eventType,
      pollValues: async function* () {
        while (keepReading) {
          try {
            const events = await eventsFetcher(lastTimestamp);
            logger.debug("Polled events from Yagna", {
              eventType,
              count: events.length,
              lastEventTimestamp: lastTimestamp,
            });
            for (const event of events) {
              yield event;
              lastTimestamp = event.eventDate;
            }
          } catch (error) {
            logger.error("Error fetching events from Yagna", { eventType, error });
          }
        }
      },
      cancel: function () {
        keepReading = false;
      },
    };
  }

  private async assertSupportedVersion() {
    this.logger.debug("Checking yagna version support");
    const version = await this.getVersion();

    const normVersion = semverCoerce(version);
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

  public async getVersion(): Promise<string> {
    try {
      const res = await this.version.getVersion();
      return res.current.version;
    } catch (err) {
      throw new GolemPlatformError(`Failed to establish yagna version due to: ${err}`, err);
    }
  }
}

export interface YagnaEventSubscription<T> {
  waitFor(matcher: (event: T) => boolean, opts: { timeout: number }): Promise<T>;

  on(cb: (event: T) => void): void;

  filter(matcher: (event: T) => boolean): YagnaEventSubscription<T>;

  batch(cb: (event: T[]) => void, options?: { timeout: number }): void;

  /** Stops the subscription, resolves when all I/O is closed */
  cancel(): Promise<void>;
}
