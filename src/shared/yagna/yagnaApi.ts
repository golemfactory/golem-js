import * as YaTsClient from "ya-ts-client";
import * as EnvUtils from "../utils/env";
import { GolemConfigError, GolemPlatformError } from "../error/golem-error";
import { v4 } from "uuid";
import { defaultLogger, Logger } from "../utils";
import semverSatisfies from "semver/functions/satisfies.js"; // .js added for ESM compatibility
import semverCoerce from "semver/functions/coerce.js"; // .js added for ESM compatibility
import { Observable, Subject } from "rxjs";
import { CancellablePoll, EventReader } from "./event-reader";
import EventSource from "eventsource";
import { StreamingBatchEvent } from "../../activity/results";
import { ElementOf } from "../utils/types";

export type YagnaOptions = {
  apiKey?: string;
  basePath?: string;
  logger?: Logger;
};

export const MIN_SUPPORTED_YAGNA = "0.15.0";

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

export interface YagnaExeScriptObserver {
  observeBatchExecResults(activityId: string, batchId: string): Observable<StreamingBatchEvent>;
}

/**
 * Utility class that groups various Yagna APIs under a single wrapper
 *
 * This class has the following responsibilities:
 *
 * - selectively exposes services from ya-ts-client in a more user-friendly manner
 * - implements an event reader that collects events from Yagna endpoints and allows subscribing to them as Observables
 *   for agreements, debit notes and invoices. These observables emit ya-ts-client types on outputs
 *
 * End users of the SDK should not use this class and make use of {@link golem-network/golem-network.GolemNetwork} instead. This class is designed for
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
    exec: YagnaExeScriptObserver;
  };
  public net: YaTsClient.NetApi.RequestorService;
  public payment: YaTsClient.PaymentApi.RequestorService;
  public gsb: YaTsClient.GsbApi.RequestorService;
  public version: YaTsClient.VersionApi.DefaultService;

  public debitNoteEvents$ = new Subject<YagnaDebitNoteEvent>();
  private debitNoteEventsPoll: CancellablePoll<YagnaDebitNoteEvent> | null = null;

  public invoiceEvents$ = new Subject<YagnaInvoiceEvent>();
  private invoiceEventPoll: CancellablePoll<YagnaInvoiceEvent> | null = null;

  public agreementEvents$ = new Subject<YagnaAgreementOperationEvent>();
  private agreementEventsPoll: CancellablePoll<YagnaAgreementOperationEvent> | null = null;

  private readonly logger: Logger;
  private readonly reader: EventReader;

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
      exec: {
        observeBatchExecResults: (activityId: string, batchId: string) => {
          return new Observable((observer) => {
            const eventSource = new EventSource(
              `${this.basePath}/activity-api/v1/activity/${activityId}/exec/${batchId}`,
              {
                headers: {
                  Accept: "text/event-stream",
                  Authorization: `Bearer ${apiKey}`,
                },
              },
            );

            eventSource.addEventListener("runtime", (event) => observer.next(JSON.parse(event.data)));
            eventSource.addEventListener("error", (error) => observer.error(error));
            return () => eventSource.close();
          });
        },
      },
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

    this.reader = new EventReader(this.logger);
  }

  /**
   * Effectively starts the Yagna API client including subscribing to events exposed via rxjs subjects
   */
  async connect() {
    this.logger.info("Connecting to Yagna");

    await this.assertSupportedVersion();

    const identity = this.identity.getIdentity();

    this.startPollingEvents();

    return identity;
  }

  /**
   * Terminates the Yagna API related activities
   */
  async disconnect() {
    this.logger.info("Disconnecting from Yagna");
    await this.stopPollingEvents();
    this.logger.info("Disconnected from Yagna");
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
    this.logger.info("Starting to poll for events from Yagna", { appSessionId: this.appSessionId });

    const pollIntervalSec = 5;
    const maxEvents = 100;

    this.agreementEventsPoll = this.reader.createReader("AgreementEvents", (lastEventTimestamp) =>
      this.market.collectAgreementEvents(pollIntervalSec, lastEventTimestamp, maxEvents, this.appSessionId),
    );

    this.debitNoteEventsPoll = this.reader.createReader("DebitNoteEvents", (lastEventTimestamp) => {
      return this.payment.getDebitNoteEvents(pollIntervalSec, lastEventTimestamp, maxEvents, this.appSessionId);
    });

    this.invoiceEventPoll = this.reader.createReader("InvoiceEvents", (lastEventTimestamp) =>
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

    const promises: Promise<void>[] = [];
    if (this.invoiceEventPoll) {
      promises.push(this.invoiceEventPoll.cancel());
    }

    if (this.debitNoteEventsPoll) {
      promises.push(this.debitNoteEventsPoll.cancel());
    }

    if (this.agreementEventsPoll) {
      promises.push(this.agreementEventsPoll.cancel());
    }
    await Promise.allSettled(promises);

    this.logger.debug("Stopped polling events from Yagna");
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
        `Unreadable yagna version '${version}'. Can't proceed without checking yagna version support status.`,
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
