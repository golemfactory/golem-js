import debugLogger from 'debug';
import * as YaTsClient from 'ya-ts-client';
import { v4 } from 'uuid';
import semverSatisfies from 'semver/functions/satisfies.js';
import semverCoerce from 'semver/functions/coerce.js';
import { Subject, Observable, takeUntil, finalize, mergeWith, tap, filter, map, switchMap, lastValueFrom, toArray, catchError, takeWhile, from, mergeMap, of } from 'rxjs';
import EventSource from 'eventsource';
import { EventEmitter } from 'eventemitter3';
import AsyncLock from 'async-lock';
import Decimal from 'decimal.js-light';
import path from 'path';
import * as fs from 'fs';
import fs__default from 'fs';
import spawn from 'cross-spawn';
import { toObject, encode } from 'flatbuffers/js/flexbuffers.js';
import * as jsSha3 from 'js-sha3';
import jsSha3__default from 'js-sha3';
import NodeWebSocket, { WebSocket as WebSocket$1 } from 'ws';
import net from 'net';
import { Buffer as Buffer$1 } from 'buffer';
import retry from 'async-retry';
import { IPv4CidrRange, IPv4Mask, IPv4, IPv4Prefix } from 'ip-num';

/**
 * @param time
 * @param inMs
 * @ignore
 */
const sleep = (time, inMs = false) => new Promise((resolve) => setTimeout(resolve, time * (inMs ? 1 : 1000)));

/**
 * Base class for all errors directly thrown by Golem SDK.
 */
class GolemError extends Error {
    constructor(message, 
    /**
     * The previous error, if any, that led to this error.
     */
    previous) {
        super(message);
        this.previous = previous;
    }
}
/**
 * User-caused errors in the Golem SDK containing logic errors.
 * @example you cannot create an activity for an agreement that already expired
 */
class GolemUserError extends GolemError {
}
/**
 * Represents errors related to the user choosing to abort or stop running activities.
 * @example CTRL+C abort error
 */
class GolemAbortError extends GolemUserError {
}
/**
 * Represents configuration errors.
 * @example Api key not defined
 */
class GolemConfigError extends GolemUserError {
}
/**
 * Represents errors when the SDK encountered an internal error that wasn't handled correctly.
 * @example JSON.parse(undefined) -> Error: Unexpected token u in JSON at position 0
 */
class GolemInternalError extends GolemError {
}
/**
 * Represents errors resulting from yagna’s errors or provider failure
 * @examples:
 *  - yagna results with a HTTP 500-error
 *  - the provider failed to deploy the activity - permission denied when creating the activity on the provider system itself
 */
class GolemPlatformError extends GolemError {
}
/**
 * SDK timeout errors
 * @examples:
 *  - Not receiving any offers within the configured time.
 *  - The activity not starting within the configured time.
 *  - The request (task) timing out (started on an activity but didn't finish on time).
 *  - The request start timing out (the task didn't start within the configured amount of time).
 */
class GolemTimeoutError extends GolemError {
}
/**
 * Module specific errors - Market, Work, Payment.
 * Each of the major modules will have its own domain specific root error type,
 * additionally containing an error code specific to a given subdomain
 */
class GolemModuleError extends GolemError {
    constructor(message, code, previous) {
        super(message, previous);
        this.code = code;
    }
}

/**
 * @ignore
 */
const isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";
const isNode = typeof process !== "undefined" && process.versions != null && process.versions.node != null;
/**
 * @ignore
 */
const isWebWorker = typeof self === "object" && self.constructor && self.constructor.name === "DedicatedWorkerGlobalScope";
/**
 * @ignore
 */
function checkAndThrowUnsupportedInBrowserError(feature) {
    if (isBrowser)
        throw new GolemInternalError(`Feature ${feature} is unsupported in the browser.`);
}

function nullLogger() {
    const nullFunc = () => {
        // Do nothing.
    };
    return {
        child: () => nullLogger(),
        debug: nullFunc,
        info: nullFunc,
        warn: nullFunc,
        error: nullFunc,
    };
}

function getNamespace(namespace, disablePrefix) {
    if (disablePrefix) {
        return namespace;
    }
    else {
        return namespace.startsWith("golem-js:") ? namespace : `golem-js:${namespace}`;
    }
}
/**
 * Creates a logger that uses the debug library. This logger is used by default by all entities in the SDK.
 *
 * If the namespace is not prefixed with `golem-js:`, it will be prefixed automatically - this can be controlled by `disableAutoPrefix` options.
 */
function defaultLogger(namespace, opts = {
    disableAutoPrefix: false,
}) {
    const namespaceWithBase = getNamespace(namespace, opts.disableAutoPrefix);
    const logger = debugLogger(namespaceWithBase);
    function log(level, msg, ctx) {
        if (ctx) {
            logger(`[${level}] ${msg} %o`, ctx);
        }
        else {
            logger(`[${level}] ${msg}`);
        }
    }
    function debug(msg, ctx) {
        log("DEBUG", msg, ctx);
    }
    function info(msg, ctx) {
        log("INFO", msg, ctx);
    }
    function warn(msg, ctx) {
        log("WARN", msg, ctx);
    }
    function error(msg, ctx) {
        log("ERROR", msg, ctx);
    }
    return {
        child: (childNamespace) => defaultLogger(`${namespaceWithBase}:${childNamespace}`, opts),
        info,
        error,
        warn,
        debug,
    };
}

function getYagnaApiUrl() {
    return (isNode ? process === null || process === void 0 ? void 0 : process.env.YAGNA_API_URL : "") || "http://127.0.0.1:7465";
}
function getYagnaAppKey() {
    var _a;
    return isNode ? ((_a = process === null || process === void 0 ? void 0 : process.env.YAGNA_APPKEY) !== null && _a !== void 0 ? _a : "") : "";
}
function getYagnaSubnet() {
    var _a;
    return isNode ? ((_a = process === null || process === void 0 ? void 0 : process.env.YAGNA_SUBNET) !== null && _a !== void 0 ? _a : "public") : "public";
}
function getRepoUrl() {
    var _a;
    return isNode
        ? ((_a = process === null || process === void 0 ? void 0 : process.env.GOLEM_REGISTRY_URL) !== null && _a !== void 0 ? _a : "https://registry.golem.network")
        : "https://registry.golem.network";
}
function getPaymentNetwork() {
    var _a;
    return isNode ? ((_a = process.env.PAYMENT_NETWORK) !== null && _a !== void 0 ? _a : "holesky") : "holesky";
}
function isDevMode() {
    return isNode ? (process === null || process === void 0 ? void 0 : process.env.GOLEM_DEV_MODE) === "true" : false;
}

var env = /*#__PURE__*/Object.freeze({
    __proto__: null,
    getPaymentNetwork: getPaymentNetwork,
    getRepoUrl: getRepoUrl,
    getYagnaApiUrl: getYagnaApiUrl,
    getYagnaAppKey: getYagnaAppKey,
    getYagnaSubnet: getYagnaSubnet,
    isDevMode: isDevMode
});

/**
 * Utility function that helps to block the execution until a condition is met (check returns true) or the timeout happens.
 *
 * @param {function} check - The function checking if the condition is met.
 * @param {Object} [opts] - Options controlling the timeout and check interval in seconds.
 * @param {AbortSignal} [opts.abortSignal] - AbortSignal to respect when waiting for the condition to be met
 * @param {number} [opts.intervalSeconds=1] - The interval between condition checks in seconds.
 *
 * @return {Promise<void>} - Resolves when the condition is met or rejects with a timeout error if it wasn't met on time.
 */
function waitFor(check, opts) {
    var _a;
    const intervalSeconds = (_a = opts === null || opts === void 0 ? void 0 : opts.intervalSeconds) !== null && _a !== void 0 ? _a : 1;
    let verifyInterval;
    const verify = new Promise((resolve, reject) => {
        verifyInterval = setInterval(async () => {
            var _a;
            if ((_a = opts === null || opts === void 0 ? void 0 : opts.abortSignal) === null || _a === void 0 ? void 0 : _a.aborted) {
                reject(new GolemAbortError("Waiting for a condition has been aborted", opts.abortSignal.reason));
            }
            if (await check()) {
                resolve();
            }
        }, intervalSeconds * 1000);
    });
    return verify.finally(() => {
        clearInterval(verifyInterval);
    });
}
/**
 * Simple utility that allows you to wait n-seconds and then call the provided function
 */
function waitAndCall(fn, waitSeconds) {
    return new Promise((resolve, reject) => {
        setTimeout(async () => {
            try {
                const val = await fn();
                resolve(val);
            }
            catch (err) {
                reject(err);
            }
        }, waitSeconds * 1000);
    });
}

class EventReader {
    constructor(logger) {
        this.logger = logger;
    }
    async pollToSubject(generator, subject) {
        for await (const value of generator) {
            subject.next(value);
        }
        subject.complete();
    }
    createReader(eventType, eventsFetcher) {
        let isFinished = false;
        let keepReading = true;
        let currentPoll = null;
        let lastTimestamp = new Date().toISOString();
        const logger = this.logger;
        return {
            eventType,
            isFinished,
            pollValues: async function* () {
                while (keepReading) {
                    try {
                        currentPoll = eventsFetcher(lastTimestamp);
                        const events = await currentPoll;
                        logger.debug("Polled events from Yagna", {
                            eventType,
                            count: events.length,
                            lastEventTimestamp: lastTimestamp,
                        });
                        for (const event of events) {
                            yield event;
                            lastTimestamp = event.eventDate;
                        }
                    }
                    catch (error) {
                        if (typeof error === "object" && error.name === "CancelError") {
                            logger.debug("Polling was cancelled", { eventType });
                            continue;
                        }
                        logger.error("Error fetching events from Yagna", { eventType, error });
                    }
                }
                logger.debug("Stopped reading events", { eventType });
                isFinished = true;
            },
            cancel: async function () {
                keepReading = false;
                if (currentPoll) {
                    currentPoll.cancel();
                }
                await waitFor(() => isFinished, { intervalSeconds: 0 });
                logger.debug("Cancelled reading the events", { eventType });
            },
        };
    }
}

const MIN_SUPPORTED_YAGNA = "0.15.2";
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
class YagnaApi {
    constructor(options) {
        this.debitNoteEvents$ = new Subject();
        this.debitNoteEventsPoll = null;
        this.invoiceEvents$ = new Subject();
        this.invoiceEventPoll = null;
        this.agreementEvents$ = new Subject();
        this.agreementEventsPoll = null;
        const apiKey = (options === null || options === void 0 ? void 0 : options.apiKey) || getYagnaAppKey();
        this.basePath = (options === null || options === void 0 ? void 0 : options.basePath) || getYagnaApiUrl();
        const yagnaOptions = {
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
                observeBatchExecResults: (activityId, batchId) => {
                    return new Observable((observer) => {
                        const eventSource = new EventSource(`${this.basePath}/activity-api/v1/activity/${activityId}/exec/${batchId}`, {
                            headers: {
                                Accept: "text/event-stream",
                                Authorization: `Bearer ${apiKey}`,
                            },
                        });
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
        this.logger = (options === null || options === void 0 ? void 0 : options.logger) ? options.logger.child("yagna") : defaultLogger("yagna");
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
        this.logger.debug("Connecting to Yagna");
        const version = await this.assertSupportedVersion();
        const identity = await this.identity.getIdentity();
        this.startPollingEvents();
        this.logger.info("Connected to Yagna", { version, identity: identity.identity });
        return identity;
    }
    /**
     * Terminates the Yagna API related activities
     */
    async disconnect() {
        this.logger.debug("Disconnecting from Yagna");
        await this.stopPollingEvents();
        this.logger.info("Disconnected from Yagna");
    }
    async getVersion() {
        try {
            const res = await this.version.getVersion();
            return res.current.version;
        }
        catch (err) {
            throw new GolemPlatformError(`Failed to establish yagna version due to: ${err}`, err);
        }
    }
    startPollingEvents() {
        this.logger.debug("Starting to poll for events from Yagna", { appSessionId: this.appSessionId });
        const pollIntervalSec = 5;
        const maxEvents = 100;
        this.agreementEventsPoll = this.reader.createReader("AgreementEvents", (lastEventTimestamp) => this.market.collectAgreementEvents(pollIntervalSec, lastEventTimestamp, maxEvents, this.appSessionId));
        this.debitNoteEventsPoll = this.reader.createReader("DebitNoteEvents", (lastEventTimestamp) => {
            return this.payment.getDebitNoteEvents(pollIntervalSec, lastEventTimestamp, maxEvents, this.appSessionId);
        });
        this.invoiceEventPoll = this.reader.createReader("InvoiceEvents", (lastEventTimestamp) => this.payment.getInvoiceEvents(pollIntervalSec, lastEventTimestamp, maxEvents, this.appSessionId));
        // Run the readers and don't block execution
        this.reader
            .pollToSubject(this.agreementEventsPoll.pollValues(), this.agreementEvents$)
            .then(() => this.logger.debug("Finished polling agreement events from Yagna"))
            .catch((err) => this.logger.error("Error while polling agreement events from Yagna", err));
        this.reader
            .pollToSubject(this.debitNoteEventsPoll.pollValues(), this.debitNoteEvents$)
            .then(() => this.logger.debug("Finished polling debit note events from Yagna"))
            .catch((err) => this.logger.error("Error while polling debit note events from Yagna", err));
        this.reader
            .pollToSubject(this.invoiceEventPoll.pollValues(), this.invoiceEvents$)
            .then(() => this.logger.debug("Finished polling invoice events from Yagna"))
            .catch((err) => this.logger.error("Error while polling invoice events from Yagna", err));
    }
    async stopPollingEvents() {
        this.logger.debug("Stopping polling events from Yagna");
        const promises = [];
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
    async assertSupportedVersion() {
        const version = await this.getVersion();
        const normVersion = semverCoerce(version);
        this.logger.debug("Checking Yagna version support", {
            userInstalled: normVersion === null || normVersion === void 0 ? void 0 : normVersion.raw,
            minSupported: MIN_SUPPORTED_YAGNA,
        });
        if (!normVersion) {
            throw new GolemPlatformError(`Unreadable yagna version '${version}'. Can't proceed without checking yagna version support status.`);
        }
        if (!semverSatisfies(normVersion, `>=${MIN_SUPPORTED_YAGNA}`)) {
            throw new GolemPlatformError(`You run yagna in version ${version} and the minimal version supported by the SDK is ${MIN_SUPPORTED_YAGNA}. ` +
                `Please consult the golem-js README to find matching SDK version or upgrade your yagna installation.`);
        }
        return normVersion.version;
    }
}

/**
 * If provided an AbortSignal, returns it.
 * If provided a number, returns an AbortSignal that will be aborted after the specified number of milliseconds.
 * If provided undefined, returns an AbortSignal that will never be aborted.
 */
function createAbortSignalFromTimeout(timeoutOrSignal) {
    if (timeoutOrSignal instanceof AbortSignal) {
        return timeoutOrSignal;
    }
    if (typeof timeoutOrSignal === "number") {
        return AbortSignal.timeout(timeoutOrSignal);
    }
    return new AbortController().signal;
}
/**
 * Combine multiple AbortSignals into a single signal that will be aborted if any
 * of the input signals are aborted. If any of the input signals are already aborted,
 * the returned signal will be aborted immediately.
 *
 * Polyfill for AbortSignal.any(), since it's only available starting in Node 20
 * https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static
 *
 * The function returns a signal and a cleanup function that allows you
 * to remove listeners when they are no longer needed.
 */
function anyAbortSignal(...signals) {
    const controller = new AbortController();
    const onAbort = (ev) => {
        if (controller.signal.aborted)
            return;
        const reason = ev.target.reason;
        controller.abort(reason);
    };
    for (const signal of signals) {
        if (signal.aborted) {
            controller.abort(signal.reason);
            break;
        }
        signal.addEventListener("abort", onAbort);
    }
    const cleanup = () => {
        for (const signal of signals) {
            signal.removeEventListener("abort", onAbort);
        }
    };
    return { signal: controller.signal, cleanup };
}

/**
 * Run a callback on the next event loop iteration ("promote" a microtask to a task using setTimeout).
 * Note that this is not guaranteed to run on the very next iteration, but it will run as soon as possible.
 * This function is designed to avoid the problem of microtasks queueing other microtasks in an infinite loop.
 * See the example below for a common pitfall that this function can help avoid.
 * Learn more about microtasks and their relation to async/await here:
 * https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide/In_depth
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await#control_flow_effects_of_await
 * @param cb The callback to run on the next event loop iteration.
 * @example
 * ```ts
 * const signal = AbortSignal.timeout(1_000);
 * // This loop will run for 1 second, then stop.
 * while (!signal.aborted) {
 *   await runOnNextEventLoopIteration(() => Promise.resolve());
 * }
 *
 * const signal = AbortSignal.timeout(1_000);
 * // This loop will run indefinitely.
 * // Each while loop iteration queues a microtask, which itself queues another microtask, and so on.
 * while (!signal.aborted) {
 *   await Promise.resolve();
 * }
 * ```
 */
function runOnNextEventLoopIteration(cb) {
    return new Promise((resolve, reject) => {
        setTimeout(() => cb().then(resolve).catch(reject));
    });
}

/**
 * Merges two observables until the first one completes (or errors).
 * The difference between this and `merge` is that this will complete when the first observable completes,
 * while `merge` would only complete when _all_ observables complete.
 */
function mergeUntilFirstComplete(observable1, observable2) {
    const completionSubject = new Subject();
    const observable1WithCompletion = observable1.pipe(takeUntil(completionSubject), finalize(() => completionSubject.next()));
    const observable2WithCompletion = observable2.pipe(takeUntil(completionSubject), finalize(() => completionSubject.next()));
    return observable1WithCompletion.pipe(mergeWith(observable2WithCompletion));
}

class DemandSpecification {
    constructor(
    /** Represents the low level demand request body that will be used to subscribe for offers matching our "computational resource needs" */
    prototype, paymentPlatform) {
        this.prototype = prototype;
        this.paymentPlatform = paymentPlatform;
    }
}
class Demand {
    constructor(id, details) {
        this.id = id;
        this.details = details;
    }
    get paymentPlatform() {
        return this.details.paymentPlatform;
    }
}

var MarketErrorCode;
(function (MarketErrorCode) {
    MarketErrorCode["CouldNotGetAgreement"] = "CouldNotGetAgreement";
    MarketErrorCode["CouldNotGetProposal"] = "CouldNotGetProposal";
    MarketErrorCode["ServiceNotInitialized"] = "ServiceNotInitialized";
    MarketErrorCode["MissingAllocation"] = "MissingAllocation";
    MarketErrorCode["SubscriptionFailed"] = "SubscriptionFailed";
    MarketErrorCode["InvalidProposal"] = "InvalidProposal";
    MarketErrorCode["ProposalResponseFailed"] = "ProposalResponseFailed";
    MarketErrorCode["ProposalRejectionFailed"] = "ProposalRejectionFailed";
    MarketErrorCode["DemandExpired"] = "DemandExpired";
    MarketErrorCode["ResourceRentalTerminationFailed"] = "ResourceRentalTerminationFailed";
    MarketErrorCode["ResourceRentalCreationFailed"] = "ResourceRentalCreationFailed";
    MarketErrorCode["AgreementApprovalFailed"] = "AgreementApprovalFailed";
    MarketErrorCode["NoProposalAvailable"] = "NoProposalAvailable";
    MarketErrorCode["InternalError"] = "InternalError";
    MarketErrorCode["ScanFailed"] = "ScanFailed";
})(MarketErrorCode || (MarketErrorCode = {}));
class GolemMarketError extends GolemModuleError {
    constructor(message, code, previous) {
        super(message, code, previous);
        this.code = code;
        this.previous = previous;
    }
}

/**
 * Base representation of a market proposal that can be issued either by the Provider (offer proposal)
 *   or Requestor (counter-proposal)
 */
class MarketProposal {
    constructor(model) {
        var _a;
        this.model = model;
        /**
         * Reference to the previous proposal in the "negotiation chain"
         *
         * If null, this means that was the initial offer that the negotiations started from
         */
        this.previousProposalId = null;
        this.id = model.proposalId;
        this.previousProposalId = (_a = model.prevProposalId) !== null && _a !== void 0 ? _a : null;
        this.properties = model.properties;
    }
    get state() {
        return this.model.state;
    }
    get timestamp() {
        return new Date(Date.parse(this.model.timestamp));
    }
    isInitial() {
        return this.model.state === "Initial";
    }
    isDraft() {
        return this.model.state === "Draft";
    }
    isExpired() {
        return this.model.state === "Expired";
    }
    isRejected() {
        return this.model.state === "Rejected";
    }
    isValid() {
        try {
            this.validate();
            return true;
        }
        catch (err) {
            return false;
        }
    }
}

/**
 * Entity representing the offer presented by the Provider to the Requestor
 *
 * Issue: The final proposal that gets promoted to an agreement comes from the provider
 * Right now the last time I can access it directly is when I receive the counter from the provider,
 * later it's impossible for me to get it via the API `{"message":"Path deserialize error: Id [2cb0b2820c6142fab5af7a8e90da09f0] has invalid owner type."}`
 *
 * FIXME #yagna should allow obtaining proposals via the API even if I'm not the owner!
 */
class OfferProposal extends MarketProposal {
    constructor(model, demand) {
        super(model);
        this.demand = demand;
        this.issuer = "Provider";
        this.validate();
    }
    get pricing() {
        var _a, _b;
        const usageVector = this.properties["golem.com.usage.vector"];
        const priceVector = this.properties["golem.com.pricing.model.linear.coeffs"];
        if (!usageVector) {
            throw new GolemInternalError("The proposal does not contain 'golem.com.usage.vector' property. We can't estimate the costs.");
        }
        if (!priceVector) {
            throw new GolemInternalError("The proposal does not contain 'golem.com.pricing.model.linear.coeffs' property. We can't estimate costs.");
        }
        const envIdx = usageVector.findIndex((ele) => ele === "golem.usage.duration_sec");
        const cpuIdx = usageVector.findIndex((ele) => ele === "golem.usage.cpu_sec");
        const envSec = (_a = priceVector[envIdx]) !== null && _a !== void 0 ? _a : 0.0;
        const cpuSec = (_b = priceVector[cpuIdx]) !== null && _b !== void 0 ? _b : 0.0;
        const start = priceVector[priceVector.length - 1];
        return {
            cpuSec,
            envSec,
            start,
        };
    }
    getDto() {
        return {
            transferProtocol: this.properties["golem.activity.caps.transfer.protocol"],
            cpuBrand: this.properties["golem.inf.cpu.brand"],
            cpuCapabilities: this.properties["golem.inf.cpu.capabilities"],
            cpuCores: this.properties["golem.inf.cpu.cores"],
            cpuThreads: this.properties["golem.inf.cpu.threads"],
            memory: this.properties["golem.inf.mem.gib"],
            storage: this.properties["golem.inf.storage.gib"],
            publicNet: this.properties["golem.node.net.is-public"],
            runtimeCapabilities: this.properties["golem.runtime.capabilities"],
            runtimeName: this.properties["golem.runtime.name"],
            runtimeVersion: this.properties["golem.runtime.version"],
            state: this.state,
        };
    }
    /**
     * Cost estimation based on CPU/h, ENV/h and start prices
     *
     * @param rentHours Number of hours of rental to use for the estimation
     */
    getEstimatedCost(rentHours = 1) {
        var _a;
        const threadsNo = (_a = this.getDto().cpuThreads) !== null && _a !== void 0 ? _a : 1;
        const rentSeconds = rentHours * 60 * 60;
        return this.pricing.start + this.pricing.cpuSec * threadsNo * rentSeconds + this.pricing.envSec * rentSeconds;
    }
    get provider() {
        return {
            id: this.model.issuerId,
            name: this.properties["golem.node.id.name"],
            walletAddress: this.properties[`golem.com.payment.platform.${this.demand.paymentPlatform}.address`],
        };
    }
    /**
     * Validates if the proposal satisfies basic business rules, is complete and thus safe to interact with
     *
     * Use this method before executing any important logic, to ensure that you're working with correct, complete data
     */
    validate() {
        const usageVector = this.properties["golem.com.usage.vector"];
        const priceVector = this.properties["golem.com.pricing.model.linear.coeffs"];
        if (!usageVector || usageVector.length === 0) {
            throw new GolemMarketError("Broken proposal: the `golem.com.usage.vector` does not contain valid information about structure of the usage counters vector", MarketErrorCode.InvalidProposal);
        }
        if (!priceVector || priceVector.length === 0) {
            throw new GolemMarketError("Broken proposal: the `golem.com.pricing.model.linear.coeffs` does not contain pricing information", MarketErrorCode.InvalidProposal);
        }
        if (usageVector.length < priceVector.length - 1) {
            throw new GolemMarketError("Broken proposal: the `golem.com.usage.vector` has less pricing information than `golem.com.pricing.model.linear.coeffs`", MarketErrorCode.InvalidProposal);
        }
        if (priceVector.length < usageVector.length) {
            throw new GolemMarketError("Broken proposal: the `golem.com.pricing.model.linear.coeffs` should contain 3 price values", MarketErrorCode.InvalidProposal);
        }
    }
    getProviderPaymentPlatforms() {
        return (Object.keys(this.properties)
            .filter((prop) => prop.startsWith("golem.com.payment.platform."))
            .map((prop) => prop.split(".")[4]) || []);
    }
}

/**
 * `Promise.withResolvers` is only available in Node 22.0.0 and later.
 */
function withResolvers() {
    let resolve;
    let reject;
    const promise = new Promise((_resolve, _reject) => {
        resolve = _resolve;
        reject = _reject;
    });
    return { resolve, reject, promise };
}
/**
 * A queue of acquirers waiting for an item.
 * use `get` to queue up for the next available item.
 * use `put` to give the item to the next acquirer.
 */
class AcquireQueue {
    constructor() {
        this.queue = [];
        this.abortController = new AbortController();
    }
    /**
     * Release (reject) all acquirers.
     * Essentially this is a way to reset the queue.
     */
    releaseAll() {
        this.abortController.abort();
        this.queue = [];
        this.abortController = new AbortController();
    }
    /**
     * Queue up for the next available item.
     */
    async get(signalOrTimeout) {
        const { signal, cleanup } = anyAbortSignal(createAbortSignalFromTimeout(signalOrTimeout), this.abortController.signal);
        signal.throwIfAborted();
        const { resolve, promise } = withResolvers();
        this.queue.push(resolve);
        const abortPromise = new Promise((_, reject) => {
            signal.addEventListener("abort", () => {
                this.queue = this.queue.filter((r) => r !== resolve);
                reject(signal.reason);
            });
        });
        return Promise.race([promise, abortPromise]).finally(cleanup);
    }
    /**
     * Are there any acquirers waiting for an item?
     */
    hasAcquirers() {
        return this.queue.length > 0;
    }
    /**
     * Give the item to the next acquirer.
     * If there are no acquirers, throw an error. You should check `hasAcquirers` before calling this method.
     */
    put(item) {
        if (!this.hasAcquirers()) {
            throw new GolemInternalError("No acquirers waiting for the item");
        }
        const resolve = this.queue.shift();
        resolve(item);
    }
    size() {
        return this.queue.length;
    }
}

/**
 * Pool of draft offer proposals that are ready to be promoted to agreements with Providers
 *
 * Reaching this pool means that the related initial proposal which was delivered by Yagna in response
 * to the subscription with the Demand has been fully negotiated between the Provider and Requestor.
 *
 * This pool should contain only offer proposals that can be used to pursue the final Agreement between the
 * parties.
 *
 * Technically, the "market" part of you application should populate this pool with such offer proposals.
 */
class DraftOfferProposalPool {
    constructor(options) {
        this.options = options;
        this.events = new EventEmitter();
        this.acquireQueue = new AcquireQueue();
        /** {@link ProposalPoolOptions.minCount} */
        this.minCount = 0;
        /** {@link ProposalPoolOptions.selectOfferProposal} */
        this.selectOfferProposal = (proposals) => proposals[0];
        /** {@link ProposalPoolOptions.validateOfferProposal} */
        this.validateOfferProposal = (proposal) => proposal !== undefined;
        /**
         * The proposals that were not yet leased to anyone and are available for lease
         */
        this.available = new Set();
        /**
         * The proposal that were already leased to someone and shouldn't be leased again
         */
        this.leased = new Set();
        if (options === null || options === void 0 ? void 0 : options.selectOfferProposal) {
            this.selectOfferProposal = options.selectOfferProposal;
        }
        if (options === null || options === void 0 ? void 0 : options.validateOfferProposal) {
            this.validateOfferProposal = options.validateOfferProposal;
        }
        if ((options === null || options === void 0 ? void 0 : options.minCount) && options.minCount >= 0) {
            this.minCount = options.minCount;
        }
        this.logger = this.logger = (options === null || options === void 0 ? void 0 : options.logger) || defaultLogger("proposal-pool");
    }
    /**
     * Pushes the provided proposal to the list of proposals available for lease
     */
    add(proposal) {
        if (!proposal.isDraft()) {
            this.logger.error("Cannot add a non-draft proposal to the pool", { proposalId: proposal.id });
            throw new GolemMarketError("Cannot add a non-draft proposal to the pool", MarketErrorCode.InvalidProposal);
        }
        // if someone is waiting for a proposal, give it to them
        if (this.acquireQueue.hasAcquirers()) {
            this.acquireQueue.put(proposal);
            return;
        }
        this.available.add(proposal);
        this.events.emit("added", { proposal });
    }
    /**
     * Attempts to obtain a single proposal from the pool
     * @param signalOrTimeout - the timeout in milliseconds or an AbortSignal that will be used to cancel the acquiring
     */
    async acquire(signalOrTimeout) {
        const signal = createAbortSignalFromTimeout(signalOrTimeout);
        signal.throwIfAborted();
        // iterate over available proposals until we find a valid one
        const tryGettingFromAvailable = async () => {
            signal.throwIfAborted();
            console.log("AAAAAAAAAAAAAAAAA Draft proposal pool acquiring ...");
            const proposal = this.available.size > 0 ? this.selectOfferProposal([...this.available]) : null;
            if (!proposal) {
                // No proposal was selected, either `available` is empty or the user's proposal filter didn't select anything
                // no point retrying
                return;
            }
            if (!this.validateOfferProposal(proposal)) {
                // Drop if not valid
                this.removeFromAvailable(proposal);
                // and try again
                return runOnNextEventLoopIteration(tryGettingFromAvailable);
            }
            // valid proposal found
            return proposal;
        };
        const proposal = await tryGettingFromAvailable();
        // Try to get one
        if (proposal) {
            this.available.delete(proposal);
            this.leased.add(proposal);
            this.events.emit("acquired", { proposal });
            return proposal;
        }
        // if no valid proposal was found, wait for one to appear
        return this.acquireQueue.get(signal);
    }
    /**
     * Releases the proposal back to the pool
     *
     * Validates if the proposal is still usable before putting it back to the list of available ones
     * @param proposal
     */
    release(proposal) {
        this.leased.delete(proposal);
        if (this.validateOfferProposal(proposal)) {
            this.events.emit("released", { proposal });
            // if someone is waiting for a proposal, give it to them
            if (this.acquireQueue.hasAcquirers()) {
                this.acquireQueue.put(proposal);
                return;
            }
            // otherwise, put it back to the list of available proposals
            this.available.add(proposal);
        }
        else {
            this.events.emit("removed", { proposal });
        }
    }
    remove(proposal) {
        if (this.leased.has(proposal)) {
            this.leased.delete(proposal);
            this.events.emit("removed", { proposal });
        }
        if (this.available.has(proposal)) {
            this.available.delete(proposal);
            this.events.emit("removed", { proposal });
        }
    }
    /**
     * Returns the number of all items in the pool (available + leased out)
     */
    count() {
        return this.availableCount() + this.leasedCount();
    }
    /**
     * Returns the number of items that are possible to lease from the pool
     */
    availableCount() {
        return this.available.size;
    }
    /**
     * Returns the number of items that were leased out of the pool
     */
    leasedCount() {
        return this.leased.size;
    }
    /**
     * Tells if the pool is ready to take items from
     */
    isReady() {
        return this.count() >= this.minCount;
    }
    /**
     * Clears the pool entirely
     */
    async clear() {
        this.acquireQueue.releaseAll();
        for (const proposal of this.available) {
            this.available.delete(proposal);
            this.events.emit("removed", { proposal });
        }
        for (const proposal of this.leased) {
            this.leased.delete(proposal);
            this.events.emit("removed", { proposal });
        }
        this.available = new Set();
        this.leased = new Set();
        this.events.emit("cleared");
    }
    removeFromAvailable(proposal) {
        this.available.delete(proposal);
        this.events.emit("removed", { proposal });
    }
    readFrom(source) {
        return source.subscribe({
            next: (proposal) => this.add(proposal),
            error: (err) => this.logger.error("Error while collecting proposals", err),
        });
    }
}

class OfferCounterProposal extends MarketProposal {
    constructor(model) {
        super(model);
        this.issuer = "Requestor";
    }
    validate() {
        return;
    }
}

const DEFAULTS$2 = {
    minBatchSize: 100,
    releaseTimeoutMs: 1000,
};
/**
 * Proposals Batch aggregates initial proposals and returns a set grouped by the provider's key
 * to avoid duplicate offers issued by the provider.
 */
class ProposalsBatch {
    constructor(options) {
        var _a, _b;
        /** Batch of proposals mapped by provider key and related set of initial proposals */
        this.batch = new Map();
        /** Lock used to synchronize adding and getting proposals from the batch */
        this.lock = new AsyncLock();
        this.config = {
            minBatchSize: (_a = options === null || options === void 0 ? void 0 : options.minBatchSize) !== null && _a !== void 0 ? _a : DEFAULTS$2.minBatchSize,
            releaseTimeoutMs: (_b = options === null || options === void 0 ? void 0 : options.releaseTimeoutMs) !== null && _b !== void 0 ? _b : DEFAULTS$2.releaseTimeoutMs,
        };
    }
    /**
     * Add proposal to the batch grouped by provider key
     * which consist of providerId, cores, threads, mem and storage
     */
    async addProposal(proposal) {
        const providerKey = this.getProviderKey(proposal);
        await this.lock.acquire("proposals-batch", () => {
            let proposals = this.batch.get(providerKey);
            if (!proposals) {
                proposals = new Set();
                this.batch.set(providerKey, proposals);
            }
            proposals.add(proposal);
        });
    }
    /**
     * Returns the batched proposals from the internal buffer and empties it
     */
    async getProposals() {
        const proposals = [];
        await this.lock.acquire("proposals-batch", () => {
            this.batch.forEach((providersProposals) => proposals.push(this.getBestProposal(providersProposals)));
            this.batch.clear();
        });
        return proposals;
    }
    /**
     * Waits for the max amount time for batching or max batch size to be reached before it makes sense to process events
     *
     * Used to flow-control the consumption of the proposal events from the batch.
     * The returned promise resolves when it is time to process the buffered proposal events.
     */
    async waitForProposals() {
        let timeoutId, intervalId;
        const isTimeoutReached = new Promise((resolve) => {
            timeoutId = setTimeout(resolve, this.config.releaseTimeoutMs);
        });
        const isBatchSizeReached = new Promise((resolve) => {
            intervalId = setInterval(() => {
                if (this.batch.size >= this.config.minBatchSize) {
                    resolve(true);
                }
            }, 1000);
        });
        await Promise.race([isTimeoutReached, isBatchSizeReached]);
        clearTimeout(timeoutId);
        clearInterval(intervalId);
    }
    /**
     * Selects the best proposal from the set according to the lowest price and the youngest proposal age
     */
    getBestProposal(proposals) {
        const sortByLowerPriceAndHigherTime = (p1, p2) => {
            const p1Price = p1.getEstimatedCost();
            const p2Price = p2.getEstimatedCost();
            const p1Time = p1.timestamp.valueOf();
            const p2Time = p2.timestamp.valueOf();
            return p1Price !== p2Price ? p1Price - p2Price : p2Time - p1Time;
        };
        return [...proposals].sort(sortByLowerPriceAndHigherTime)[0];
    }
    /**
     * Provider key used to group proposals so that they can be distinguished based on ID and hardware configuration
     */
    getProviderKey(proposal) {
        return [
            proposal.provider.id,
            proposal.properties["golem.inf.cpu.cores"],
            proposal.properties["golem.inf.cpu.threads"],
            proposal.properties["golem.inf.mem.gib"],
            proposal.properties["golem.inf.storage.gib"],
        ].join("-");
    }
}

var ComparisonOperator;
(function (ComparisonOperator) {
    ComparisonOperator["Eq"] = "=";
    ComparisonOperator["Lt"] = "<";
    ComparisonOperator["Gt"] = ">";
    ComparisonOperator["GtEq"] = ">=";
    ComparisonOperator["LtEq"] = "<=";
})(ComparisonOperator || (ComparisonOperator = {}));
/**
 * A helper class assisting in building the Golem Demand object
 *
 * Various directors should use the builder to add properties and constraints before the final product is received
 * from the builder and sent to yagna to subscribe for matched offers (proposals).
 *
 * The main purpose of the builder is to accept different requirements (properties and constraints) from different
 * directors who know what kind of properties and constraints are needed. Then it helps to merge these requirements.
 *
 * Demand -> DemandSpecification -> DemandPrototype -> DemandDTO
 */
class DemandBodyBuilder {
    constructor() {
        this.properties = [];
        this.constraints = [];
    }
    addProperty(key, value) {
        const findIndex = this.properties.findIndex((prop) => prop.key === key);
        if (findIndex >= 0) {
            this.properties[findIndex] = { key, value };
        }
        else {
            this.properties.push({ key, value });
        }
        return this;
    }
    addConstraint(key, value, comparisonOperator = ComparisonOperator.Eq) {
        this.constraints.push({ key, value, comparisonOperator });
        return this;
    }
    getProduct() {
        return {
            properties: this.properties,
            constraints: this.constraints.map((c) => `(${c.key + c.comparisonOperator + c.value})`),
        };
    }
    mergePrototype(prototype) {
        if (prototype.properties) {
            prototype.properties.forEach((prop) => {
                this.addProperty(prop.key, prop.value);
            });
        }
        if (prototype.constraints) {
            prototype.constraints.forEach((cons) => {
                const { key, value, comparisonOperator } = { ...this.parseConstraint(cons) };
                this.addConstraint(key, value, comparisonOperator);
            });
        }
        return this;
    }
    parseConstraint(constraint) {
        for (const key in ComparisonOperator) {
            const value = ComparisonOperator[key];
            const parsedConstraint = constraint.slice(1, -1).split(value);
            if (parsedConstraint.length === 2) {
                return {
                    key: parsedConstraint[0],
                    value: parsedConstraint[1],
                    comparisonOperator: value,
                };
            }
        }
        throw new GolemInternalError(`Unable to parse constraint "${constraint}"`);
    }
}

/**
 * Basic config utility class
 *
 * Helps in building more specific config classes
 */
class BaseConfig {
    isPositiveInt(value) {
        return value > 0 && Number.isInteger(value);
    }
}

var PackageFormat;
(function (PackageFormat) {
    PackageFormat["GVMKitSquash"] = "gvmkit-squash";
})(PackageFormat || (PackageFormat = {}));
class WorkloadDemandDirectorConfig extends BaseConfig {
    constructor(options) {
        var _a;
        super();
        this.packageFormat = PackageFormat.GVMKitSquash;
        this.engine = "vm";
        this.runtime = {
            name: "vm",
            version: undefined,
        };
        this.minMemGib = 0.5;
        this.minStorageGib = 2;
        this.minCpuThreads = 1;
        this.minCpuCores = 1;
        this.capabilities = [];
        this.useHttps = false;
        Object.assign(this, options);
        if (!((_a = options.runtime) === null || _a === void 0 ? void 0 : _a.name)) {
            this.runtime.name = this.engine;
        }
        this.expirationSec = options.expirationSec;
        if (!this.imageHash && !this.manifest && !this.imageTag && !this.imageUrl) {
            throw new GolemConfigError("You must define a package or manifest option");
        }
        if (this.imageUrl && !this.imageHash) {
            throw new GolemConfigError("If you provide an imageUrl, you must also provide it's SHA3-224 hash in imageHash");
        }
        if (!this.isPositiveInt(this.expirationSec)) {
            throw new GolemConfigError("The expirationSec param has to be a positive integer");
        }
        if (options.engine && options.runtime) {
            throw new GolemConfigError("The engine parameter is deprecated and cannot be used with the runtime parameter. Use the runtime option only");
        }
    }
}

class BasicDemandDirectorConfig extends BaseConfig {
    constructor(options) {
        super();
        this.subnetTag = getYagnaSubnet();
        if (options === null || options === void 0 ? void 0 : options.subnetTag) {
            this.subnetTag = options.subnetTag;
        }
    }
}

class BasicDemandDirector {
    constructor(config = new BasicDemandDirectorConfig()) {
        this.config = config;
    }
    apply(builder) {
        builder
            .addProperty("golem.srv.caps.multi-activity", true)
            .addProperty("golem.node.debug.subnet", this.config.subnetTag);
        builder
            .addConstraint("golem.com.pricing.model", "linear")
            .addConstraint("golem.node.debug.subnet", this.config.subnetTag);
    }
}

class PaymentDemandDirectorConfig extends BaseConfig {
    constructor(options) {
        super();
        this.debitNotesAcceptanceTimeoutSec = 2 * 60; // 2 minutes
        this.midAgreementDebitNoteIntervalSec = 2 * 60; // 2 minutes
        this.midAgreementPaymentTimeoutSec = 12 * 60 * 60; // 12 hours
        if (options) {
            Object.assign(this, options);
        }
        if (!this.isPositiveInt(this.debitNotesAcceptanceTimeoutSec)) {
            throw new GolemConfigError("The debit note acceptance timeout time has to be a positive integer");
        }
        if (!this.isPositiveInt(this.midAgreementDebitNoteIntervalSec)) {
            throw new GolemConfigError("The debit note interval time has to be a positive integer");
        }
        if (!this.isPositiveInt(this.midAgreementPaymentTimeoutSec)) {
            throw new GolemConfigError("The mid-agreement payment timeout time has to be a positive integer");
        }
    }
}

class PaymentDemandDirector {
    constructor(allocation, marketApiAdapter, config = new PaymentDemandDirectorConfig()) {
        this.allocation = allocation;
        this.marketApiAdapter = marketApiAdapter;
        this.config = config;
    }
    async apply(builder) {
        // Configure mid-agreement payments
        builder
            .addProperty("golem.com.scheme.payu.debit-note.interval-sec?", this.config.midAgreementDebitNoteIntervalSec)
            .addProperty("golem.com.scheme.payu.payment-timeout-sec?", this.config.midAgreementPaymentTimeoutSec)
            .addProperty("golem.com.payment.debit-notes.accept-timeout?", this.config.debitNotesAcceptanceTimeoutSec);
        // Configure payment platform
        const { constraints, properties } = await this.marketApiAdapter.getPaymentRelatedDemandDecorations(this.allocation.id);
        builder.mergePrototype({ constraints, properties });
    }
}

class WorkloadDemandDirector {
    constructor(config) {
        this.config = config;
    }
    async apply(builder) {
        builder.addProperty("golem.srv.comp.expiration", Date.now() + this.config.expirationSec * 1000);
        builder
            .addProperty("golem.srv.comp.vm.package_format", this.config.packageFormat)
            .addConstraint("golem.runtime.name", this.config.runtime.name);
        if (this.config.runtime.version) {
            builder.addConstraint("golem.runtime.version", this.config.runtime.version);
        }
        if (this.config.capabilities.length)
            this.config.capabilities.forEach((cap) => builder.addConstraint("golem.runtime.capabilities", cap));
        builder
            .addConstraint("golem.inf.mem.gib", this.config.minMemGib, ComparisonOperator.GtEq)
            .addConstraint("golem.inf.storage.gib", this.config.minStorageGib, ComparisonOperator.GtEq)
            .addConstraint("golem.inf.cpu.cores", this.config.minCpuCores, ComparisonOperator.GtEq)
            .addConstraint("golem.inf.cpu.threads", this.config.minCpuThreads, ComparisonOperator.GtEq);
        if (this.config.imageUrl) {
            const taskPackage = await this.resolveTaskPackageFromCustomUrl();
            builder.addProperty("golem.srv.comp.task_package", taskPackage);
        }
        else if (this.config.imageHash || this.config.imageTag) {
            const taskPackage = await this.resolveTaskPackageUrl();
            builder.addProperty("golem.srv.comp.task_package", taskPackage);
        }
        this.addManifestDecorations(builder);
    }
    async resolveTaskPackageFromCustomUrl() {
        if (!this.config.imageUrl) {
            throw new GolemPlatformError("Tried to resolve task package from custom url, but no url was provided");
        }
        if (!this.config.imageHash) {
            throw new GolemPlatformError("Tried to resolve task package from custom url, but no hash was provided. Please calculate the SHA3-224 hash of the image and provide it as `imageHash`");
        }
        return `hash:sha3:${this.config.imageHash}:${this.config.imageUrl}`;
    }
    async resolveTaskPackageUrl() {
        const repoUrl = getRepoUrl();
        const useHttps = this.config.useHttps;
        const isDev = isDevMode();
        let hash = this.config.imageHash;
        const tag = this.config.imageTag;
        const url = `${repoUrl}/v1/image/info?${isDev ? "dev=true" : "count=true"}&${tag ? `tag=${tag}` : `hash=${hash}`}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new GolemPlatformError(`Unable to get image ${await response.text()}`);
            }
            const data = await response.json();
            const imageUrl = useHttps ? data.https : data.http;
            hash = data.sha3;
            return `hash:sha3:${hash}:${imageUrl}`;
        }
        catch (error) {
            if (error instanceof GolemError)
                throw error;
            throw new GolemPlatformError(`Failed to fetch image: ${error}`);
        }
    }
    addManifestDecorations(builder) {
        if (!this.config.manifest)
            return;
        builder.addProperty("golem.srv.comp.payload", this.config.manifest);
        if (this.config.manifestSig)
            builder.addProperty("golem.srv.comp.payload.sig", this.config.manifestSig);
        if (this.config.manifestSigAlgorithm)
            builder.addProperty("golem.srv.comp.payload.sig.algorithm", this.config.manifestSigAlgorithm);
        if (this.config.manifestCert)
            builder.addProperty("golem.srv.comp.payload.cert", this.config.manifestCert);
    }
}

class ScanDirector {
    constructor(options) {
        this.options = options;
    }
    async apply(builder) {
        this.addWorkloadDecorations(builder);
        this.addGenericDecorations(builder);
        this.addPaymentDecorations(builder);
    }
    addPaymentDecorations(builder) {
        if (!this.options.payment)
            return;
        const network = this.options.payment.network;
        const driver = this.options.payment.driver || "erc20";
        const token = this.options.payment.token || ["mainnet", "polygon"].includes(network) ? "glm" : "tglm";
        builder.addConstraint(`golem.com.payment.platform.${driver}-${network}-${token}.address`, "*");
    }
    addWorkloadDecorations(builder) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1;
        if (((_a = this.options.workload) === null || _a === void 0 ? void 0 : _a.engine) && ((_b = this.options.workload) === null || _b === void 0 ? void 0 : _b.runtime)) {
            throw new GolemConfigError("The engine parameter is deprecated and cannot be used with the runtime parameter. Use the runtime parameter only");
        }
        /** @deprecated  */
        if ((_c = this.options.workload) === null || _c === void 0 ? void 0 : _c.engine) {
            builder.addConstraint("golem.runtime.name", (_d = this.options.workload) === null || _d === void 0 ? void 0 : _d.engine);
        }
        if ((_f = (_e = this.options.workload) === null || _e === void 0 ? void 0 : _e.runtime) === null || _f === void 0 ? void 0 : _f.name) {
            builder.addConstraint("golem.runtime.name", this.options.workload.runtime.name);
        }
        if ((_h = (_g = this.options.workload) === null || _g === void 0 ? void 0 : _g.runtime) === null || _h === void 0 ? void 0 : _h.version) {
            builder.addConstraint("golem.runtime.version", this.options.workload.runtime.version);
        }
        if ((_j = this.options.workload) === null || _j === void 0 ? void 0 : _j.capabilities)
            (_k = this.options.workload) === null || _k === void 0 ? void 0 : _k.capabilities.forEach((cap) => builder.addConstraint("golem.runtime.capabilities", cap));
        if ((_l = this.options.workload) === null || _l === void 0 ? void 0 : _l.minMemGib) {
            builder.addConstraint("golem.inf.mem.gib", (_m = this.options.workload) === null || _m === void 0 ? void 0 : _m.minMemGib, ComparisonOperator.GtEq);
        }
        if ((_o = this.options.workload) === null || _o === void 0 ? void 0 : _o.maxMemGib) {
            builder.addConstraint("golem.inf.mem.gib", (_p = this.options.workload) === null || _p === void 0 ? void 0 : _p.maxMemGib, ComparisonOperator.LtEq);
        }
        if ((_q = this.options.workload) === null || _q === void 0 ? void 0 : _q.minStorageGib) {
            builder.addConstraint("golem.inf.storage.gib", (_r = this.options.workload) === null || _r === void 0 ? void 0 : _r.minStorageGib, ComparisonOperator.GtEq);
        }
        if ((_s = this.options.workload) === null || _s === void 0 ? void 0 : _s.maxStorageGib) {
            builder.addConstraint("golem.inf.storage.gib", (_t = this.options.workload) === null || _t === void 0 ? void 0 : _t.maxStorageGib, ComparisonOperator.LtEq);
        }
        if ((_u = this.options.workload) === null || _u === void 0 ? void 0 : _u.minCpuThreads) {
            builder.addConstraint("golem.inf.cpu.threads", (_v = this.options.workload) === null || _v === void 0 ? void 0 : _v.minCpuThreads, ComparisonOperator.GtEq);
        }
        if ((_w = this.options.workload) === null || _w === void 0 ? void 0 : _w.maxCpuThreads) {
            builder.addConstraint("golem.inf.cpu.threads", (_x = this.options.workload) === null || _x === void 0 ? void 0 : _x.maxCpuThreads, ComparisonOperator.LtEq);
        }
        if ((_y = this.options.workload) === null || _y === void 0 ? void 0 : _y.minCpuCores) {
            builder.addConstraint("golem.inf.cpu.cores", (_z = this.options.workload) === null || _z === void 0 ? void 0 : _z.minCpuCores, ComparisonOperator.GtEq);
        }
        if ((_0 = this.options.workload) === null || _0 === void 0 ? void 0 : _0.maxCpuCores) {
            builder.addConstraint("golem.inf.cpu.cores", (_1 = this.options.workload) === null || _1 === void 0 ? void 0 : _1.maxCpuCores, ComparisonOperator.LtEq);
        }
    }
    addGenericDecorations(builder) {
        if (this.options.subnetTag) {
            builder.addConstraint("golem.node.debug.subnet", this.options.subnetTag);
        }
    }
}

class ScannedOffer {
    constructor(model) {
        this.model = model;
    }
    get properties() {
        return this.model.properties;
    }
    get constraints() {
        return this.model.constraints;
    }
    get pricing() {
        var _a, _b;
        const usageVector = this.properties["golem.com.usage.vector"];
        const priceVector = this.properties["golem.com.pricing.model.linear.coeffs"];
        if (!usageVector) {
            throw new GolemInternalError("The proposal does not contain 'golem.com.usage.vector' property. We can't estimate the costs.");
        }
        if (!priceVector) {
            throw new GolemInternalError("The proposal does not contain 'golem.com.pricing.model.linear.coeffs' property. We can't estimate costs.");
        }
        const envIdx = usageVector.findIndex((ele) => ele === "golem.usage.duration_sec");
        const cpuIdx = usageVector.findIndex((ele) => ele === "golem.usage.cpu_sec");
        const envSec = (_a = priceVector[envIdx]) !== null && _a !== void 0 ? _a : 0.0;
        const cpuSec = (_b = priceVector[cpuIdx]) !== null && _b !== void 0 ? _b : 0.0;
        const start = priceVector[priceVector.length - 1];
        return {
            cpuSec,
            envSec,
            start,
        };
    }
    get provider() {
        return {
            id: this.model.providerId,
            name: this.properties["golem.node.id.name"] || "<unknown>",
        };
    }
    get transferProtocol() {
        return this.properties["golem.activity.caps.transfer.protocol"];
    }
    get cpuBrand() {
        return this.properties["golem.inf.cpu.brand"];
    }
    get cpuVendor() {
        return this.properties["golem.inf.cpu.vendor"];
    }
    get cpuCapabilities() {
        return this.properties["golem.inf.cpu.capabilities"];
    }
    get cpuCores() {
        return this.properties["golem.inf.cpu.cores"];
    }
    get cpuThreads() {
        return this.properties["golem.inf.cpu.threads"];
    }
    get gpuBrand() {
        return this.properties["golem.!exp.gap-35.v1.inf.gpu.model"];
    }
    /** @deprecated Use {@link memoryGib} instead */
    get memory() {
        return this.memoryGib;
    }
    get memoryGib() {
        return this.properties["golem.inf.mem.gib"];
    }
    /** @deprecated Use {@link storageGib} instead */
    get storage() {
        return this.storageGib;
    }
    get storageGib() {
        return this.properties["golem.inf.storage.gib"];
    }
    get publicNet() {
        return this.properties["golem.node.net.is-public"];
    }
    get runtimeCapabilities() {
        return this.properties["golem.runtime.capabilities"];
    }
    get runtimeName() {
        return this.properties["golem.runtime.name"];
    }
    get runtimeVersion() {
        return this.properties["golem.runtime.version"];
    }
    /**
     * Get the ID of the offer published by the Provider
     *
     * Note:
     * - this ID will change after the provider refreshes the offer (usually after 1h)
     * - this ID will remain unchanged for the same published offer between different scans
     */
    get offerId() {
        return this.model.offerId;
    }
    /**
     * The timestamp at which the offer was generated by the Provider
     */
    get offerCreateAt() {
        return this.model.timestamp;
    }
    /**
     * Lists down payment addresses on different payment platforms
     *
     * @example Example return value
     * ```json
     * {
     *  "erc20-polygon-glm": "0x8737beea5668595fda9d50e85cae9cad10b4c980",
     *  "erc20-holesky-tglm:" "0x8737beea5668595fda9d50e85cae9cad10b4c980",
     * }
     * ```
     */
    get paymentPlatformAddresses() {
        const propRegex = /golem\.com\.payment\.platform\.([a-z0-9-]+)\.address/;
        const platformAddress = Object.entries(this.model.properties)
            .map(([key, address]) => {
            const match = key.match(propRegex);
            return [match ? match[1] : "", address];
        })
            .filter(([key]) => !!key);
        return Object.fromEntries(platformAddress);
    }
    /**
     * Cost estimation based on CPU/h, ENV/h and start prices
     *
     * @param rentHours Number of hours of rental to use for the estimation
     */
    getEstimatedCost(rentHours = 1) {
        const threadsNo = this.cpuThreads;
        const rentSeconds = rentHours * 60 * 60;
        return this.pricing.start + this.pricing.cpuSec * threadsNo * rentSeconds + this.pricing.envSec * rentSeconds;
    }
}

class MarketModuleImpl {
    constructor(deps, options) {
        this.deps = deps;
        this.events = new EventEmitter();
        this.logger = defaultLogger("market");
        this.logger = deps.logger;
        this.marketApi = deps.marketApi;
        this.fileServer = deps.fileServer;
        this.options = {
            ...{ demandRefreshIntervalSec: 30 * 60 },
            ...options,
        };
        this.collectAndEmitAgreementEvents();
    }
    async buildDemandDetails(demandOptions, orderOptions, allocation) {
        const builder = new DemandBodyBuilder();
        // Instruct the builder what's required
        const basicConfig = new BasicDemandDirectorConfig({
            subnetTag: demandOptions.subnetTag,
        });
        const basicDirector = new BasicDemandDirector(basicConfig);
        basicDirector.apply(builder);
        const workloadOptions = demandOptions.workload
            ? await this.applyLocalGVMIServeSupport(demandOptions.workload)
            : demandOptions.workload;
        const expirationSec = orderOptions.rentHours * 60 * 60;
        /**
         * Default value on providers for MIN_AGREEMENT_EXPIRATION = 5min.
         * This means that if the user declares a rentHours time of less than 5 min,
         * offers will be rejected during negotiations with these providers.
         */
        const MIN_EXPIRATION_SEC_WARN = 5 * 60;
        if (expirationSec < MIN_EXPIRATION_SEC_WARN) {
            this.logger.warn("The declared value of rentHours is less than 5 min. This may cause offers to be rejected during negotiations.");
        }
        const workloadConfig = new WorkloadDemandDirectorConfig({
            ...workloadOptions,
            expirationSec,
        });
        const workloadDirector = new WorkloadDemandDirector(workloadConfig);
        await workloadDirector.apply(builder);
        const paymentConfig = new PaymentDemandDirectorConfig(demandOptions.payment);
        const paymentDirector = new PaymentDemandDirector(allocation, this.deps.marketApi, paymentConfig);
        await paymentDirector.apply(builder);
        return new DemandSpecification(builder.getProduct(), allocation.paymentPlatform);
    }
    buildScanSpecification(options) {
        const builder = new DemandBodyBuilder();
        const director = new ScanDirector(options);
        director.apply(builder);
        return builder.getProduct();
    }
    /**
     * Augments the user-provided options with additional logic
     *
     * Use Case: serve the GVMI from the requestor and avoid registry
     */
    async applyLocalGVMIServeSupport(options) {
        var _a, _b, _c;
        if ((_a = options.imageUrl) === null || _a === void 0 ? void 0 : _a.startsWith("file://")) {
            const sourcePath = (_b = options.imageUrl) === null || _b === void 0 ? void 0 : _b.replace("file://", "");
            const publishInfo = (_c = this.fileServer.getPublishInfo(sourcePath)) !== null && _c !== void 0 ? _c : (await this.fileServer.publishFile(sourcePath));
            const { fileUrl: imageUrl, fileHash: imageHash } = publishInfo;
            this.logger.debug("Applied local GVMI serve support", {
                sourcePath,
                publishInfo,
            });
            return {
                ...options,
                imageUrl,
                imageHash,
            };
        }
        return options;
    }
    /**
     * Publishes the specified demand and re-publishes it based on demandSpecification.expirationSec interval
     */
    publishAndRefreshDemand(demandSpecification) {
        return new Observable((subscriber) => {
            let currentDemand;
            const subscribeToOfferProposals = async () => {
                try {
                    currentDemand = await this.deps.marketApi.publishDemandSpecification(demandSpecification);
                    subscriber.next(currentDemand);
                    this.events.emit("demandSubscriptionStarted", {
                        demand: currentDemand,
                    });
                    this.logger.debug("Subscribing for proposals matched with the demand", { demand: currentDemand });
                    return currentDemand;
                }
                catch (err) {
                    const golemMarketError = new GolemMarketError(`Could not publish demand on the market`, MarketErrorCode.SubscriptionFailed, err);
                    subscriber.error(golemMarketError);
                }
            };
            const unsubscribeFromOfferProposals = async (demand) => {
                try {
                    await this.deps.marketApi.unpublishDemand(demand);
                    this.logger.info("Unpublished demand", { demandId: demand.id });
                    this.logger.debug("Unpublished demand", demand);
                    this.events.emit("demandSubscriptionStopped", {
                        demand,
                    });
                }
                catch (err) {
                    const golemMarketError = new GolemMarketError(`Could not publish demand on the market`, MarketErrorCode.SubscriptionFailed, err);
                    subscriber.error(golemMarketError);
                }
            };
            void subscribeToOfferProposals();
            const interval = setInterval(() => {
                Promise.all([unsubscribeFromOfferProposals(currentDemand), subscribeToOfferProposals()])
                    .then(([, demand]) => {
                    if (demand) {
                        this.events.emit("demandSubscriptionRefreshed", {
                            demand,
                        });
                        this.logger.info("Refreshed subscription for offer proposals with the new demand", { demand });
                    }
                })
                    .catch((err) => {
                    this.logger.error("Error while re-publishing demand for offers", err);
                    subscriber.error(err);
                });
            }, this.options.demandRefreshIntervalSec * 1000);
            return () => {
                clearInterval(interval);
                if (currentDemand) {
                    void unsubscribeFromOfferProposals(currentDemand);
                }
            };
        });
    }
    collectMarketProposalEvents(demand) {
        return this.deps.marketApi.collectMarketProposalEvents(demand).pipe(tap((event) => this.logger.debug("Received demand offer event from yagna", { event })), tap((event) => this.emitMarketProposalEvents(event)));
    }
    collectAllOfferProposals(demand) {
        return this.collectMarketProposalEvents(demand).pipe(filter((event) => event.type === "ProposalReceived"), map((event) => event.proposal));
    }
    async negotiateProposal(offerProposal, counterDemand) {
        try {
            const counterProposal = await this.deps.marketApi.counterProposal(offerProposal, counterDemand);
            this.logger.debug("Counter proposal sent", counterProposal);
            this.events.emit("offerCounterProposalSent", {
                offerProposal,
                counterProposal,
            });
            return counterProposal;
        }
        catch (error) {
            this.events.emit("errorSendingCounterProposal", {
                offerProposal,
                error,
            });
            throw error;
        }
    }
    async proposeAgreement(proposal, options) {
        const agreement = await this.marketApi.proposeAgreement(proposal, options);
        this.logger.info("Proposed and got approval for agreement", {
            agreementId: agreement.id,
            provider: agreement.provider,
        });
        return agreement;
    }
    async terminateAgreement(agreement, reason) {
        await this.marketApi.terminateAgreement(agreement, reason);
        this.logger.info("Terminated agreement", {
            agreementId: agreement.id,
            provider: agreement.provider,
            reason,
        });
        return agreement;
    }
    collectDraftOfferProposals(options) {
        return this.publishAndRefreshDemand(options.demandSpecification).pipe(
        // For each fresh demand, start to watch the related market conversation events
        switchMap((freshDemand) => this.collectMarketProposalEvents(freshDemand)), 
        // Select only events for proposal received
        filter((event) => event.type === "ProposalReceived"), 
        // Convert event to proposal
        map((event) => event.proposal), 
        // We are interested only in Initial and Draft proposals, that are valid
        filter((proposal) => (proposal.isInitial() || proposal.isDraft()) && proposal.isValid()), 
        // If they are accepted by the pricing criteria
        filter((proposal) => this.filterProposalsByPricingOptions(options.pricing, proposal)), 
        // If they are accepted by the user filter
        filter((proposal) => ((options === null || options === void 0 ? void 0 : options.filter) ? this.filterProposalsByUserFilter(options.filter, proposal) : true)), 
        // Batch initial proposals and  deduplicate them by provider key, pass-though proposals in other states
        this.reduceInitialProposalsByProviderKey({
            minProposalsBatchSize: options === null || options === void 0 ? void 0 : options.minProposalsBatchSize,
            proposalsBatchReleaseTimeoutMs: options === null || options === void 0 ? void 0 : options.proposalsBatchReleaseTimeoutMs,
        }), 
        // Tap-in negotiator logic and negotiate initial proposals
        tap((proposal) => {
            if (proposal.isInitial()) {
                this.negotiateProposal(proposal, options.demandSpecification).catch((err) => this.logger.error("Failed to negotiate the proposal", err));
            }
        }), 
        // Continue only with drafts
        filter((proposal) => proposal.isDraft()));
    }
    emitMarketProposalEvents(event) {
        const { type } = event;
        switch (type) {
            case "ProposalReceived":
                this.events.emit("offerProposalReceived", {
                    offerProposal: event.proposal,
                });
                break;
            case "ProposalRejected":
                this.events.emit("offerCounterProposalRejected", {
                    counterProposal: event.counterProposal,
                    reason: event.reason,
                });
                break;
            case "PropertyQueryReceived":
                this.events.emit("offerPropertyQueryReceived");
                break;
            default:
                this.logger.warn("Unsupported event type in event", { event });
                break;
        }
    }
    async signAgreementFromPool(draftProposalPool, agreementOptions, signalOrTimeout) {
        this.logger.info("Trying to sign an agreement...");
        const signal = createAbortSignalFromTimeout(signalOrTimeout);
        const getProposal = async () => {
            try {
                signal.throwIfAborted();
                this.logger.debug("Acquiring proposal from draft proposal pool", {
                    draftPoolCounters: {
                        total: draftProposalPool.count(),
                        available: draftProposalPool.availableCount(),
                    },
                });
                const proposal = await draftProposalPool.acquire(signal);
                this.logger.debug("Acquired proposal from the pool", { proposal });
                if (signal.aborted) {
                    draftProposalPool.release(proposal);
                    signal.throwIfAborted();
                }
                return proposal;
            }
            catch (error) {
                if (signal.aborted) {
                    throw signal.reason.name === "TimeoutError"
                        ? new GolemTimeoutError("Could not sign any agreement in time")
                        : new GolemAbortError("The signing of the agreement has been aborted", error);
                }
                throw error;
            }
        };
        const tryProposing = async () => {
            const proposal = await getProposal();
            try {
                const agreement = await this.proposeAgreement(proposal, agreementOptions);
                // agreement is valid, proposal can be destroyed
                draftProposalPool.remove(proposal);
                return agreement;
            }
            catch (error) {
                this.logger.debug("Failed to propose agreement, retrying", { error });
                // We failed to propose the agreement, destroy the proposal and try again with another one
                draftProposalPool.remove(proposal);
                return runOnNextEventLoopIteration(tryProposing);
            }
        };
        return tryProposing();
    }
    /**
     * Reduce initial proposals to a set grouped by the provider's key to avoid duplicate offers
     */
    reduceInitialProposalsByProviderKey(options) {
        return (input) => new Observable((observer) => {
            let isCancelled = false;
            const proposalsBatch = new ProposalsBatch({
                minBatchSize: options === null || options === void 0 ? void 0 : options.minProposalsBatchSize,
                releaseTimeoutMs: options === null || options === void 0 ? void 0 : options.proposalsBatchReleaseTimeoutMs,
            });
            const subscription = input.subscribe((proposal) => {
                if (proposal.isInitial()) {
                    proposalsBatch
                        .addProposal(proposal)
                        .catch((err) => this.logger.error("Failed to add the initial proposal to the batch", err));
                }
                else {
                    observer.next(proposal);
                }
            });
            const batch = async () => {
                if (isCancelled) {
                    return;
                }
                try {
                    await proposalsBatch.waitForProposals();
                    const proposals = await proposalsBatch.getProposals();
                    if (proposals.length > 0) {
                        this.logger.debug("Received batch of proposals", { count: proposals.length });
                        proposals.forEach((proposal) => observer.next(proposal));
                    }
                }
                catch (error) {
                    observer.error(error);
                }
                batch();
            };
            batch();
            return () => {
                isCancelled = true;
                subscription.unsubscribe();
            };
        });
    }
    estimateBudget({ order, maxAgreements }) {
        var _a, _b;
        const pricingModel = order.market.pricing.model;
        // TODO: Don't assume for the user, at least not on pure golem-js level
        const minCpuThreads = (_b = (_a = order.demand.workload) === null || _a === void 0 ? void 0 : _a.minCpuThreads) !== null && _b !== void 0 ? _b : 1;
        const { rentHours } = order.market;
        switch (pricingModel) {
            case "linear": {
                const { maxCpuPerHourPrice, maxStartPrice, maxEnvPerHourPrice } = order.market.pricing;
                const threadCost = maxAgreements * rentHours * minCpuThreads * maxCpuPerHourPrice;
                const startCost = maxAgreements * maxStartPrice;
                const envCost = maxAgreements * rentHours * maxEnvPerHourPrice;
                return startCost + envCost + threadCost;
            }
            case "burn-rate":
                return maxAgreements * rentHours * order.market.pricing.avgGlmPerHour;
            default:
                throw new GolemUserError(`Unsupported pricing model ${pricingModel}`);
        }
    }
    async fetchAgreement(agreementId) {
        return this.marketApi.getAgreement(agreementId);
    }
    /**
     * Subscribes to an observable that maps yagna events into our domain events
     * and emits these domain events via EventEmitter
     */
    collectAndEmitAgreementEvents() {
        this.marketApi.collectAgreementEvents().subscribe((event) => {
            switch (event.type) {
                case "AgreementApproved":
                    this.events.emit("agreementApproved", {
                        agreement: event.agreement,
                    });
                    break;
                case "AgreementCancelled":
                    this.events.emit("agreementCancelled", {
                        agreement: event.agreement,
                    });
                    break;
                case "AgreementTerminated":
                    this.events.emit("agreementTerminated", {
                        agreement: event.agreement,
                        reason: event.reason,
                        terminatedBy: event.terminatedBy,
                    });
                    break;
                case "AgreementRejected":
                    this.events.emit("agreementRejected", {
                        agreement: event.agreement,
                        reason: event.reason,
                    });
                    break;
            }
        });
    }
    filterProposalsByUserFilter(filter, proposal) {
        try {
            const result = filter(proposal);
            if (!result) {
                this.events.emit("offerProposalRejectedByProposalFilter", {
                    offerProposal: proposal,
                });
                this.logger.debug("The offer was rejected by the user filter", { id: proposal.id });
            }
            return result;
        }
        catch (err) {
            this.logger.error("Executing user provided proposal filter resulted with an error", err);
            throw err;
        }
    }
    filterProposalsByPricingOptions(pricing, proposal) {
        let isPriceValid = true;
        if (pricing.model === "linear") {
            isPriceValid =
                proposal.pricing.cpuSec <= pricing.maxCpuPerHourPrice / 3600 &&
                    proposal.pricing.envSec <= pricing.maxEnvPerHourPrice / 3600 &&
                    proposal.pricing.start <= pricing.maxStartPrice;
        }
        else if (pricing.model === "burn-rate") {
            isPriceValid =
                proposal.pricing.start + proposal.pricing.envSec * 3600 + proposal.pricing.cpuSec * 3600 <=
                    pricing.avgGlmPerHour;
        }
        if (!isPriceValid) {
            this.events.emit("offerProposalRejectedByPriceFilter", {
                offerProposal: proposal,
            });
            this.logger.debug("The offer was ignored because the price was too high", {
                id: proposal.id,
                pricing: proposal.pricing,
            });
        }
        return isPriceValid;
    }
    scan(scanSpecification) {
        return this.deps.marketApi.scan(scanSpecification);
    }
}

/**
 * Agreement module - an object representing the contract between the requestor and the provider.
 */
class Agreement {
    /**
     * @param id
     * @param model
     * @param demand
     */
    constructor(id, model, demand) {
        this.id = id;
        this.model = model;
        this.demand = demand;
    }
    /**
     * Return agreement state
     * @return state
     */
    getState() {
        return this.model.state;
    }
    get provider() {
        return {
            id: this.model.offer.providerId,
            name: this.model.offer.properties["golem.node.id.name"],
            walletAddress: this.model.offer.properties[`golem.com.payment.platform.${this.demand.paymentPlatform}.address`],
        };
    }
    /**
     * Returns flag if the agreement is in the final state
     * @description if the final state is true, agreement will not change state further anymore
     * @return boolean
     */
    isFinalState() {
        const state = this.getState();
        return state !== "Pending" && state !== "Proposal";
    }
}

/**
 * Common properties and methods for payment related documents - Invoices and DebitNotes
 */
class BaseDocument {
    constructor(id, model, provider) {
        this.id = id;
        this.model = model;
        this.provider = provider;
        this.recipientId = model.recipientId;
        this.payeeAddr = model.payeeAddr;
        this.requestorWalletAddress = model.payerAddr;
        this.paymentPlatform = model.paymentPlatform;
        this.agreementId = model.agreementId;
        this.paymentDueDate = model.paymentDueDate;
        this.status = model.status;
    }
    /**
     * Tells what's the current status of the document
     */
    getStatus() {
        return this.status;
    }
}

/**
 * An Invoice is an artifact issued by the Provider to the Requestor, in the context of a specific Agreement. It indicates the total Amount owed by the Requestor in this Agreement. No further Debit Notes shall be issued after the Invoice is issued. The issue of Invoice signals the Termination of the Agreement (if it hasn't been terminated already). No Activity execution is allowed after the Invoice is issued.
 */
class Invoice extends BaseDocument {
    /**
     * @param model
     * @param providerInfo
     */
    constructor(model, providerInfo) {
        super(model.invoiceId, model, providerInfo);
        this.model = model;
        this.activityIds = model.activityIds;
        this.amount = model.amount;
        this.timestamp = model.timestamp;
        this.recipientId = model.recipientId;
    }
    getPreciseAmount() {
        return new Decimal(this.amount);
    }
    /**
     * Compares two invoices together and tells if they are the same thing
     */
    isSameAs(invoice) {
        return this.id === invoice.id && this.amount === invoice.amount && this.agreementId === invoice.agreementId;
    }
}

/**
 * A Debit Note is an artifact issued by the Provider to the Requestor, in the context of a specific Activity. It is a notification of Total Amount Due incurred by the Activity until the moment the Debit Note is issued. This is expected to be used as trigger for payment in upfront-payment or pay-as-you-go scenarios. NOTE: Only Debit Notes with non-null paymentDueDate are expected to trigger payments. NOTE: Debit Notes flag the current Total Amount Due, which is accumulated from the start of Activity. Debit Notes are expected to trigger payments, therefore payment amount for the newly received Debit Note is expected to be determined by difference of Total Payments for the Agreement vs Total Amount Due.
 */
class DebitNote extends BaseDocument {
    /**
     *
     * @param model
     * @param providerInfo
     */
    constructor(model, providerInfo) {
        super(model.debitNoteId, model, providerInfo);
        this.model = model;
        this.id = model.debitNoteId;
        this.timestamp = model.timestamp;
        this.activityId = model.activityId;
        this.totalAmountDue = model.totalAmountDue;
        this.usageCounterVector = model.usageCounterVector;
    }
    getPreciseAmount() {
        return new Decimal(this.totalAmountDue);
    }
}

/**
 * Represents a designated sum of money reserved for the purpose of making some particular payments. Allocations are currently purely virtual objects. An Allocation is connected to a payment account (wallet) specified by address and payment platform field.
 */
class Allocation {
    constructor(model) {
        this.model = model;
        this.id = model.allocationId;
        this.timeout = model.timeout;
        this.timestamp = model.timestamp;
        this.totalAmount = model.totalAmount;
        this.spentAmount = model.spentAmount;
        this.remainingAmount = model.remainingAmount;
        if (!model.address || !model.paymentPlatform) {
            throw new GolemConfigError("Account address and payment platform are required");
        }
        this.address = model.address;
        this.paymentPlatform = model.paymentPlatform;
    }
}

var RejectionReason;
(function (RejectionReason) {
    RejectionReason["UnsolicitedService"] = "UNSOLICITED_SERVICE";
    RejectionReason["BadService"] = "BAD_SERVICE";
    RejectionReason["IncorrectAmount"] = "INCORRECT_AMOUNT";
    RejectionReason["RejectedByRequestorFilter"] = "REJECTED_BY_REQUESTOR_FILTER";
    /**
     * Use it when you're processing an event after the agreement reached it's "final state"
     *
     * By final state we mean: we got an invoice for that agreement
     */
    RejectionReason["AgreementFinalized"] = "AGREEMENT_FINALIZED";
})(RejectionReason || (RejectionReason = {}));

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __classPrivateFieldGet(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}

function __classPrivateFieldSet(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

var _GolemPaymentError_allocation, _GolemPaymentError_provider;
var PaymentErrorCode;
(function (PaymentErrorCode) {
    PaymentErrorCode["AllocationCreationFailed"] = "AllocationCreationFailed";
    PaymentErrorCode["MissingAllocation"] = "MissingAllocation";
    PaymentErrorCode["PaymentProcessNotInitialized"] = "PaymentProcessNotInitialized";
    PaymentErrorCode["AllocationReleaseFailed"] = "AllocationReleaseFailed";
    PaymentErrorCode["InvoiceAcceptanceFailed"] = "InvoiceAcceptanceFailed";
    PaymentErrorCode["DebitNoteAcceptanceFailed"] = "DebitNoteAcceptanceFailed";
    PaymentErrorCode["InvoiceRejectionFailed"] = "InvoiceRejectionFailed";
    PaymentErrorCode["DebitNoteRejectionFailed"] = "DebitNoteRejectionFailed";
    PaymentErrorCode["CouldNotGetDebitNote"] = "CouldNotGetDebitNote";
    PaymentErrorCode["CouldNotGetInvoice"] = "CouldNotGetInvoice";
    PaymentErrorCode["PaymentStatusQueryFailed"] = "PaymentStatusQueryFailed";
    PaymentErrorCode["AgreementAlreadyPaid"] = "AgreementAlreadyPaid";
    PaymentErrorCode["InvoiceAlreadyReceived"] = "InvoiceAlreadyReceived";
})(PaymentErrorCode || (PaymentErrorCode = {}));
class GolemPaymentError extends GolemModuleError {
    constructor(message, code, allocation, provider, previous) {
        super(message, code, previous);
        this.code = code;
        this.previous = previous;
        _GolemPaymentError_allocation.set(this, void 0);
        _GolemPaymentError_provider.set(this, void 0);
        __classPrivateFieldSet(this, _GolemPaymentError_allocation, allocation, "f");
        __classPrivateFieldSet(this, _GolemPaymentError_provider, provider, "f");
    }
    getAllocation() {
        return __classPrivateFieldGet(this, _GolemPaymentError_allocation, "f");
    }
    getProvider() {
        return __classPrivateFieldGet(this, _GolemPaymentError_provider, "f");
    }
}
_GolemPaymentError_allocation = new WeakMap(), _GolemPaymentError_provider = new WeakMap();

/**
 * A class that provides methods for working with invoices. It interacts with the Yagna API directly.
 */
class InvoiceProcessor {
    /**
     * Use `InvoiceProcessor.create()` to create an instance of this class.
     */
    constructor(api) {
        this.api = api;
    }
    /**
     * Collects invoices from the Yagna API until the limit is reached or there are no more invoices.
     * @param {Object} options - The parameters for collecting invoices.
     * @param options.after Only collect invoices that were created after this date.
     * @param options.limit Maximum number of invoices to collect.
     * @param options.statuses Only collect invoices with these statuses.
     * @param options.providerIds Only collect invoices from these providers.
     * @param options.minAmount Only collect invoices with an amount greater than or equal to this.
     * @param options.maxAmount Only collect invoices with an amount less than or equal to this.
     * @param options.providerWallets Only collect invoices from these provider wallets.
     * @param options.paymentPlatforms Only collect invoices from these payment platforms.
     *
     * @example
     * ```typescript
     * const invoices = await invoiceProcessor.collectInvoices({
     *  after: new Date(Date.now() - 24 * 60 * 60 * 1000), // only collect invoices that were created in the last 24 hours
     *  limit: 100, // only collect 100 invoices max
     *  statuses: ["RECEIVED"], // only collect unpaid invoices
     *  providerIds: ["0x1234"], // only collect invoices from this provider
     *  minAmount: "0.1", // only collect invoices with an amount greater than or equal to 0.1 GLM
     *  maxAmount: "1", // only collect invoices with an amount less than or equal to 1 GLM
     *  providerWallets: ["0x1234"], // only collect invoices from this provider wallet
     *  paymentPlatforms: ["erc20-polygon-glm"], // only collect invoices from this payment platform
     * });
     * ```
     */
    async collectInvoices({ after = new Date(0), limit = 50, statuses, providerIds, minAmount, maxAmount, providerWallets, paymentPlatforms, } = {}) {
        // yagna api doesn't sort invoices by timestamp, so we have to fetch all invoices and sort them ourselves
        // this is not very efficient, but it's the only way to get invoices sorted by timestamp
        // otherwise yagna returns the invoices in seemingly random order
        // FIXME: move to batched requests once yagna api supports it
        const invoices = await this.api.payment.getInvoices(after === null || after === void 0 ? void 0 : after.toISOString());
        const filteredInvoices = invoices.filter((invoice) => {
            if (statuses && !statuses.includes(invoice.status)) {
                return false;
            }
            if (providerIds && !providerIds.includes(invoice.issuerId)) {
                return false;
            }
            if (minAmount !== undefined && new Decimal(invoice.amount).lt(minAmount)) {
                return false;
            }
            if (maxAmount !== undefined && new Decimal(invoice.amount).gt(maxAmount)) {
                return false;
            }
            if (providerWallets && !providerWallets.includes(invoice.payeeAddr)) {
                return false;
            }
            if (paymentPlatforms && !paymentPlatforms.includes(invoice.paymentPlatform)) {
                return false;
            }
            return true;
        });
        filteredInvoices.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return filteredInvoices.slice(0, limit);
    }
    /**
     * Fetches a single invoice from the Yagna API.
     */
    async fetchSingleInvoice(invoiceId) {
        return this.api.payment.getInvoice(invoiceId);
    }
    /**
     * Creates an allocation for the exact amount of the invoice and accepts the invoice.
     * If `dryRun` is `true`, no allocation will be created and the invoice will not be accepted.
     */
    async acceptInvoice({ invoice, dryRun = false, }) {
        let allocation = {
            totalAmount: invoice.amount,
            paymentPlatform: invoice.paymentPlatform,
            address: invoice.payerAddr,
            timestamp: new Date().toISOString(),
            timeout: new Date(Date.now() + 60000).toISOString(),
            makeDeposit: false,
            remainingAmount: "",
            spentAmount: "",
            allocationId: "",
        };
        if (dryRun) {
            return {
                allocation,
                amount: invoice.amount,
                invoiceId: invoice.invoiceId,
                success: true,
                dryRun,
            };
        }
        try {
            allocation = await this.api.payment.createAllocation(allocation);
            await this.api.payment.acceptInvoice(invoice.invoiceId, {
                allocationId: allocation.allocationId,
                totalAmountAccepted: invoice.amount,
            });
            return {
                success: true,
                allocation,
                amount: invoice.amount,
                invoiceId: invoice.invoiceId,
                dryRun,
            };
        }
        catch (e) {
            return {
                success: false,
                allocation,
                amount: invoice.amount,
                invoiceId: invoice.invoiceId,
                reason: e,
                dryRun,
            };
        }
    }
    /**
     * Creates an allocation for the exact amount of the invoices and accepts the invoices.
     * Since the invoices can be from different payment platforms and payer addresses,
     * multiple allocations might be created.
     * If `dryRun` is `true`, no allocation will be created and the invoices will not be accepted.
     * Please keep in mind that this method is not atomic, so if one of the invoices fails
     * to be accepted, the others will still be accepted. This is a limitation of the Yagna API.
     * Use the returned `InvoiceAcceptResult` to check which invoices were accepted successfully.
     */
    async acceptManyInvoices({ invoices, dryRun = false, }) {
        /**
         * Allocations are created per payment platform and payer address.
         * So it's necessary to group invoices by payment platform and payer address
         * and create an allocation for each group.
         */
        const groupByPaymentPlatform = (invoiceDetails) => {
            return invoiceDetails.reduce((acc, curr) => {
                acc[curr.paymentPlatform] = acc[curr.paymentPlatform] || [];
                acc[curr.paymentPlatform].push(curr);
                return acc;
            }, {});
        };
        const groupByPayerAddress = (invoiceDetails) => {
            return invoiceDetails.reduce((acc, curr) => {
                acc[curr.payerAddr] = acc[curr.payerAddr] || [];
                acc[curr.payerAddr].push(curr);
                return acc;
            }, {});
        };
        const results = [];
        const groupedByPaymentPlatform = groupByPaymentPlatform(invoices);
        for (const [paymentPlatform, invoices] of Object.entries(groupedByPaymentPlatform)) {
            const groupedByPayerAddress = groupByPayerAddress(invoices);
            for (const [payerAddress, invoices] of Object.entries(groupedByPayerAddress)) {
                const sum = invoices.reduce((acc, curr) => acc.plus(curr.amount), new Decimal(0));
                let allocation = {
                    totalAmount: sum.toFixed(18),
                    paymentPlatform,
                    address: payerAddress,
                    timestamp: new Date().toISOString(),
                    timeout: new Date(Date.now() + 60000).toISOString(),
                    makeDeposit: false,
                    remainingAmount: "",
                    spentAmount: "",
                    allocationId: "",
                };
                if (!dryRun) {
                    allocation = await this.api.payment.createAllocation(allocation);
                }
                for (const invoice of invoices) {
                    if (dryRun) {
                        results.push({
                            invoiceId: invoice.invoiceId,
                            allocation,
                            success: true,
                            amount: invoice.amount,
                            dryRun,
                        });
                        continue;
                    }
                    try {
                        await this.api.payment.acceptInvoice(invoice.invoiceId, {
                            allocationId: allocation.allocationId,
                            totalAmountAccepted: invoice.amount,
                        });
                        results.push({
                            invoiceId: invoice.invoiceId,
                            allocation,
                            success: true,
                            amount: invoice.amount,
                            dryRun,
                        });
                    }
                    catch (e) {
                        results.push({
                            invoiceId: invoice.invoiceId,
                            allocation,
                            success: false,
                            amount: invoice.amount,
                            reason: e,
                            dryRun,
                        });
                    }
                }
            }
        }
        return results;
    }
}

class PayerDetails {
    constructor(network, driver, address, 
    // eslint-disable-next-line @typescript-eslint/ban-types -- keep the autocomplete for "glm" and "tglm" but allow any string
    token) {
        this.network = network;
        this.driver = driver;
        this.address = address;
        this.token = token;
    }
    getPaymentPlatform() {
        return `${this.driver}-${this.network}-${this.token}`;
    }
}

function isApiError(error) {
    return typeof error == "object" && error !== null && "name" in error && error.name === "ApiError";
}
/**
 * Try to extract a message from a yagna API error.
 * If the error is not an instance of `ApiError`, return the error message.
 */
function getMessageFromApiError(error) {
    if (!(error instanceof Error)) {
        return String(error);
    }
    if (isApiError(error)) {
        try {
            return JSON.stringify(error.body, null, 2);
        }
        catch (_jsonParseError) {
            return error.message;
        }
    }
    return error.message;
}

/**
 * Process manager that controls the logic behind processing payments for an agreement (debit notes and invoices).
 * The process is started automatically and ends when the final invoice is received.
 * You can stop the process earlier by calling the `stop` method. You cannot restart the process after stopping it.
 */
class AgreementPaymentProcess {
    constructor(agreement, allocation, paymentModule, options, logger) {
        this.agreement = agreement;
        this.allocation = allocation;
        this.paymentModule = paymentModule;
        this.invoice = null;
        this.debitNotes = new Map();
        /**
         * Lock used to synchronize callers and enforce important business rules
         *
         * Example of a rule: you shouldn't accept a debit note if an invoice is already in place
         */
        this.lock = new AsyncLock();
        this.logger = logger || defaultLogger("payment");
        this.options = {
            invoiceFilter: (options === null || options === void 0 ? void 0 : options.invoiceFilter) || (() => true),
            debitNoteFilter: (options === null || options === void 0 ? void 0 : options.debitNoteFilter) || (() => true),
        };
        const invoiceSubscription = this.paymentModule
            .observeInvoices()
            .pipe(filter((invoice) => invoice.agreementId === this.agreement.id))
            .subscribe({
            next: async (invoice) => {
                try {
                    await this.addInvoice(invoice);
                }
                catch (error) {
                    this.logger.error(`Error processing invoice`, error);
                }
            },
            error: (error) => {
                this.logger.error(`Invoice subscription error`, error);
                this.stop();
            },
        });
        const debitNoteSubscription = this.paymentModule
            .observeDebitNotes()
            .pipe(filter((debitNote) => debitNote.agreementId === this.agreement.id))
            .subscribe({
            next: async (debitNote) => {
                try {
                    await this.addDebitNote(debitNote);
                }
                catch (error) {
                    this.logger.error(`Error processing debit note`, error);
                }
            },
            error: (error) => {
                this.logger.error(`Debit note subscription error`, error);
                this.stop();
            },
        });
        this.cleanupSubscriptions = () => {
            invoiceSubscription.unsubscribe();
            debitNoteSubscription.unsubscribe();
        };
    }
    /**
     * Adds the debit note to the process avoiding race conditions
     */
    addDebitNote(debitNote) {
        return this.lock.acquire(`app-${debitNote.agreementId}`, () => this.applyDebitNote(debitNote));
    }
    /**
     * Adds the invoice to the process avoiding race conditions
     */
    addInvoice(invoice) {
        return this.lock.acquire(`app-${invoice.agreementId}`, () => this.applyInvoice(invoice));
    }
    /**
     * Tells if the process reached a point in which we can consider it as "finished"
     */
    isFinished() {
        return this.invoice !== null;
    }
    async applyDebitNote(debitNote) {
        const isAlreadyFinalized = this.hasReceivedInvoice();
        if (isAlreadyFinalized) {
            await this.rejectDebitNote(debitNote, RejectionReason.AgreementFinalized, `DebitNote ${debitNote.id} rejected because the agreement ${debitNote.agreementId} is already covered ` +
                `with a final invoice that should be paid instead of the debit note`);
            return false;
        }
        if (this.debitNotes.has(debitNote.id)) {
            const isAlreadyProcessed = await this.hasProcessedDebitNote(debitNote);
            if (isAlreadyProcessed) {
                this.logger.warn(`We received a duplicate debit note - the previous one was already accepted, so this one gets ignored`, {
                    debitNoteId: debitNote.id,
                    agreementId: debitNote.agreementId,
                });
                return false;
            }
        }
        this.debitNotes.set(debitNote.id, debitNote);
        let acceptedByFilter = false;
        try {
            acceptedByFilter = await this.options.debitNoteFilter(debitNote, {
                agreement: this.agreement,
                allocation: this.allocation,
                demand: this.agreement.demand,
            });
        }
        catch (error) {
            throw new GolemUserError("An error occurred in the debit note filter", error);
        }
        if (!acceptedByFilter) {
            await this.rejectDebitNote(debitNote, RejectionReason.RejectedByRequestorFilter, `DebitNote ${debitNote.id} for agreement ${debitNote.agreementId} rejected by DebitNote Filter`);
            return false;
        }
        try {
            await this.paymentModule.acceptDebitNote(debitNote, this.allocation, debitNote.totalAmountDue);
            this.logger.debug(`DebitNote accepted`, {
                debitNoteId: debitNote.id,
                agreementId: debitNote.agreementId,
            });
            return true;
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemPaymentError(`Unable to accept debit note ${debitNote.id}. ${message}`, PaymentErrorCode.DebitNoteAcceptanceFailed, undefined, debitNote.provider, error);
        }
    }
    async hasProcessedDebitNote(debitNote) {
        const status = await debitNote.getStatus();
        return status !== "RECEIVED";
    }
    async rejectDebitNote(debitNote, rejectionReason, rejectMessage) {
        try {
            await this.paymentModule.rejectDebitNote(debitNote, rejectMessage);
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemPaymentError(`Unable to reject debit note ${debitNote.id}. ${message}`, PaymentErrorCode.DebitNoteRejectionFailed, undefined, debitNote.provider, error);
        }
    }
    finalize(invoice) {
        this.invoice = invoice;
        this.cleanupSubscriptions();
    }
    async applyInvoice(invoice) {
        this.logger.debug("Applying invoice for agreement", {
            invoiceId: invoice.id,
            agreementId: invoice.agreementId,
            provider: invoice.provider,
        });
        if (this.invoice) {
            // Protects from possible fraud: someone sends a second, different invoice for the same agreement
            throw new GolemPaymentError(`Agreement ${this.agreement.id} is already covered with an invoice: ${this.invoice.id}`, PaymentErrorCode.AgreementAlreadyPaid, this.allocation, this.invoice.provider);
        }
        if (invoice.getStatus() !== "RECEIVED") {
            throw new GolemPaymentError(`The invoice ${invoice.id} for agreement ${invoice.agreementId} has status ${invoice.getStatus()}, ` +
                `but we can accept only the ones with status RECEIVED`, PaymentErrorCode.InvoiceAlreadyReceived, this.allocation, invoice.provider);
        }
        this.finalize(invoice);
        let acceptedByFilter = false;
        try {
            acceptedByFilter = await this.options.invoiceFilter(invoice, {
                agreement: this.agreement,
                allocation: this.allocation,
                demand: this.agreement.demand,
            });
        }
        catch (error) {
            throw new GolemUserError("An error occurred in the invoice filter", error);
        }
        if (!acceptedByFilter) {
            const rejectionReason = RejectionReason.RejectedByRequestorFilter;
            const message = `Invoice ${invoice.id} for agreement ${invoice.agreementId} rejected by Invoice Filter`;
            await this.rejectInvoice(invoice, rejectionReason, message);
            return false;
        }
        try {
            await this.paymentModule.acceptInvoice(invoice, this.allocation, invoice.amount);
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemPaymentError(`Unable to accept invoice ${invoice.id} ${message}`, PaymentErrorCode.InvoiceAcceptanceFailed, undefined, invoice.provider, error);
        }
        return true;
    }
    async rejectInvoice(invoice, rejectionReason, message) {
        try {
            await this.paymentModule.rejectInvoice(invoice, message);
            this.logger.warn(`Invoice rejected`, { reason: message });
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemPaymentError(`Unable to reject invoice ${invoice.id} ${message}`, PaymentErrorCode.InvoiceRejectionFailed, undefined, invoice.provider, error);
        }
    }
    hasReceivedInvoice() {
        return this.invoice !== null;
    }
    isStarted() {
        return this.cleanupSubscriptions !== null;
    }
    stop() {
        this.cleanupSubscriptions();
    }
}

const MAINNETS = Object.freeze(["mainnet", "polygon"]);
class PaymentModuleImpl {
    constructor(deps, options) {
        var _a, _b, _c;
        this.events = new EventEmitter();
        this.logger = defaultLogger("payment");
        this.options = {
            driver: "erc20",
            network: getPaymentNetwork(),
            token: "tglm",
        };
        const network = (_a = options === null || options === void 0 ? void 0 : options.network) !== null && _a !== void 0 ? _a : this.options.network;
        const driver = (_b = options === null || options === void 0 ? void 0 : options.driver) !== null && _b !== void 0 ? _b : this.options.driver;
        const token = (_c = options === null || options === void 0 ? void 0 : options.token) !== null && _c !== void 0 ? _c : (MAINNETS.includes(network) ? "glm" : "tglm");
        this.options = { network, driver, token };
        this.logger = deps.logger;
        this.yagnaApi = deps.yagna;
        this.paymentApi = deps.paymentApi;
        this.startEmittingPaymentEvents();
    }
    startEmittingPaymentEvents() {
        this.paymentApi.receivedInvoices$.subscribe((invoice) => {
            this.events.emit("invoiceReceived", {
                invoice,
            });
        });
        this.paymentApi.receivedDebitNotes$.subscribe((debitNote) => {
            this.events.emit("debitNoteReceived", { debitNote });
        });
    }
    getPaymentPlatform() {
        return `${this.options.driver}-${this.options.network}-${this.options.token}`;
    }
    async getPayerDetails() {
        const { identity: address } = await this.yagnaApi.identity.getIdentity();
        return new PayerDetails(this.options.network, this.options.driver, address, this.options.token);
    }
    observeDebitNotes() {
        return this.paymentApi.receivedDebitNotes$;
    }
    observeInvoices() {
        return this.paymentApi.receivedInvoices$;
    }
    async createAllocation(params) {
        this.logger.debug("Creating allocation", { params: params });
        try {
            const allocation = await this.paymentApi.createAllocation({
                paymentPlatform: this.getPaymentPlatform(),
                ...params,
            });
            this.events.emit("allocationCreated", { allocation });
            this.logger.info("Created allocation", {
                allocationId: allocation.id,
                budget: allocation.totalAmount,
                platform: allocation.paymentPlatform,
            });
            this.logger.debug("Created allocation", allocation);
            return allocation;
        }
        catch (error) {
            this.events.emit("errorCreatingAllocation", error);
            throw error;
        }
    }
    async releaseAllocation(allocation) {
        this.logger.debug("Releasing allocation", allocation);
        try {
            const lastKnownAllocationState = await this.getAllocation(allocation.id).catch(() => {
                this.logger.warn("Failed to fetch allocation before releasing", { id: allocation.id });
                return allocation;
            });
            await this.paymentApi.releaseAllocation(allocation);
            this.events.emit("allocationReleased", {
                allocation: lastKnownAllocationState,
            });
            this.logger.info("Released allocation", {
                allocationId: lastKnownAllocationState.id,
                totalAmount: lastKnownAllocationState.totalAmount,
                spentAmount: lastKnownAllocationState.spentAmount,
            });
        }
        catch (error) {
            this.events.emit("errorReleasingAllocation", {
                allocation: await this.paymentApi.getAllocation(allocation.id).catch(() => {
                    this.logger.warn("Failed to fetch allocation after failed release attempt", { id: allocation.id });
                    return allocation;
                }),
                error,
            });
            throw error;
        }
    }
    getAllocation(id) {
        this.logger.debug("Fetching allocation by id", { id });
        return this.paymentApi.getAllocation(id);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    amendAllocation(allocation, _newOpts) {
        const err = Error("Amending allocation is not supported yet");
        this.events.emit("errorAmendingAllocation", {
            allocation,
            error: err,
        });
        throw err;
    }
    async acceptInvoice(invoice, allocation, amount) {
        this.logger.debug("Accepting invoice", invoice);
        try {
            const acceptedInvoice = await this.paymentApi.acceptInvoice(invoice, allocation, amount);
            this.events.emit("invoiceAccepted", {
                invoice: acceptedInvoice,
            });
            this.logger.info("Accepted invoice", {
                id: invoice.id,
                allocationId: allocation.id,
                agreementId: invoice.agreementId,
                provider: invoice.provider,
                amount,
            });
            return acceptedInvoice;
        }
        catch (error) {
            this.events.emit("errorAcceptingInvoice", { invoice, error });
            this.logger.error(`Failed to accept invoice. ${error}`, {
                id: invoice.id,
                allocationId: allocation.id,
                agreementId: invoice.agreementId,
                provider: invoice.provider,
                amount,
            });
            throw error;
        }
    }
    async rejectInvoice(invoice, reason) {
        this.logger.debug("Rejecting invoice", { id: invoice.id, reason });
        try {
            const rejectedInvoice = await this.paymentApi.rejectInvoice(invoice, reason);
            this.events.emit("invoiceRejected", {
                invoice: rejectedInvoice,
            });
            this.logger.warn("Rejeced invoice", { id: invoice.id, reason });
            return rejectedInvoice;
        }
        catch (error) {
            this.events.emit("errorRejectingInvoice", { invoice, error });
            this.logger.error(`Failed to reject invoice. ${error}`, { id: invoice.id, reason });
            throw error;
        }
    }
    async acceptDebitNote(debitNote, allocation, amount) {
        this.logger.debug("Accepting debit note", debitNote);
        try {
            const acceptedDebitNote = await this.paymentApi.acceptDebitNote(debitNote, allocation, amount);
            this.events.emit("debitNoteAccepted", {
                debitNote: acceptedDebitNote,
            });
            this.logger.debug("Accepted debit note", {
                id: debitNote.id,
                allocationId: allocation.id,
                activityId: debitNote.activityId,
                provider: debitNote.provider,
                amount,
            });
            return acceptedDebitNote;
        }
        catch (error) {
            this.events.emit("errorAcceptingDebitNote", { debitNote, error });
            this.logger.error(`Failed to accept debitNote. ${error}`, {
                id: debitNote.id,
                allocationId: allocation.id,
                activityId: debitNote.activityId,
                provider: debitNote.provider,
                amount,
            });
            throw error;
        }
    }
    async rejectDebitNote(debitNote, reason) {
        this.logger.info("Rejecting debit note", { id: debitNote.id, reason });
        // TODO: this is not supported by PaymnetAdapter
        const message = "Unable to send debitNote rejection to provider. This feature is not yet supported.";
        this.logger.warn(message);
        this.events.emit("errorRejectingDebitNote", { debitNote, error: new GolemInternalError(message) });
        return debitNote;
        // this.logger.debug("Rejecting debit note", { id: debitNote.id, reason });
        // try {
        //   const rejectedDebitNote = await this.paymentApi.rejectDebitNote(debitNote, reason);
        //   this.events.emit("debitNoteRejected", rejectedDebitNote);
        //   return rejectedDebitNote;
        // } catch (error) {
        //   this.events.emit("errorRejectingDebitNote", debitNote, error);
        //   throw error;
        // }
    }
    /**
     * Creates an instance of utility class InvoiceProcessor that deals with invoice related use-cases
     */
    createInvoiceProcessor() {
        return new InvoiceProcessor(this.yagnaApi);
    }
    createAgreementPaymentProcess(agreement, allocation, options) {
        return new AgreementPaymentProcess(agreement, allocation, this, options, this.logger.child("agreement-payment-process"));
    }
}

var ActivityStateEnum;
(function (ActivityStateEnum) {
    ActivityStateEnum["New"] = "New";
    ActivityStateEnum["Initialized"] = "Initialized";
    ActivityStateEnum["Deployed"] = "Deployed";
    ActivityStateEnum["Ready"] = "Ready";
    ActivityStateEnum["Unresponsive"] = "Unresponsive";
    ActivityStateEnum["Terminated"] = "Terminated";
    /** In case when we couldn't establish the in on yagna */
    ActivityStateEnum["Unknown"] = "Unknown";
})(ActivityStateEnum || (ActivityStateEnum = {}));
/**
 * Activity module - an object representing the runtime environment on the provider in accordance with the `Package` specification.
 * As part of a given activity, it is possible to execute exe script commands and capture their results.
 */
class Activity {
    /**
     * @param id The ID of the activity in Yagna
     * @param agreement The agreement that's related to this activity
     * @param currentState The current state as it was obtained from yagna
     * @param previousState The previous state (or New if this is the first time we're creating the activity)
     * @param usage Current resource usage vector information
     */
    constructor(id, agreement, currentState = ActivityStateEnum.New, previousState = ActivityStateEnum.Unknown, usage) {
        this.id = id;
        this.agreement = agreement;
        this.currentState = currentState;
        this.previousState = previousState;
        this.usage = usage;
    }
    get provider() {
        return this.agreement.provider;
    }
    getState() {
        return this.currentState;
    }
    getPreviousState() {
        return this.previousState;
    }
}

// FIXME: Make the `data` field Uint8Array and update the rest of the code
// eslint-disable-next-line
class Result {
    constructor(props) {
        this.index = props.index;
        this.eventDate = props.eventDate;
        this.result = props.result;
        this.stdout = props.stdout;
        this.stderr = props.stderr;
        this.message = props.message;
        this.isBatchFinished = props.isBatchFinished;
        this.data = props.data;
    }
    /**
     * Helper method making JSON-like output results more accessible
     */
    getOutputAsJson() {
        if (!this.stdout) {
            throw new GolemInternalError("Can't convert Result output to JSON, because the output is missing!");
        }
        try {
            return JSON.parse(this.stdout.toString().trim());
        }
        catch (err) {
            throw new GolemInternalError(`Failed to parse output to JSON! Output: "${this.stdout.toString()}". Error: ${err}`);
        }
    }
}

const DEFAULTS$1 = {
    activityExeBatchResultPollIntervalSeconds: 5,
    activityExeBatchResultMaxRetries: 20,
};
/**
 * @internal
 */
class ExecutionConfig {
    constructor(options) {
        this.activityExeBatchResultMaxRetries =
            (options === null || options === void 0 ? void 0 : options.activityExeBatchResultMaxRetries) || DEFAULTS$1.activityExeBatchResultMaxRetries;
        this.activityExeBatchResultPollIntervalSeconds =
            (options === null || options === void 0 ? void 0 : options.activityExeBatchResultPollIntervalSeconds) || DEFAULTS$1.activityExeBatchResultPollIntervalSeconds;
    }
}

/**
 * Represents a series of Commands that can be sent to exe-unit via yagna's API
 */
class Script {
    constructor(commands = []) {
        this.commands = commands;
    }
    static create(commands) {
        return new Script(commands);
    }
    add(command) {
        this.commands.push(command);
    }
    async before() {
        await Promise.all(this.commands.map((cmd) => cmd.before()));
    }
    async after(results) {
        // Call after() for each command mapping its result.
        return Promise.all(this.commands.map((command, i) => command.after(results[i])));
    }
    getExeScriptRequest() {
        if (!this.commands.length) {
            throw new GolemInternalError("There are no commands in the script");
        }
        return { text: JSON.stringify(this.commands.map((cmd) => cmd.toJson())) };
    }
}

const EMPTY_ERROR_RESULT = new Result({
    result: "Error",
    eventDate: new Date().toISOString(),
    index: -1,
    message: "No result due to error",
});
/**
 * Generic command that can be send to an exe-unit via yagna's API
 */
class Command {
    constructor(commandName, args) {
        this.commandName = commandName;
        this.args = args || {};
    }
    /**
     * Serializes the command to a JSON representation
     */
    toJson() {
        return {
            [this.commandName]: this.args,
        };
    }
    /**
     * Converts the command into
     */
    toExeScriptRequest() {
        return { text: JSON.stringify([this.toJson()]) };
    }
    /**
     * Setup local environment for executing this command.
     */
    async before() { }
    /**
     * Cleanup local setup that was needed for the command to run.
     *
     * It is called after the command was sent to the activity, and the command was processed.
     *
     * When run within scripts or batch commands, after() might be called without any results, as one of the previous
     * commands might have failed. In this case, the command should still cleanup its local setup and return an empty
     * error result.
     *
     * @param result
     */
    async after(result) {
        return result !== null && result !== void 0 ? result : EMPTY_ERROR_RESULT;
    }
}
class Deploy extends Command {
    constructor(args) {
        super("deploy", args);
    }
}
class Start extends Command {
    constructor(args) {
        super("start", args);
    }
}
class Run extends Command {
    constructor(cmd, args, env, capture) {
        const captureOpt = capture || {
            stdout: { atEnd: { format: "string" } },
            stderr: { atEnd: { format: "string" } },
        };
        super("run", {
            entry_point: cmd,
            args,
            env,
            capture: captureOpt,
        });
    }
}
class Transfer extends Command {
    constructor(from, to, args) {
        super("transfer", { from, to, args });
        this.from = from;
        this.to = to;
    }
}
class UploadFile extends Transfer {
    constructor(storageProvider, src, dstPath) {
        super();
        this.storageProvider = storageProvider;
        this.src = src;
        this.dstPath = dstPath;
        this.args["to"] = `container:${dstPath}`;
    }
    async before() {
        this.args["from"] = await this.storageProvider.publishFile(this.src);
    }
    async after(result) {
        await this.storageProvider.release([this.args["from"]]);
        return result;
    }
}
class UploadData extends Transfer {
    constructor(storageProvider, src, dstPath) {
        super();
        this.storageProvider = storageProvider;
        this.src = src;
        this.dstPath = dstPath;
        this.args["to"] = `container:${dstPath}`;
    }
    async before() {
        this.args["from"] = await this.storageProvider.publishData(this.src);
    }
    async after(result) {
        await this.storageProvider.release([this.args["from"]]);
        return result;
    }
}
class DownloadFile extends Transfer {
    constructor(storageProvider, srcPath, dstPath) {
        super();
        this.storageProvider = storageProvider;
        this.srcPath = srcPath;
        this.dstPath = dstPath;
        this.args = { from: `container:${srcPath}` };
    }
    async before() {
        this.args["to"] = await this.storageProvider.receiveFile(this.dstPath);
    }
    async after(result) {
        await this.storageProvider.release([this.args["to"]]);
        return result;
    }
}
class DownloadData extends Transfer {
    constructor(storageProvider, srcPath) {
        super();
        this.storageProvider = storageProvider;
        this.srcPath = srcPath;
        this.chunks = [];
        this.args = { from: `container:${srcPath}` };
    }
    async before() {
        this.args["to"] = await this.storageProvider.receiveData((data) => {
            // NOTE: this assumes in-order delivery. For not it should work with websocket provider and local file polyfill.
            this.chunks.push(data);
        });
    }
    async after(result) {
        await this.storageProvider.release([this.args["to"]]);
        if (result.result === "Ok") {
            return new Result({
                ...result,
                data: this.combineChunks(),
            });
        }
        return new Result({
            ...result,
            result: "Error",
            data: undefined,
        });
    }
    combineChunks() {
        const data = new Uint8Array(this.chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of this.chunks) {
            data.set(chunk, offset);
            offset += chunk.length;
        }
        // Release memory.
        this.chunks = [];
        return data;
    }
}

/**
 * @deprecated Use WebSocketStorageProvider instead. This will be removed in the next major version.
 *
 * Storage provider that spawns a GFTP process and uses it to serve files.
 */
class GftpStorageProvider {
    constructor(logger) {
        /**
         * All published URLs to be release on close().
         * @private
         */
        this.publishedUrls = new Set();
        this.isInitialized = false;
        /**
         * lock against parallel writing to stdin in gftp process
         * @private
         */
        this.lock = new AsyncLock();
        if (isBrowser) {
            throw new GolemUserError(`File transfer by GFTP module is unsupported in the browser context.`);
        }
        this.logger = logger || defaultLogger("storage");
    }
    async init() {
        if (this.isInitialized) {
            this.logger.warn("GFTP init attempted even though it was already ready - check the logic of your application");
            return;
        }
        await this.startGftpServer();
        this.logger.info(`GFTP Version: ${await this.jsonRpc("version")}`);
    }
    startGftpServer() {
        return new Promise((resolve, reject) => {
            var _a, _b, _c, _d, _e, _f;
            this.logger.debug("Starting GFTP server");
            this.gftpServerProcess = spawn("gftp", ["server"]);
            this.gftpServerProcess.on("spawn", () => {
                this.logger.info("GFTP server spawned");
                this.isInitialized = true;
                resolve();
            });
            this.gftpServerProcess.on("error", (error) => {
                this.logger.error("Error while spawning GFTP server", error);
                reject(error);
            });
            this.gftpServerProcess.on("close", (code, signal) => {
                this.logger.info("GFTP server closed", { code, signal });
                this.isInitialized = false;
            });
            (_b = (_a = this.gftpServerProcess) === null || _a === void 0 ? void 0 : _a.stdout) === null || _b === void 0 ? void 0 : _b.setEncoding("utf-8");
            (_d = (_c = this.gftpServerProcess) === null || _c === void 0 ? void 0 : _c.stderr) === null || _d === void 0 ? void 0 : _d.setEncoding("utf-8");
            this.reader = (_f = (_e = this.gftpServerProcess) === null || _e === void 0 ? void 0 : _e.stdout) === null || _f === void 0 ? void 0 : _f.iterator();
        });
    }
    async generateTempFileName() {
        const { randomUUID } = await import('crypto');
        const tmp = await import('tmp');
        const fileName = path.join(tmp.dirSync().name, randomUUID().toString());
        if (fs__default.existsSync(fileName))
            fs__default.unlinkSync(fileName);
        return fileName;
    }
    async receiveFile(path) {
        const { url } = await this.jsonRpc("receive", { output_file: path });
        return url;
    }
    receiveData() {
        throw new GolemUserError("receiveData is not implemented in GftpStorageProvider");
    }
    async publishFile(src) {
        const url = await this.uploadFile(src);
        this.publishedUrls.add(url);
        return url;
    }
    async publishData(src) {
        let url;
        if (Buffer.isBuffer(src)) {
            url = await this.uploadBytes(src);
        }
        else {
            url = await this.uploadBytes(Buffer.from(src));
        }
        this.publishedUrls.add(url);
        return url;
    }
    release() {
        // NOTE: Due to GFTP's handling of file Ids (hashes), all files with same content will share IDs, so releasing
        // one might break transfer of another one. Therefore, we release all files on close().
        return Promise.resolve(undefined);
    }
    async releaseAll() {
        const urls = Array.from(this.publishedUrls).filter((url) => !!url);
        if (urls.length) {
            await this.jsonRpc("close", { urls });
        }
    }
    async close() {
        var _a;
        if (this.isInitialized) {
            await this.releaseAll();
            (_a = this.gftpServerProcess) === null || _a === void 0 ? void 0 : _a.kill();
        }
    }
    async jsonRpc(method, params = {}) {
        return this.lock.acquire("gftp-io", async () => {
            var _a, _b, _c, _d;
            if (!this.isInitialized) {
                throw new GolemInternalError(`GFTP was not initialized when calling JSON-RPC ${method} with ${JSON.stringify(params)}`);
            }
            const callId = v4();
            const request = {
                jsonrpc: "2.0",
                id: callId,
                method: method,
                params: params,
            };
            const query = `${JSON.stringify(request)}\n`;
            this.logger.debug("Sending GFTP command", { request });
            (_b = (_a = this.gftpServerProcess) === null || _a === void 0 ? void 0 : _a.stdin) === null || _b === void 0 ? void 0 : _b.write(query);
            const value = (_d = (await ((_c = this.reader) === null || _c === void 0 ? void 0 : _c.next()))) === null || _d === void 0 ? void 0 : _d.value;
            if (!value) {
                throw new GolemInternalError("Unable to get GFTP command result");
            }
            const { result } = JSON.parse(value);
            if (result === undefined) {
                throw new GolemInternalError(value);
            }
            return result;
        });
    }
    async uploadStream(stream) {
        var _a;
        // FIXME: temp file is never deleted.
        const fileName = await this.generateTempFileName();
        const wStream = fs__default.createWriteStream(fileName, {
            encoding: "binary",
        });
        // eslint-disable-next-line no-async-promise-executor
        await new Promise(async (fulfill) => {
            wStream.once("finish", fulfill);
            for await (const chunk of stream) {
                wStream.write(chunk);
            }
            wStream.end();
        });
        const links = await this.jsonRpc("publish", { files: [fileName.toString()] });
        if (links.length !== 1)
            throw "invalid gftp publish response";
        return (_a = links[0]) === null || _a === void 0 ? void 0 : _a.url;
    }
    async uploadBytes(data) {
        return await this.uploadStream((async function* () {
            yield data;
        })());
    }
    async uploadFile(file) {
        var _a;
        const links = await this.jsonRpc("publish", { files: [file.toString()] });
        return (_a = links[0]) === null || _a === void 0 ? void 0 : _a.url;
    }
    isReady() {
        return this.isInitialized;
    }
}

/**
 * Null Storage Provider.
 *
 * Blocks all storage operations. Any attempt to use storage will result in an error.
 *
 * This will be the default storage provider if no default storage provider is available
 * for the platform the SDK is running on.
 *
 * @category mid-level
 */
class NullStorageProvider {
    close() {
        return Promise.resolve(undefined);
    }
    init() {
        return Promise.resolve(undefined);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    publishData(src) {
        return Promise.reject(new GolemInternalError("NullStorageProvider does not support upload data"));
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    publishFile(src) {
        return Promise.reject(new GolemInternalError("NullStorageProvider does not support upload files"));
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    receiveFile(path) {
        return Promise.reject(new GolemInternalError("NullStorageProvider does not support download files"));
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    receiveData(callback) {
        return Promise.reject(new GolemInternalError("NullStorageProvider does not support download data"));
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    release(urls) {
        return Promise.resolve(undefined);
    }
    isReady() {
        return true;
    }
}

const fsPromises = fs.promises;
/**
 * Storage provider that uses GFTP over WebSockets.
 */
class WebSocketStorageProvider {
    constructor(yagnaApi, options) {
        var _a;
        this.yagnaApi = yagnaApi;
        /**
         * Map of open services (IDs) indexed by GFTP url.
         */
        this.services = new Map();
        this.ready = false;
        this.openHandles = new Set();
        this.logger = ((_a = options === null || options === void 0 ? void 0 : options.logger) === null || _a === void 0 ? void 0 : _a.child("storage")) || defaultLogger("storage");
    }
    async close() {
        this.ready = false;
        await Promise.allSettled(Array.from(this.openHandles).map((handle) => handle.close()));
        return this.release(Array.from(this.services.keys()));
    }
    init() {
        this.ready = true;
        return Promise.resolve(undefined);
    }
    async publishData(data) {
        const fileInfo = await this.createFileInfo();
        const ws = await this.createSocket(fileInfo, ["GetMetadata", "GetChunk"]);
        ws.addEventListener("message", (event) => {
            if (!(event.data instanceof ArrayBuffer)) {
                this.logger.error("Received non-ArrayBuffer data from the socket", { data: event.data });
                return;
            }
            const req = toObject(event.data);
            this.logger.debug("Received GFTP request for publishData", req);
            if (req.component === "GetMetadata") {
                this.respond(ws, req.id, { fileSize: data.byteLength });
            }
            else if (req.component === "GetChunk") {
                this.respond(ws, req.id, {
                    content: data.slice(req.payload.offset, req.payload.offset + req.payload.size),
                    offset: req.payload.offset,
                });
            }
            else {
                this.logger.error(`Unsupported message in publishData(): ${req.component}`);
            }
        });
        return fileInfo.url;
    }
    async publishFile(src) {
        if (isBrowser) {
            throw new GolemUserError("Cannot publish files in browser context, did you mean to use `publishData()`?");
        }
        this.logger.info("Preparing file upload", { sourcePath: src });
        const fileInfo = await this.createFileInfo();
        const ws = await this.createSocket(fileInfo, ["GetMetadata", "GetChunk"]);
        const fileStats = await fsPromises.stat(src);
        const fileSize = fileStats.size;
        const fileHandle = await fsPromises.open(src, "r");
        this.openHandles.add(fileHandle);
        ws.addEventListener("message", async (event) => {
            if (!(event.data instanceof ArrayBuffer)) {
                this.logger.error("Received non-ArrayBuffer data from the socket", { data: event.data });
                return;
            }
            const req = toObject(event.data);
            this.logger.debug("Received GFTP request for publishFile", req);
            if (req.component === "GetMetadata") {
                this.respond(ws, req.id, { fileSize });
            }
            else if (req.component === "GetChunk") {
                const { offset, size } = req.payload;
                const chunkSize = Math.min(size, fileSize - offset);
                const chunk = Buffer.alloc(chunkSize);
                try {
                    await fileHandle.read(chunk, 0, chunkSize, offset);
                    this.respond(ws, req.id, {
                        content: chunk,
                        offset,
                    });
                }
                catch (error) {
                    this.logger.error("Something went wrong while sending the file chunk", { error });
                }
            }
            else {
                this.logger.error(`Unsupported message in publishFile(): ${req.component}`);
            }
        });
        return fileInfo.url;
    }
    async receiveData(callback) {
        const data = [];
        const fileInfo = await this.createFileInfo();
        const ws = await this.createSocket(fileInfo, ["UploadChunk", "UploadFinished"]);
        ws.addEventListener("message", (event) => {
            if (!(event.data instanceof ArrayBuffer)) {
                this.logger.error("Received non-ArrayBuffer data from the socket", { data: event.data });
                return;
            }
            const req = toObject(event.data);
            this.logger.debug("Received GFTP request for receiveData", req);
            if (req.component === "UploadChunk") {
                data.push(req.payload.chunk);
                this.respond(ws, req.id, null);
            }
            else if (req.component === "UploadFinished") {
                this.respond(ws, req.id, null);
                const result = this.completeReceive(req.payload.hash, data);
                callback(result);
            }
            else {
                this.logger.error(`Unsupported message in receiveData(): ${req.component}`);
            }
        });
        return fileInfo.url;
    }
    async receiveFile(path) {
        if (isBrowser) {
            throw new GolemUserError("Cannot receive files in browser context, did you mean to use `receiveData()`?");
        }
        this.logger.info("Preparing file download", { destination: path });
        const fileInfo = await this.createFileInfo();
        const fileHandle = await fsPromises.open(path, "w");
        this.openHandles.add(fileHandle);
        const ws = await this.createSocket(fileInfo, ["UploadChunk", "UploadFinished"]);
        ws.addEventListener("message", async (event) => {
            if (!(event.data instanceof ArrayBuffer)) {
                this.logger.error("Received non-ArrayBuffer data from the socket", { data: event.data });
                return;
            }
            const req = toObject(event.data);
            this.logger.debug("Received GFTP request for receiveFile", req);
            if (req.component === "UploadChunk") {
                await fileHandle.write(req.payload.chunk.content);
                this.respond(ws, req.id, null);
            }
            else if (req.component === "UploadFinished") {
                this.respond(ws, req.id, null);
                await fileHandle.close();
                this.openHandles.delete(fileHandle);
            }
            else {
                this.logger.error(`Unsupported message in receiveFile(): ${req.component}`);
            }
        });
        return fileInfo.url;
    }
    async release(urls) {
        urls.forEach((url) => {
            const serviceId = this.services.get(url);
            if (serviceId) {
                this.deleteService(serviceId).catch((error) => this.logger.warn(`Failed to delete service`, { serviceId, error }));
            }
            this.services.delete(url);
        });
    }
    isReady() {
        return this.ready;
    }
    async createFileInfo() {
        const id = v4();
        const data = await this.yagnaApi.identity.getIdentity();
        const me = data.identity;
        return {
            id,
            url: `gftp://${me}/${id}`,
        };
    }
    getWsConstructor() {
        if (isBrowser) {
            return WebSocket;
        }
        return NodeWebSocket;
    }
    async createSocket(fileInfo, components) {
        const service = await this.createService(fileInfo, components);
        const ws = new (this.getWsConstructor())(service.url, ["gsb+flexbuffers"]);
        ws.addEventListener("error", () => {
            this.logger.error(`Socket Error (${fileInfo.id})`);
        });
        ws.binaryType = "arraybuffer";
        return ws;
    }
    async createService(fileInfo, components) {
        const resp = (await this.yagnaApi.gsb.bindServices({
            listen: {
                on: `/public/gftp/${fileInfo.id}`,
                components,
            },
            // FIXME: not present in ya-client for some reason
        }));
        const servicesId = resp.servicesId;
        const messageEndpoint = `/gsb-api/v1/services/${servicesId}?authToken=${this.yagnaApi.yagnaOptions.apiKey}`;
        const url = new URL(messageEndpoint, this.yagnaApi.yagnaOptions.basePath);
        url.protocol = "ws:";
        this.services.set(fileInfo.url, servicesId);
        return { url, serviceId: servicesId };
    }
    async deleteService(id) {
        await this.yagnaApi.gsb.unbindServices(id);
    }
    respond(ws, id, payload) {
        ws.send(encode({
            id,
            payload,
        }));
    }
    completeReceive(hash, data) {
        data.sort((a, b) => a.offset - b.offset);
        const size = data.reduce((acc, cur) => acc + cur.content.byteLength, 0);
        const buf = new Uint8Array(size);
        data.forEach((chunk) => {
            buf.set(chunk.content, chunk.offset);
        });
        // FIXME: Use digest.update and async, as it can only handle 14MB/s on my machine, which is way to slow to do synchronously.
        const hashHex = jsSha3.sha3_256(buf);
        if (hash !== hashHex) {
            throw new GolemInternalError(`File corrupted, expected hash ${hash}, got ${hashHex}`);
        }
        else {
            return buf;
        }
    }
}

var _GolemWorkError_agreement, _GolemWorkError_activity, _GolemWorkError_provider;
var WorkErrorCode;
(function (WorkErrorCode) {
    WorkErrorCode["ServiceNotInitialized"] = "ServiceNotInitialized";
    WorkErrorCode["ScriptExecutionFailed"] = "ScriptExecutionFailed";
    WorkErrorCode["ActivityDestroyingFailed"] = "ActivityDestroyingFailed";
    WorkErrorCode["ActivityResultsFetchingFailed"] = "ActivityResultsFetchingFailed";
    WorkErrorCode["ActivityCreationFailed"] = "ActivityCreationFailed";
    WorkErrorCode["NetworkSetupMissing"] = "NetworkSetupMissing";
    WorkErrorCode["ScriptInitializationFailed"] = "ScriptInitializationFailed";
    WorkErrorCode["ActivityDeploymentFailed"] = "ActivityDeploymentFailed";
    WorkErrorCode["ActivityStatusQueryFailed"] = "ActivityStatusQueryFailed";
    WorkErrorCode["ActivityResetFailed"] = "ActivityResetFailed";
})(WorkErrorCode || (WorkErrorCode = {}));
class GolemWorkError extends GolemModuleError {
    constructor(message, code, agreement, activity, provider, previous) {
        super(message, code, previous);
        this.code = code;
        this.previous = previous;
        _GolemWorkError_agreement.set(this, void 0);
        _GolemWorkError_activity.set(this, void 0);
        _GolemWorkError_provider.set(this, void 0);
        __classPrivateFieldSet(this, _GolemWorkError_agreement, agreement, "f");
        __classPrivateFieldSet(this, _GolemWorkError_activity, activity, "f");
        __classPrivateFieldSet(this, _GolemWorkError_provider, provider, "f");
    }
    getAgreement() {
        return __classPrivateFieldGet(this, _GolemWorkError_agreement, "f");
    }
    getActivity() {
        return __classPrivateFieldGet(this, _GolemWorkError_activity, "f");
    }
    getProvider() {
        return __classPrivateFieldGet(this, _GolemWorkError_provider, "f");
    }
}
_GolemWorkError_agreement = new WeakMap(), _GolemWorkError_activity = new WeakMap(), _GolemWorkError_provider = new WeakMap();

class Batch {
    constructor(executor, storageProvider, logger) {
        this.executor = executor;
        this.storageProvider = storageProvider;
        this.logger = logger;
        this.script = new Script([]);
    }
    run(executableOrCommand, executableArgs) {
        if (executableArgs) {
            this.script.add(new Run(executableOrCommand, executableArgs));
        }
        else {
            this.script.add(new Run("/bin/sh", ["-c", executableOrCommand]));
        }
        return this;
    }
    transfer(from, to) {
        this.script.add(new Transfer(from, to));
        return this;
    }
    uploadFile(src, dst) {
        this.script.add(new UploadFile(this.storageProvider, src, dst));
        return this;
    }
    uploadJson(json, dst) {
        const src = new TextEncoder().encode(JSON.stringify(json));
        this.script.add(new UploadData(this.storageProvider, src, dst));
        return this;
    }
    uploadData(data, dst) {
        this.script.add(new UploadData(this.storageProvider, data, dst));
        return this;
    }
    downloadFile(src, dst) {
        this.script.add(new DownloadFile(this.storageProvider, src, dst));
        return this;
    }
    /**
     * Executes the batch of commands added via {@link run} returning result for each of the steps.
     */
    async end() {
        await this.script.before();
        try {
            const allResults = [];
            const script = this.script.getExeScriptRequest();
            this.logger.debug(`Sending exec script request to the exe-unit on provider:`, { script });
            const executionMetadata = await this.executor.execute(script);
            const result$ = this.executor.getResultsObservable(executionMetadata);
            return new Promise((resolve, reject) => {
                this.logger.debug("Reading the results of the batch script");
                result$.subscribe({
                    next: (res) => {
                        this.logger.debug(`Received data for batch script execution`, { res });
                        allResults.push(res);
                    },
                    complete: () => {
                        this.logger.debug("End of batch script execution");
                        this.script
                            .after(allResults)
                            .then((results) => resolve(results))
                            .catch((error) => reject(error));
                    },
                    error: (error) => {
                        const golemError = error instanceof GolemWorkError
                            ? error
                            : new GolemWorkError(`Unable to execute script ${error}`, WorkErrorCode.ScriptExecutionFailed, this.executor.activity.agreement, this.executor.activity, this.executor.activity.agreement.provider, error);
                        this.logger.debug("Error in batch script execution", { error });
                        this.script
                            .after(allResults)
                            .then(() => reject(golemError))
                            .catch(() => reject(golemError)); // Return original error, as it might be more important.
                    },
                });
            });
        }
        catch (error) {
            this.logger.error(`Failed to send the exec script to the exe-unit on provider`, { error });
            // NOTE: This is called only to ensure that each of the commands in the original script will be populated with at least `EmptyErrorResult`.
            // That's actually a FIXME, as the command could start with an empty result, which eventually will get replaced with an actual one.
            await this.script.after([]);
            if (error instanceof GolemWorkError) {
                throw error;
            }
            throw new GolemWorkError(`Unable to execute script ${error}`, WorkErrorCode.ScriptExecutionFailed, this.executor.activity.agreement, this.executor.activity, this.executor.activity.agreement.provider, error);
        }
    }
    async endStream() {
        const script = this.script;
        await script.before();
        let executionMetadata;
        try {
            executionMetadata = await this.executor.execute(this.script.getExeScriptRequest());
        }
        catch (error) {
            // the original error is more important than the one from after()
            await script.after([]);
            if (error instanceof GolemWorkError) {
                throw error;
            }
            throw new GolemWorkError(`Unable to execute script ${error}`, WorkErrorCode.ScriptExecutionFailed, this.executor.activity.agreement, this.executor.activity, this.executor.activity.agreement.provider, error);
        }
        const decodedResults = [];
        const { activity } = this.executor;
        const result$ = this.executor.getResultsObservable(executionMetadata);
        return result$.pipe(map((chunk) => {
            if (chunk.result !== "Error") {
                return chunk;
            }
            throw new GolemWorkError(`${chunk === null || chunk === void 0 ? void 0 : chunk.message}. Stdout: ${String(chunk === null || chunk === void 0 ? void 0 : chunk.stdout).trim()}. Stderr: ${String(chunk === null || chunk === void 0 ? void 0 : chunk.stderr).trim()}`, WorkErrorCode.ScriptExecutionFailed, activity.agreement, activity, activity.provider);
        }), tap((chunk) => {
            decodedResults.push(chunk);
        }), finalize(() => script.after(decodedResults).catch((error) => this.logger.error("Failed to cleanup script", { error }))));
    }
}

const DEFAULTS = {
    exitWaitingTimeout: 20000,
};
/**
 * RemoteProcess class representing the process spawned on the provider by {@link ExeUnit.runAndStream}
 */
class RemoteProcess {
    constructor(activityModule, activityResult$, activity, logger) {
        this.activityModule = activityModule;
        this.activity = activity;
        this.logger = logger;
        /**
         * Stream connected to stdout from provider process
         */
        this.stdout = new Subject();
        /**
         * Stream connected to stderr from provider process
         */
        this.stderr = new Subject();
        this.subscription = activityResult$
            .pipe(finalize(() => {
            this.stdout.complete();
            this.stderr.complete();
        }))
            .subscribe({
            next: (result) => {
                this.lastResult = result;
                if (result.stdout)
                    this.stdout.next(result.stdout);
                if (result.stderr)
                    this.stderr.next(result.stderr);
            },
            error: (error) => {
                this.streamError = error;
            },
        });
    }
    /**
     * Waits for the process to complete and returns the last part of the command's results as a {@link Result} object.
     * If the timeout is reached, the return promise will be rejected.
     * @param timeout - maximum waiting time im ms for the final result (default: 20_000)
     */
    waitForExit(timeout) {
        return new Promise((resolve, reject) => {
            const timeoutInMs = timeout !== null && timeout !== void 0 ? timeout : DEFAULTS.exitWaitingTimeout;
            const timeoutId = setTimeout(() => {
                reject(new GolemWorkError(`Unable to get activity results. The waiting time (${timeoutInMs} ms) for the final result has been exceeded`, WorkErrorCode.ActivityResultsFetchingFailed, this.activity.agreement, this.activity, this.activity.provider, new GolemTimeoutError(`The waiting time (${timeoutInMs} ms) for the final result has been exceeded`)));
                this.activityModule
                    .destroyActivity(this.activity)
                    .catch((err) => this.logger.error(`Error when destroying activity`, err));
            }, timeoutInMs);
            const end = () => {
                clearTimeout(timeoutId);
                if (this.lastResult) {
                    resolve(this.lastResult);
                }
                else {
                    reject(new GolemWorkError(`An error occurred while retrieving the results. ${this.streamError}`, WorkErrorCode.ActivityResultsFetchingFailed, this.activity.agreement, this.activity, this.activity.provider));
                    this.activityModule
                        .destroyActivity(this.activity)
                        .catch((err) => this.logger.error(`Error when destroying activity`, err));
                }
            };
            this.subscription.add(() => end());
        });
    }
    /**
     * Checks if the exe-script batch from Yagna has completed, reflecting all work and streaming to be completed
     */
    isFinished() {
        return this.subscription.closed;
    }
}

/**
 * Allows proxying of TCP traffic to a service running in an activity on a provider via the requestor
 *
 * **IMPORTANT**
 *
 * This feature is supported only in the Node.js environment. In has no effect in browsers.
 *
 * General solution description:
 *
 * - Open a TCP server and listen to connections
 * - When a new connection arrives, establish a WS connection with yagna
 * - Pass any incoming data from the client TCP socket to the WS, buffer it when the socket is not ready yet
 * - Pass any returning data from the WS to the client TCP socket, but don't do it if the client socket already disconnected
 * - When the WS will be closed, then close the client socket as well
 * - When the client TCP socket will be closed, close the WS as well
 * - Handle teardown of the TCP-WS bridge by clearing communication buffers to avoid memory leaks
 */
class TcpProxy {
    constructor(
    /**
     * The URL to the WebSocket implementing the communication transport layer
     */
    wsUrl, 
    /**
     * The yagna app-key used to authenticate the WebSocket connection
     */
    appKey, 
    /**
     * Additional options of the proxy
     */
    options = {}) {
        var _a;
        this.wsUrl = wsUrl;
        this.appKey = appKey;
        this.events = new EventEmitter();
        checkAndThrowUnsupportedInBrowserError("TCP Proxy");
        this.heartBeatSec = (_a = options.heartBeatSec) !== null && _a !== void 0 ? _a : 10;
        this.logger = options.logger ? options.logger.child("tcp-proxy") : defaultLogger("tcp-proxy");
        this.server = net.createServer((client) => {
            this.logger.debug("Client connected to TCP Server");
            const state = {
                /** Tells if the client socket is in a usable state */
                sReady: true,
                /** Buffer for chunks of data that arrived from yagna's WS and should be delivered to the client socket when it's ready */
                sBuffer: [],
                /** Tells if the WS with yagna is ready for communication */
                wsReady: false,
                /** Buffer for chunks of data that arrived from the client socket and should be sent to yagna's WS when it's ready */
                wsBuffer: [],
            };
            const clearSocketBuffer = () => (state.sBuffer = []);
            const clearWebSocketBuffer = () => (state.wsBuffer = []);
            // UTILITY METHODS
            const flushSocketBuffer = () => {
                this.logger.debug("Flushing Socket buffer");
                if (state.sBuffer.length > 0) {
                    client.write(Buffer$1.concat(state.sBuffer));
                }
                clearSocketBuffer();
            };
            const flushWebSocketBuffer = () => {
                this.logger.debug("Flushing WebSocket buffer");
                if (state.wsBuffer.length > 0) {
                    ws.send(Buffer$1.concat(state.wsBuffer), {
                        binary: true,
                        mask: true,
                    });
                }
                clearWebSocketBuffer();
            };
            const teardownBridge = () => {
                ws.close();
                client.end();
                clearWebSocketBuffer();
                clearSocketBuffer();
            };
            const ws = new WebSocket$1(this.wsUrl, { headers: { authorization: `Bearer ${this.appKey}` } });
            // OPEN HANDLERS
            ws.on("open", () => {
                this.logger.debug("Yagna WS opened");
                state.wsReady = true;
                // Push any pending data to the web-socket
                flushWebSocketBuffer();
            });
            // NOTE: That's not really required in our use-case, added for completeness of the flow
            client.on("connect", () => {
                this.logger.debug("Client socket connected");
                state.sReady = true;
                // Push any pending data to the client socket
                flushSocketBuffer();
            });
            // ERROR HANDLERS
            ws.on("error", (error) => {
                this.notifyOfError("Yagna WS encountered an error", error);
                teardownBridge();
            });
            client.on("error", (error) => {
                this.notifyOfError("Server Socket encountered an error", error);
                teardownBridge();
            });
            // TERMINATION HANDLERS
            // When the WS socket will be closed
            ws.on("close", () => {
                clearInterval(heartBeatInt);
                this.logger.debug("Yagna WS closed");
                client.end();
                clearWebSocketBuffer();
                clearSocketBuffer();
            });
            ws.on("end", () => {
                this.logger.debug("Yagna WS end");
                client.end();
                clearWebSocketBuffer();
                clearSocketBuffer();
            });
            // When the client will disconnect
            client.on("close", (error) => {
                if (error) {
                    this.logger.error("Server Socket encountered closed with an error error");
                }
                else {
                    this.logger.debug("Server Socket has been closed (client disconnected)");
                }
                ws.close();
                clearWebSocketBuffer();
                clearSocketBuffer();
            });
            // DATA TRANSFER
            // Send data to the WebSocket or buffer if it's not ready yet
            client.on("data", async (chunk) => {
                this.logger.debug("Server Socket received data", { length: chunk.length, wsReady: state.wsReady });
                if (!state.wsReady) {
                    state.wsBuffer.push(chunk);
                }
                else {
                    ws.send(chunk, { binary: true, mask: true });
                }
            });
            // Send data to the client or buffer if it's not ready yet
            ws.on("message", (message) => {
                const length = "length" in message ? message.length : null;
                this.logger.debug("Yagna WS received data", { length, socketReady: state.sReady });
                if (message instanceof Buffer$1) {
                    if (!state.sReady) {
                        state.wsBuffer.push(message);
                    }
                    else {
                        client.write(message);
                    }
                }
                else {
                    // Defensive programming
                    this.logger.error("Encountered unsupported type of message", typeof message);
                }
            });
            // WS health monitoring
            ws.on("ping", () => {
                this.logger.debug("Yagna WS received ping event");
            });
            // Configure pings to check the health of the WS to Yagna
            let isAlive = true;
            const heartBeat = () => {
                if (state.wsReady) {
                    this.logger.debug("Yagna WS checking if the client is alive");
                    if (!isAlive) {
                        this.notifyOfError("Yagna WS doesn't seem to be healthy, going to terminate");
                        // Previous check failed, time to terminate
                        return ws.terminate();
                    }
                    isAlive = false;
                    ws.ping();
                }
                else {
                    this.logger.debug("Yagna WS is not ready yet, skipping heart beat");
                }
            };
            const heartBeatInt = setInterval(heartBeat, this.heartBeatSec * 1000);
            ws.on("pong", () => {
                this.logger.debug("Yagna WS received pong event");
                isAlive = true;
            });
        });
        this.attachDebugLogsToServer();
    }
    /**
     * Start the proxy in listening mode
     *
     * @param port The port number to use on the requestor
     * @param abort The abort controller to use in order to control cancelling requests
     */
    async listen(port, abort) {
        this.logger.debug("TcpProxy listen initiated");
        // Retries if possible
        this.server.listen({
            port,
            signal: abort ? abort.signal : undefined,
        });
        return new Promise((resolve, reject) => {
            const handleError = (err) => {
                this.notifyOfError("TcpProxy failed to start listening", { port, err });
                this.server.removeListener("listening", handleListen);
                reject(err);
            };
            const handleListen = () => {
                this.logger.info("TcpProxy is listening", { port });
                this.server.removeListener("error", handleError);
                resolve();
            };
            this.server.once("listening", handleListen);
            this.server.once("error", handleError);
        });
    }
    /**
     * Gracefully close the proxy
     */
    close() {
        this.logger.debug("TCP Server close initiated by the user");
        return new Promise((resolve, reject) => {
            var _a;
            if (this.server.listening) {
                (_a = this.server) === null || _a === void 0 ? void 0 : _a.close((err) => {
                    if (err) {
                        this.notifyOfError("TCP Server closed with an error", err);
                        reject(err);
                    }
                    else {
                        this.logger.info("TCP server closed - was listening");
                        resolve();
                    }
                });
            }
            else {
                this.logger.info("TCP Server closed - was not listening");
                resolve();
            }
        });
    }
    notifyOfError(message, err) {
        this.logger.error(message, err);
        this.events.emit("error", `${message}: ${err}`);
    }
    attachDebugLogsToServer() {
        this.server.on("listening", () => this.logger.debug("TCP Server started to listen"));
        this.server.on("close", () => this.logger.debug("TCP Server closed"));
        this.server.on("connection", () => this.logger.debug("TCP Server received new connection"));
        this.server.on("drop", (data) => this.logger.debug("TCP Server dropped a connection because of reaching `maxConnections`", { data }));
        this.server.on("error", (err) => this.logger.error("Server event 'error'", err));
    }
}

/**
 * Groups most common operations that the requestors might need to implement their workflows
 */
class ExeUnit {
    constructor(activity, activityModule, options) {
        var _a, _b, _c;
        this.activity = activity;
        this.activityModule = activityModule;
        this.options = options;
        this.logger = (_a = options === null || options === void 0 ? void 0 : options.logger) !== null && _a !== void 0 ? _a : defaultLogger("work");
        this.provider = activity.provider;
        this.storageProvider = (_b = options === null || options === void 0 ? void 0 : options.storageProvider) !== null && _b !== void 0 ? _b : new NullStorageProvider();
        this.networkNode = options === null || options === void 0 ? void 0 : options.networkNode;
        this.abortSignal = createAbortSignalFromTimeout(options === null || options === void 0 ? void 0 : options.signalOrTimeout);
        this.executor = this.activityModule.createScriptExecutor(this.activity, {
            ...(_c = this.options) === null || _c === void 0 ? void 0 : _c.executionOptions,
            signalOrTimeout: this.abortSignal,
        });
    }
    async fetchState() {
        if (this.abortSignal.aborted) {
            throw new GolemAbortError("ExeUnit has been aborted");
        }
        return this.activityModule
            .refreshActivity(this.activity)
            .then((activity) => activity.getState())
            .catch((err) => {
            this.logger.error("Failed to read activity state", err);
            throw new GolemWorkError("Failed to read activity state", WorkErrorCode.ActivityStatusQueryFailed, this.activity.agreement, this.activity, err);
        });
    }
    /**
     * This function initializes the exe unit by deploying the image to the remote machine
     * and preparing and running the environment.
     * This process also includes running setup function if the user has defined it
     */
    async setup() {
        try {
            let state = await this.fetchState();
            if (state === ActivityStateEnum.Ready) {
                await this.setupActivity();
                return;
            }
            if (state === ActivityStateEnum.Initialized) {
                await this.deployActivity();
            }
            await sleep(1000, true);
            state = await this.fetchState();
            if (state !== ActivityStateEnum.Ready) {
                throw new GolemWorkError(`Activity ${this.activity.id} cannot reach the Ready state. Current state: ${state}`, WorkErrorCode.ActivityDeploymentFailed, this.activity.agreement, this.activity, this.activity.provider);
            }
            await this.setupActivity();
        }
        catch (error) {
            if (this.abortSignal.aborted) {
                throw this.abortSignal.reason.name === "TimeoutError"
                    ? new GolemTimeoutError("Initializing of the exe-unit has been aborted due to a timeout", this.abortSignal.reason)
                    : new GolemAbortError("Initializing of the exe-unit has been aborted", this.abortSignal.reason);
            }
            throw error;
        }
    }
    /**
     * This function starts the teardown function if the user has defined it.
     * It is run before the machine is destroyed.
     */
    async teardown() {
        var _a;
        if ((_a = this.options) === null || _a === void 0 ? void 0 : _a.teardown) {
            await this.options.teardown(this);
        }
    }
    async deployActivity() {
        var _a, _b;
        try {
            const executionMetadata = await this.executor.execute(new Script([
                new Deploy({
                    ...(_b = (_a = this.networkNode) === null || _a === void 0 ? void 0 : _a.getNetworkDeploymentArg) === null || _b === void 0 ? void 0 : _b.call(_a),
                    ...this.getVolumeDeploymentArg(),
                }),
                new Start(),
            ]).getExeScriptRequest());
            const result$ = this.executor.getResultsObservable(executionMetadata);
            // if any result is an error, throw an error
            await lastValueFrom(result$.pipe(tap((result) => {
                if (result.result === "Error") {
                    throw new Error(String(result.message));
                }
            })));
        }
        catch (error) {
            throw new GolemWorkError(`Unable to deploy activity. ${error}`, WorkErrorCode.ActivityDeploymentFailed, this.activity.agreement, this.activity, this.activity.provider, error);
        }
    }
    async setupActivity() {
        var _a;
        if ((_a = this.options) === null || _a === void 0 ? void 0 : _a.setup) {
            await this.options.setup(this);
        }
    }
    async run(exeOrCmd, argsOrOptions, options) {
        const isArray = Array.isArray(argsOrOptions);
        this.logger.debug("Running command", {
            command: isArray ? `${exeOrCmd} ${argsOrOptions === null || argsOrOptions === void 0 ? void 0 : argsOrOptions.join(" ")}` : exeOrCmd,
            provider: this.provider.name,
        });
        const run = isArray
            ? new Run(exeOrCmd, argsOrOptions, options === null || options === void 0 ? void 0 : options.env, options === null || options === void 0 ? void 0 : options.capture)
            : new Run("/bin/sh", ["-c", exeOrCmd], argsOrOptions === null || argsOrOptions === void 0 ? void 0 : argsOrOptions.env, argsOrOptions === null || argsOrOptions === void 0 ? void 0 : argsOrOptions.capture);
        const runOptions = isArray ? options : argsOrOptions;
        return this.runOneCommand(run, runOptions);
    }
    async runAndStream(exeOrCmd, argsOrOptions, options) {
        const isArray = Array.isArray(argsOrOptions);
        const capture = {
            stdout: { stream: { format: "string" } },
            stderr: { stream: { format: "string" } },
        };
        const run = isArray
            ? new Run(exeOrCmd, argsOrOptions, options === null || options === void 0 ? void 0 : options.env, capture)
            : new Run("/bin/sh", ["-c", exeOrCmd], argsOrOptions === null || argsOrOptions === void 0 ? void 0 : argsOrOptions.env, capture);
        const script = new Script([run]);
        // In this case, the script consists only of one run command,
        // so we skip the execution of script.before and script.after
        const executionMetadata = await this.executor.execute(script.getExeScriptRequest());
        const activityResult$ = this.executor.getResultsObservable(executionMetadata, true, options === null || options === void 0 ? void 0 : options.signalOrTimeout, options === null || options === void 0 ? void 0 : options.maxRetries);
        return new RemoteProcess(this.activityModule, activityResult$, this.activity, this.logger);
    }
    /**
     * Generic transfer command, requires the user to provide a publicly readable transfer source
     *
     * @param from - publicly available resource for reading. Supported protocols: file, http, ftp or gftp
     * @param to - file path
     * @param options Additional run options.
     */
    async transfer(from, to, options) {
        this.logger.debug(`Transferring`, { from, to });
        return this.runOneCommand(new Transfer(from, to), options);
    }
    async uploadFile(src, dst, options) {
        this.logger.debug(`Uploading file`, { src, dst });
        return this.runOneCommand(new UploadFile(this.storageProvider, src, dst), options);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uploadJson(json, dst, options) {
        this.logger.debug(`Uploading json`, { dst });
        const src = new TextEncoder().encode(JSON.stringify(json));
        return this.runOneCommand(new UploadData(this.storageProvider, src, dst), options);
    }
    uploadData(data, dst, options) {
        this.logger.debug(`Uploading data`, { dst });
        return this.runOneCommand(new UploadData(this.storageProvider, data, dst), options);
    }
    downloadFile(src, dst, options) {
        this.logger.debug(`Downloading file from`, { src, dst });
        return this.runOneCommand(new DownloadFile(this.storageProvider, src, dst), options);
    }
    downloadData(src, options) {
        this.logger.debug(`Downloading data`, { src });
        return this.runOneCommand(new DownloadData(this.storageProvider, src), options);
    }
    async downloadJson(src, options) {
        this.logger.debug(`Downloading json`, { src });
        const result = await this.downloadData(src, options);
        if (result.result !== "Ok") {
            return new Result({
                ...result,
                data: undefined,
            });
        }
        return new Result({
            ...result,
            data: JSON.parse(new TextDecoder().decode(result.data)),
        });
    }
    beginBatch() {
        return new Batch(this.executor, this.storageProvider, this.logger);
    }
    /**
     * Provides a WebSocket URI that allows communicating with a remote process listening on the target port
     *
     * @param port The port number used by the service running within an activity on the provider
     */
    getWebsocketUri(port) {
        if (!this.networkNode)
            throw new GolemWorkError("There is no network in this exe-unit", WorkErrorCode.NetworkSetupMissing, this.activity.agreement, this.activity, this.activity.provider);
        return this.networkNode.getWebsocketUri(port);
    }
    getIp() {
        if (!this.networkNode)
            throw new GolemWorkError("There is no network in this exe-unit", WorkErrorCode.NetworkSetupMissing, this.activity.agreement, this.activity, this.activity.provider);
        return this.networkNode.ip;
    }
    /**
     * Creates a new TCP proxy that will allow tunnelling the TPC traffic from the provider via the requestor
     *
     * @param portOnProvider The port that the service running on the provider is listening to
     */
    createTcpProxy(portOnProvider) {
        var _a, _b;
        if (!((_b = (_a = this.options) === null || _a === void 0 ? void 0 : _a.yagnaOptions) === null || _b === void 0 ? void 0 : _b.apiKey)) {
            throw new GolemConfigError("You need to provide yagna API key to use the TCP Proxy functionality");
        }
        return new TcpProxy(this.getWebsocketUri(portOnProvider), this.options.yagnaOptions.apiKey, {
            logger: this.logger,
        });
    }
    getDto() {
        return {
            provider: this.provider,
            id: this.activity.id,
            agreement: this.activity.agreement,
        };
    }
    async runOneCommand(command, options) {
        // Initialize script.
        const script = new Script([command]);
        await script.before().catch((e) => {
            var _a, _b;
            throw new GolemWorkError(`Script initialization failed for command: ${JSON.stringify(command.toJson())}. ${((_b = (_a = e === null || e === void 0 ? void 0 : e.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || (e === null || e === void 0 ? void 0 : e.message) || e}`, WorkErrorCode.ScriptInitializationFailed, this.activity.agreement, this.activity, this.activity.provider, e);
        });
        await sleep(100, true);
        // Send script.
        const executionMetadata = await this.executor.execute(script.getExeScriptRequest());
        const result$ = this.executor.getResultsObservable(executionMetadata, false, options === null || options === void 0 ? void 0 : options.signalOrTimeout, options === null || options === void 0 ? void 0 : options.maxRetries);
        // Process result.
        let allResults = await lastValueFrom(result$.pipe(toArray()));
        allResults = await script.after(allResults);
        // Handle errors.
        const commandsErrors = allResults.filter((res) => res.result === "Error");
        if (commandsErrors.length) {
            const errorMessage = commandsErrors
                .map((err) => { var _a, _b; return `Error: ${err.message}. Stdout: ${(_a = err.stdout) === null || _a === void 0 ? void 0 : _a.toString().trim()}. Stderr: ${(_b = err.stderr) === null || _b === void 0 ? void 0 : _b.toString().trim()}`; })
                .join(". ");
            this.logger.warn(`Task error`, {
                provider: this.provider.name,
                error: errorMessage,
            });
        }
        return allResults[0];
    }
    getVolumeDeploymentArg() {
        var _a;
        if (!((_a = this.options) === null || _a === void 0 ? void 0 : _a.volumes)) {
            return {};
        }
        const argument = {
            volumes: {},
        };
        for (const [, volumeSpec] of Object.entries(this.options.volumes)) {
            argument.volumes[volumeSpec.path] = {
                storage: { size: `${volumeSpec.sizeGib}g`, errors: "panic" },
            };
        }
        return argument;
    }
}

async function withTimeout(promise, timeoutMs) {
    let timeoutId;
    const timeout = (milliseconds) => new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new GolemTimeoutError("Timeout for the operation was reached")), milliseconds);
    });
    return Promise.race([promise, timeout(timeoutMs)]).finally(() => clearTimeout(timeoutId));
}

const RETRYABLE_ERROR_STATUS_CODES = [408, 500];
class ExeScriptExecutor {
    constructor(activity, activityModule, logger, options) {
        this.activity = activity;
        this.activityModule = activityModule;
        this.logger = logger;
        this.options = new ExecutionConfig(options);
        this.abortSignal = createAbortSignalFromTimeout(options === null || options === void 0 ? void 0 : options.signalOrTimeout);
    }
    /**
     * Executes the provided script and returns the batch id and batch size that can be used
     * to fetch it's results
     * @param script
     * @returns script execution metadata - batch id and batch size that can be used to fetch results using `getResultsObservable`
     */
    async execute(script) {
        try {
            this.abortSignal.throwIfAborted();
            const batchId = await this.send(script);
            const batchSize = JSON.parse(script.text).length;
            this.logger.debug(`Script sent.`, { batchId, script });
            return { batchId, batchSize };
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            this.logger.error("Execution of script failed.", {
                reason: message,
            });
            if (this.abortSignal.aborted) {
                throw new GolemAbortError("Executions of script has been aborted", this.abortSignal.reason);
            }
            throw new GolemWorkError(`Unable to execute script. ${message}`, WorkErrorCode.ScriptExecutionFailed, this.activity.agreement, this.activity, this.activity.provider, error);
        }
    }
    /**
     * Given a batch id and batch size collect the results from yagna. You can choose to either
     * stream them as they go or poll for them. When a timeout is reached (by either the timeout provided
     * as an argument here or in the constructor) the observable will emit an error.
     *
     *
     * @param batch - batch id and batch size
     * @param stream - define type of getting results from execution (polling or streaming)
     * @param signalOrTimeout - the timeout in milliseconds or an AbortSignal that will be used to cancel the execution
     * @param maxRetries - maximum number of retries retrieving results when an error occurs, default: 10
     */
    getResultsObservable(batch, stream, signalOrTimeout, maxRetries) {
        const { signal, cleanup } = anyAbortSignal(this.abortSignal, createAbortSignalFromTimeout(signalOrTimeout));
        // observable that emits when the script execution should be aborted
        const abort$ = new Observable((subscriber) => {
            const getError = () => new GolemAbortError("Execution of script has been aborted", signal.reason);
            if (signal.aborted) {
                subscriber.error(getError());
            }
            signal.addEventListener("abort", () => {
                subscriber.error(getError());
            });
        });
        // get an observable that will emit results of a batch execution
        const results$ = stream
            ? this.streamingBatch(batch.batchId, batch.batchSize)
            : this.pollingBatch(batch.batchId, maxRetries);
        return mergeUntilFirstComplete(abort$, results$).pipe(finalize(cleanup));
    }
    async send(script) {
        return withTimeout(this.activityModule.executeScript(this.activity, script), 10000);
    }
    pollingBatch(batchId, maxRetries) {
        let isCompleted = false;
        let lastIndex;
        const { id: activityId, agreement } = this.activity;
        const { activityExeBatchResultPollIntervalSeconds, activityExeBatchResultMaxRetries } = this.options;
        const { logger, activity, activityModule } = this;
        return new Observable((subscriber) => {
            const pollForResults = async () => {
                if (isCompleted) {
                    subscriber.complete();
                    return;
                }
                logger.debug("Polling for batch script execution result");
                await retry(async (bail, attempt) => {
                    var _a, _b;
                    logger.debug(`Trying to poll for batch execution results from yagna. Attempt: ${attempt}`);
                    try {
                        if (isCompleted) {
                            bail(new Error("Batch is finished"));
                        }
                        const results = await activityModule.getBatchResults(activity, batchId, undefined, activityExeBatchResultPollIntervalSeconds);
                        const newResults = results && results.slice(lastIndex + 1);
                        logger.debug(`Received batch execution results`, { results: newResults, activityId });
                        if (Array.isArray(newResults) && newResults.length) {
                            newResults.forEach((result) => {
                                subscriber.next(result);
                                isCompleted || (isCompleted = !!result.isBatchFinished);
                                lastIndex = result.index;
                            });
                        }
                    }
                    catch (error) {
                        logger.debug(`Failed to fetch activity results. Attempt: ${attempt}. ${error}`);
                        const errorStatus = (_a = error === null || error === void 0 ? void 0 : error.status) !== null && _a !== void 0 ? _a : (_b = error.previous) === null || _b === void 0 ? void 0 : _b.status;
                        if (RETRYABLE_ERROR_STATUS_CODES.includes(errorStatus)) {
                            throw error;
                        }
                        else {
                            bail(error);
                        }
                    }
                }, {
                    retries: maxRetries !== null && maxRetries !== void 0 ? maxRetries : activityExeBatchResultMaxRetries,
                    maxTimeout: 15000,
                });
                return runOnNextEventLoopIteration(pollForResults);
            };
            pollForResults().catch((error) => {
                logger.error(`Polling for batch results failed`, error);
                subscriber.error(error);
            });
            return () => {
                isCompleted = true;
            };
        }).pipe(catchError((error) => {
            if (error instanceof GolemWorkError) {
                throw error;
            }
            throw new GolemWorkError(`Unable to get activity results. ${error}`, WorkErrorCode.ActivityResultsFetchingFailed, agreement, activity, activity.provider, error);
        }));
    }
    streamingBatch(batchId, batchSize) {
        return this.activityModule.observeStreamingBatchEvents(this.activity, batchId).pipe(map((resultEvents) => this.parseEventToResult(resultEvents, batchSize)), takeWhile((result) => !result.isBatchFinished, true), 
        // transform to domain error
        catchError((error) => {
            throw new GolemWorkError(`Unable to get activity results. ${error}`, WorkErrorCode.ActivityResultsFetchingFailed, this.activity.agreement, this.activity, this.activity.provider, error);
        }));
    }
    parseEventToResult(event, batchSize) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        // StreamingBatchEvent has a slightly more extensive structure,
        // including a return code that could be added to the Result entity... (?)
        const result = new Result({
            index: event.index,
            eventDate: event.timestamp,
            result: ((_a = event === null || event === void 0 ? void 0 : event.kind) === null || _a === void 0 ? void 0 : _a.finished)
                ? ((_c = (_b = event === null || event === void 0 ? void 0 : event.kind) === null || _b === void 0 ? void 0 : _b.finished) === null || _c === void 0 ? void 0 : _c.return_code) === 0
                    ? "Ok"
                    : "Error"
                : ((_d = event === null || event === void 0 ? void 0 : event.kind) === null || _d === void 0 ? void 0 : _d.stderr)
                    ? "Error"
                    : "Ok",
            stdout: (_e = event === null || event === void 0 ? void 0 : event.kind) === null || _e === void 0 ? void 0 : _e.stdout,
            stderr: (_f = event === null || event === void 0 ? void 0 : event.kind) === null || _f === void 0 ? void 0 : _f.stderr,
            message: (_h = (_g = event === null || event === void 0 ? void 0 : event.kind) === null || _g === void 0 ? void 0 : _g.finished) === null || _h === void 0 ? void 0 : _h.message,
            isBatchFinished: event.index + 1 >= batchSize && Boolean((_j = event === null || event === void 0 ? void 0 : event.kind) === null || _j === void 0 ? void 0 : _j.finished),
        });
        this.logger.debug("Received stream batch execution result", { result });
        return result;
    }
}

class ActivityModuleImpl {
    constructor(services) {
        this.services = services;
        this.events = new EventEmitter();
        this.logger = defaultLogger("activity");
        this.logger = services.logger;
        this.activityApi = services.activityApi;
    }
    createScriptExecutor(activity, options) {
        return new ExeScriptExecutor(activity, this, this.logger.child("executor"), options);
    }
    async executeScript(activity, script) {
        this.logger.debug("Executing script on activity", { activityId: activity.id });
        try {
            this.events.emit("scriptSent", {
                activity,
                script,
            });
            const result = await this.activityApi.executeScript(activity, script);
            this.events.emit("scriptExecuted", {
                activity: await this.refreshActivity(activity).catch(() => {
                    this.logger.warn("Failed to refresh activity after script execution", { activityId: activity.id });
                    return activity;
                }),
                script,
                result,
            });
            return result;
        }
        catch (error) {
            this.events.emit("errorExecutingScript", {
                activity: await this.refreshActivity(activity).catch(() => {
                    this.logger.warn("Failed to refresh activity after script execution error", { activityId: activity.id });
                    return activity;
                }),
                script,
                error,
            });
            throw error;
        }
    }
    async getBatchResults(activity, batchId, commandIndex, timeout) {
        this.logger.debug("Fetching batch results", { activityId: activity.id, batchId });
        try {
            const results = await this.activityApi.getExecBatchResults(activity, batchId, commandIndex, timeout);
            this.events.emit("batchResultsReceived", {
                activity: await this.refreshActivity(activity).catch(() => {
                    this.logger.warn("Failed to refresh activity after batch results received", { activityId: activity.id });
                    return activity;
                }),
                batchId,
                results,
            });
            return results;
        }
        catch (error) {
            this.events.emit("errorGettingBatchResults", {
                activity: await this.refreshActivity(activity).catch(() => {
                    this.logger.warn("Failed to refresh activity after batch results error", { activityId: activity.id });
                    return activity;
                }),
                batchId,
                error,
            });
            throw error;
        }
    }
    observeStreamingBatchEvents(activity, batchId, commandIndex) {
        this.logger.debug("Observing streaming batch events", { activityId: activity.id, batchId });
        return this.activityApi.getExecBatchEvents(activity, batchId, commandIndex).pipe(tap(async (event) => {
            this.events.emit("batchEventsReceived", {
                activity: await this.refreshActivity(activity).catch(() => {
                    this.logger.warn("Failed to refresh activity after batch events received", { activityId: activity.id });
                    return activity;
                }),
                batchId,
                event,
            });
        }), catchError(async (error) => {
            this.events.emit("errorGettingBatchEvents", {
                activity: await this.refreshActivity(activity).catch(() => {
                    this.logger.warn("Failed to refresh activity after batch events error", { activityId: activity.id });
                    return activity;
                }),
                batchId,
                error,
            });
            throw error;
        }));
    }
    async createActivity(agreement) {
        this.logger.debug("Creating activity", {
            agreementId: agreement.id,
            provider: agreement.provider,
        });
        try {
            const activity = await this.activityApi.createActivity(agreement);
            this.events.emit("activityCreated", { activity });
            this.logger.info("Created activity", {
                activityId: activity.id,
                agreementId: agreement.id,
                provider: agreement.provider,
            });
            return activity;
        }
        catch (error) {
            this.events.emit("errorCreatingActivity", error);
            throw error;
        }
    }
    async destroyActivity(activity) {
        this.logger.debug("Destroying activity", activity);
        try {
            const updated = await this.activityApi.destroyActivity(activity);
            this.events.emit("activityDestroyed", {
                activity: updated,
            });
            this.logger.info("Destroyed activity", {
                activityId: updated.id,
                agreementId: updated.agreement.id,
                provider: updated.agreement.provider,
            });
            return updated;
        }
        catch (error) {
            this.events.emit("errorDestroyingActivity", { activity, error });
            throw error;
        }
    }
    async refreshActivity(staleActivity) {
        // logging to debug level to avoid spamming the logs because this method is called frequently
        this.logger.debug("Fetching latest activity state", {
            activityId: staleActivity.id,
            lastState: staleActivity.getState(),
        });
        try {
            const freshActivity = await this.activityApi.getActivity(staleActivity.id);
            if (freshActivity.getState() !== freshActivity.getPreviousState()) {
                this.logger.debug("Activity state changed", {
                    activityId: staleActivity.id,
                    previousState: freshActivity.getPreviousState(),
                    newState: freshActivity.getState(),
                });
                this.events.emit("activityStateChanged", {
                    activity: freshActivity,
                    previousState: freshActivity.getPreviousState(),
                });
            }
            return freshActivity;
        }
        catch (error) {
            this.events.emit("errorRefreshingActivity", {
                activity: staleActivity,
                error,
            });
            throw error;
        }
    }
    async findActivityById(activityId) {
        this.logger.info("Fetching activity by ID", { activityId });
        return await this.activityApi.getActivity(activityId);
    }
    async createExeUnit(activity, options) {
        this.logger.debug("Creating exe-unit for activity", { activityId: activity.id });
        const exe = new ExeUnit(activity, this, {
            yagnaOptions: this.services.yagna.yagnaOptions,
            logger: this.logger.child("exe-unit"),
            ...options,
        });
        this.logger.debug("Initializing the exe-unit for activity", { activityId: activity.id });
        try {
            await exe.setup();
            const refreshedActivity = await this.refreshActivity(activity).catch(() => {
                this.logger.warn("Failed to refresh activity after work context initialization", { activityId: activity.id });
                return activity;
            });
            this.events.emit("exeUnitInitialized", {
                activity: refreshedActivity,
            });
            this.logger.info("Initialized exe-unit", {
                activityId: activity.id,
                state: refreshedActivity.getState(),
            });
            return exe;
        }
        catch (error) {
            this.events.emit("errorInitializingExeUnit", {
                activity: await this.refreshActivity(activity).catch(() => {
                    this.logger.warn("Failed to refresh activity after exe-unit initialization error", {
                        activityId: activity.id,
                    });
                    return activity;
                }),
                error,
            });
            throw error;
        }
    }
}

var _GolemNetworkError_network;
var NetworkErrorCode;
(function (NetworkErrorCode) {
    NetworkErrorCode["ServiceNotInitialized"] = "ServiceNotInitialized";
    NetworkErrorCode["NetworkSetupMissing"] = "NetworkSetupMissing";
    NetworkErrorCode["NetworkCreationFailed"] = "NetworkCreationFailed";
    NetworkErrorCode["NoAddressesAvailable"] = "NoAddressesAvailable";
    NetworkErrorCode["AddressOutOfRange"] = "AddressOutOfRange";
    NetworkErrorCode["AddressAlreadyAssigned"] = "AddressAlreadyAssigned";
    NetworkErrorCode["NodeAddingFailed"] = "NodeAddingFailed";
    NetworkErrorCode["NodeRemovalFailed"] = "NodeRemovalFailed";
    NetworkErrorCode["NetworkRemovalFailed"] = "NetworkRemovalFailed";
    NetworkErrorCode["GettingIdentityFailed"] = "GettingIdentityFailed";
    NetworkErrorCode["NetworkRemoved"] = "NetworkRemoved";
})(NetworkErrorCode || (NetworkErrorCode = {}));
class GolemNetworkError extends GolemModuleError {
    constructor(message, code, network, previous) {
        super(message, code, previous);
        this.code = code;
        this.previous = previous;
        _GolemNetworkError_network.set(this, void 0);
        __classPrivateFieldSet(this, _GolemNetworkError_network, network, "f");
    }
    getNetwork() {
        return __classPrivateFieldGet(this, _GolemNetworkError_network, "f");
    }
}
_GolemNetworkError_network = new WeakMap();

var NetworkState;
(function (NetworkState) {
    NetworkState["Active"] = "Active";
    NetworkState["Removed"] = "Removed";
})(NetworkState || (NetworkState = {}));
class Network {
    constructor(id, ip, mask, gateway) {
        this.id = id;
        this.nodes = new Map();
        this.state = NetworkState.Active;
        this.ipRange = IPv4CidrRange.fromCidr(mask ? `${ip.split("/")[0]}/${IPv4Mask.fromDecimalDottedString(mask).prefix}` : ip);
        this.ipIterator = this.ipRange[Symbol.iterator]();
        this.ip = this.getFirstAvailableIpAddress();
        this.mask = this.ipRange.getPrefix().toMask();
        this.gateway = gateway ? new IPv4(gateway) : undefined;
    }
    /**
     * Returns information about the network.
     */
    getNetworkInfo() {
        var _a, _b;
        return {
            id: this.id,
            ip: this.ip.toString(),
            mask: this.mask.toString(),
            gateway: (_b = (_a = this.gateway) === null || _a === void 0 ? void 0 : _a.toString) === null || _b === void 0 ? void 0 : _b.call(_a),
            nodes: Object.fromEntries(Array.from(this.nodes).map(([id, node]) => [node.ip, id])),
        };
    }
    /**
     * Adds a node to the network.
     * @param node - The network node to be added.
     */
    addNode(node) {
        if (this.isRemoved()) {
            throw new GolemNetworkError(`Unable to add node ${node.id} to removed network`, NetworkErrorCode.NetworkRemoved, this.getNetworkInfo());
        }
        if (this.hasNode(node)) {
            throw new GolemNetworkError(`Node ${node.id} has already been added to this network`, NetworkErrorCode.AddressAlreadyAssigned);
        }
        this.nodes.set(node.id, node);
    }
    /**
     * Checks whether the node belongs to the network.
     * @param node - The network node to check.
     */
    hasNode(node) {
        return this.nodes.has(node.id);
    }
    /**
     * Removes a node from the network.
     * @param node - The network node to be removed.
     */
    removeNode(node) {
        if (this.isRemoved()) {
            throw new GolemNetworkError(`Unable to remove node ${node.id} from removed network`, NetworkErrorCode.NetworkRemoved, this.getNetworkInfo());
        }
        if (!this.hasNode(node)) {
            throw new GolemNetworkError(`There is no node ${node.id} in the network`, NetworkErrorCode.NodeRemovalFailed);
        }
        this.nodes.delete(node.id);
    }
    markAsRemoved() {
        if (this.state === NetworkState.Removed) {
            throw new GolemNetworkError("Network already removed", NetworkErrorCode.NetworkRemoved, this.getNetworkInfo());
        }
        this.state = NetworkState.Removed;
    }
    /**
     * Returns the first available IP address in the network.
     */
    getFirstAvailableIpAddress() {
        const ip = this.ipIterator.next().value;
        if (!ip)
            throw new GolemNetworkError(`No more addresses available in ${this.ipRange.toCidrString()}`, NetworkErrorCode.NoAddressesAvailable, this.getNetworkInfo());
        return ip;
    }
    /**
     * Checks if a given IP address is within the network range.
     * @param ip - The IPv4 address to check.
     */
    isIpInNetwork(ip) {
        return this.ipRange.contains(new IPv4CidrRange(ip, new IPv4Prefix(BigInt(this.mask.prefix))));
    }
    /**
     * Checks if a given node ID is unique within the network.
     * @param id - The node ID to check.
     */
    isNodeIdUnique(id) {
        return !this.nodes.has(id);
    }
    /**
     * Checks if a given IP address is unique within the network.
     */
    isNodeIpUnique(ip) {
        for (const node of this.nodes.values()) {
            if (new IPv4(node.ip).isEquals(ip))
                return false;
        }
        return true;
    }
    isRemoved() {
        return this.state === NetworkState.Removed;
    }
}

/**
 * Describes a node in a VPN, mapping a Golem node id to an IP address
 */
class NetworkNode {
    constructor(id, ip, getNetworkInfo, yagnaBaseUri) {
        this.id = id;
        this.ip = ip;
        this.getNetworkInfo = getNetworkInfo;
        this.yagnaBaseUri = yagnaBaseUri;
    }
    /**
     * Generate a dictionary of arguments that are required for the appropriate
     *`Deploy` command of an exe-script in order to pass the network configuration to the runtime
     * on the provider's end.
     */
    getNetworkDeploymentArg() {
        return {
            net: [
                {
                    ...this.getNetworkInfo(),
                    nodeIp: this.ip,
                },
            ],
        };
    }
    getWebsocketUri(port) {
        const url = new URL(this.yagnaBaseUri);
        url.protocol = "ws";
        return `${url.href}/net/${this.getNetworkInfo().id}/tcp/${this.ip}/${port}`;
    }
}

class NetworkModuleImpl {
    constructor(deps) {
        this.events = new EventEmitter();
        this.logger = defaultLogger("network");
        this.lock = new AsyncLock();
        this.networkApi = deps.networkApi;
        if (deps.logger) {
            this.logger = deps.logger;
        }
    }
    async createNetwork(options) {
        var _a, _b, _c, _d;
        this.logger.debug(`Creating network`, options);
        try {
            const ipDecimalDottedString = ((_b = (_a = options === null || options === void 0 ? void 0 : options.ip) === null || _a === void 0 ? void 0 : _a.split("/")) === null || _b === void 0 ? void 0 : _b[0]) || "192.168.0.0";
            const maskBinaryNotation = parseInt(((_d = (_c = options === null || options === void 0 ? void 0 : options.ip) === null || _c === void 0 ? void 0 : _c.split("/")) === null || _d === void 0 ? void 0 : _d[1]) || "24");
            const maskPrefix = (options === null || options === void 0 ? void 0 : options.mask) ? IPv4Mask.fromDecimalDottedString(options.mask).prefix : maskBinaryNotation;
            const ipRange = IPv4CidrRange.fromCidr(`${IPv4.fromString(ipDecimalDottedString)}/${maskPrefix}`);
            const ip = ipRange.getFirst();
            const mask = ipRange.getPrefix().toMask();
            const gateway = (options === null || options === void 0 ? void 0 : options.gateway) ? new IPv4(options.gateway) : undefined;
            const network = await this.networkApi.createNetwork({
                ip: ip.toString(),
                mask: mask === null || mask === void 0 ? void 0 : mask.toString(),
                gateway: gateway === null || gateway === void 0 ? void 0 : gateway.toString(),
            });
            // add Requestor as network node
            const requestorId = await this.networkApi.getIdentity();
            await this.createNetworkNode(network, requestorId, options === null || options === void 0 ? void 0 : options.ownerIp);
            this.logger.info(`Created network`, network.getNetworkInfo());
            this.events.emit("networkCreated", { network });
            return network;
        }
        catch (err) {
            const message = getMessageFromApiError(err);
            const error = err instanceof GolemNetworkError
                ? err
                : new GolemNetworkError(`Unable to create network. ${message}`, NetworkErrorCode.NetworkCreationFailed, undefined, err);
            this.events.emit("errorCreatingNetwork", { error });
            throw error;
        }
    }
    async removeNetwork(network) {
        this.logger.debug(`Removing network`, network.getNetworkInfo());
        await this.lock.acquire(`net-${network.id}`, async () => {
            try {
                await this.networkApi.removeNetwork(network);
                network.markAsRemoved();
                this.logger.info(`Removed network`, network.getNetworkInfo());
                this.events.emit("networkRemoved", { network });
            }
            catch (error) {
                this.events.emit("errorRemovingNetwork", { network, error });
                throw error;
            }
        });
    }
    async createNetworkNode(network, nodeId, nodeIp) {
        this.logger.debug(`Creating network node`, { nodeId, nodeIp });
        return await this.lock.acquire(`net-${network.id}`, async () => {
            try {
                if (!network.isNodeIdUnique(nodeId)) {
                    throw new GolemNetworkError(`Network ID '${nodeId}' has already been assigned in this network.`, NetworkErrorCode.AddressAlreadyAssigned, network.getNetworkInfo());
                }
                if (network.isRemoved()) {
                    throw new GolemNetworkError(`Unable to create network node ${nodeId}. Network has already been removed`, NetworkErrorCode.NetworkRemoved, network.getNetworkInfo());
                }
                const ipv4 = this.getFreeIpInNetwork(network, nodeIp);
                const node = await this.networkApi.createNetworkNode(network, nodeId, ipv4.toString());
                network.addNode(node);
                this.logger.info(`Added network node`, { id: nodeId, ip: ipv4.toString() });
                this.events.emit("nodeCreated", { network, node });
                return node;
            }
            catch (error) {
                this.events.emit("errorCreatingNode", { network, error });
                throw error;
            }
        });
    }
    async removeNetworkNode(network, node) {
        this.logger.debug(`Removing network node`, { nodeId: node.id, nodeIp: node.ip });
        return await this.lock.acquire(`net-${network.id}`, async () => {
            try {
                if (!network.hasNode(node)) {
                    throw new GolemNetworkError(`The network node ${node.id} does not belong to the network`, NetworkErrorCode.NodeRemovalFailed, network.getNetworkInfo());
                }
                if (network.isRemoved()) {
                    this.logger.debug(`Unable to remove network node ${node.id}. Network has already been removed`, {
                        network,
                        node,
                    });
                    return;
                }
                await this.networkApi.removeNetworkNode(network, node);
                network.removeNode(node);
                this.logger.info(`Removed network node`, {
                    network: network.getNetworkInfo().ip,
                    nodeIp: node.ip,
                });
                this.events.emit("nodeRemoved", { network, node });
            }
            catch (error) {
                this.events.emit("errorRemovingNode", { network, node, error });
                throw error;
            }
        });
    }
    getFreeIpInNetwork(network, targetIp) {
        if (!targetIp) {
            return network.getFirstAvailableIpAddress();
        }
        const ipv4 = IPv4.fromString(targetIp);
        if (!network.isIpInNetwork(ipv4)) {
            throw new GolemNetworkError(`The given IP ('${targetIp}') address must belong to the network ('${network.getNetworkInfo().ip}').`, NetworkErrorCode.AddressOutOfRange, network.getNetworkInfo());
        }
        if (!network.isNodeIpUnique(ipv4)) {
            throw new GolemNetworkError(`IP '${targetIp.toString()}' has already been assigned in this network.`, NetworkErrorCode.AddressAlreadyAssigned, network.getNetworkInfo());
        }
        return ipv4;
    }
}

/**
 * Combines an agreement, activity, exe unit and payment process into a single high-level abstraction.
 */
class ResourceRental {
    constructor(agreement, storageProvider, paymentProcess, marketModule, activityModule, logger, resourceRentalOptions) {
        var _a;
        this.agreement = agreement;
        this.storageProvider = storageProvider;
        this.paymentProcess = paymentProcess;
        this.marketModule = marketModule;
        this.activityModule = activityModule;
        this.logger = logger;
        this.resourceRentalOptions = resourceRentalOptions;
        this.events = new EventEmitter();
        this.currentExeUnit = null;
        this.abortController = new AbortController();
        this.networkNode = (_a = this.resourceRentalOptions) === null || _a === void 0 ? void 0 : _a.networkNode;
        this.createExeUnit(this.abortController.signal).catch((error) => this.logger.debug(`Failed to automatically create the exe unit during resource rental initialization`, { error }));
        // TODO: Listen to agreement events to know when it goes down due to provider closing it!
    }
    async startStopAndFinalize(signalOrTimeout) {
        var _a;
        try {
            if (this.currentExeUnit) {
                await this.currentExeUnit.teardown();
            }
            this.abortController.abort("The resource rental is finalizing");
            if ((_a = this.currentExeUnit) === null || _a === void 0 ? void 0 : _a.activity) {
                await this.activityModule.destroyActivity(this.currentExeUnit.activity);
            }
            if ((await this.fetchAgreementState()) !== "Terminated") {
                await this.marketModule.terminateAgreement(this.agreement);
            }
            if (this.paymentProcess.isFinished()) {
                return;
            }
            this.logger.info("Waiting for payment process of agreement to finish", { agreementId: this.agreement.id });
            const abortSignal = createAbortSignalFromTimeout(signalOrTimeout);
            await waitFor(() => this.paymentProcess.isFinished(), {
                abortSignal: abortSignal,
            }).catch((error) => {
                this.paymentProcess.stop();
                if (error instanceof GolemTimeoutError) {
                    throw new GolemTimeoutError(`The finalization of payment process has been aborted due to a timeout`, abortSignal.reason);
                }
                throw new GolemAbortError("The finalization of payment process has been aborted", abortSignal.reason);
            });
            this.logger.info("Finalized payment process", { agreementId: this.agreement.id });
        }
        catch (error) {
            this.logger.error("Filed to finalize payment process", { agreementId: this.agreement.id, error });
            throw error;
        }
        finally {
            this.events.emit("finalized");
        }
    }
    /**
     * Terminates the activity and agreement (stopping any ongoing work) and finalizes the payment process.
     * Resolves when the rental will be fully terminated and all pending business operations finalized.
     * If the rental is already finalized, it will resolve immediately with the last finalization result.
     * @param signalOrTimeout - timeout in milliseconds or an AbortSignal that will be used to cancel the finalization process, especially the payment process.
     * Please note that canceling the payment process may fail to comply with the terms of the agreement.
     * If this method is called multiple times, it will return the same promise, ignoring the signal or timeout.
     */
    async stopAndFinalize(signalOrTimeout) {
        if (this.finalizePromise) {
            return this.finalizePromise;
        }
        this.finalizePromise = this.startStopAndFinalize(signalOrTimeout);
        return this.finalizePromise;
    }
    hasActivity() {
        return this.currentExeUnit !== null;
    }
    /**
     * Creates an activity on the Provider, and returns a exe-unit that can be used to operate within the activity
     * @param signalOrTimeout - timeout in milliseconds or an AbortSignal that will be used to cancel the exe-unit request,
     * especially when the exe-unit is in the process of starting, deploying and preparing the environment (including setup function)
     */
    async getExeUnit(signalOrTimeout) {
        if (this.finalizePromise || this.abortController.signal.aborted) {
            throw new GolemUserError("The resource rental is not active. It may have been aborted or finalized");
        }
        if (this.currentExeUnit !== null) {
            return this.currentExeUnit;
        }
        const abortController = new AbortController();
        this.abortController.signal.addEventListener("abort", () => abortController.abort(this.abortController.signal.reason));
        if (signalOrTimeout) {
            const abortSignal = createAbortSignalFromTimeout(signalOrTimeout);
            abortSignal.addEventListener("abort", () => abortController.abort(abortSignal.reason));
            if (signalOrTimeout instanceof AbortSignal && signalOrTimeout.aborted) {
                abortController.abort(signalOrTimeout.reason);
            }
        }
        return this.createExeUnit(abortController.signal);
    }
    /**
     * Destroy previously created exe-unit.
     * Please note that if ResourceRental is left without ExeUnit for some time (default 90s)
     * the provider will terminate the Agreement and ResourceRental will be unuseble
     */
    async destroyExeUnit() {
        var _a;
        try {
            if (this.currentExeUnit !== null) {
                await this.activityModule.destroyActivity(this.currentExeUnit.activity);
                this.currentExeUnit = null;
            }
            else {
                throw new GolemUserError(`There is no exe-unit to destroy.`);
            }
        }
        catch (error) {
            this.events.emit("error", error);
            this.logger.error(`Failed to destroy exe-unit. ${error}`, { activityId: (_a = this.currentExeUnit) === null || _a === void 0 ? void 0 : _a.activity });
            throw error;
        }
    }
    async fetchAgreementState() {
        return this.marketModule.fetchAgreement(this.agreement.id).then((agreement) => agreement.getState());
    }
    async createExeUnit(abortSignal) {
        if (!this.exeUnitPromise) {
            this.exeUnitPromise = (async () => {
                var _a, _b, _c;
                const activity = await this.activityModule.createActivity(this.agreement);
                this.currentExeUnit = await this.activityModule.createExeUnit(activity, {
                    storageProvider: this.storageProvider,
                    networkNode: (_a = this.resourceRentalOptions) === null || _a === void 0 ? void 0 : _a.networkNode,
                    executionOptions: (_b = this.resourceRentalOptions) === null || _b === void 0 ? void 0 : _b.activity,
                    signalOrTimeout: abortSignal,
                    ...(_c = this.resourceRentalOptions) === null || _c === void 0 ? void 0 : _c.exeUnit,
                });
                this.events.emit("exeUnitCreated", activity);
                return this.currentExeUnit;
            })()
                .catch((error) => {
                this.events.emit("error", error);
                this.logger.error(`Failed to create exe-unit. ${error}`, { agreementId: this.agreement.id });
                throw error;
            })
                .finally(() => {
                this.exeUnitPromise = undefined;
            });
        }
        return this.exeUnitPromise;
    }
}

const MAX_POOL_SIZE = 100;
/**
 * Pool of resource rentals that can be borrowed, released or destroyed.
 */
class ResourceRentalPool {
    constructor(options) {
        this.events = new EventEmitter();
        /**
         * Pool of resource rentals that do not have an activity
         */
        this.lowPriority = new Set();
        /**
         * Pool of resource rentals that have an activity
         */
        this.highPriority = new Set();
        this.borrowed = new Set();
        /**
         * Queue of functions that are waiting for a lease process to be available
         */
        this.acquireQueue = new AcquireQueue();
        this.asyncLock = new AsyncLock();
        /**
         * Number of resource rentals that are currently being signed.
         * This is used to prevent creating more resource rentals than the pool size allows.
         */
        this.rentalsBeingSigned = 0;
        this.allocation = options.allocation;
        this.proposalPool = options.proposalPool;
        this.marketModule = options.marketModule;
        this.rentalModule = options.rentalModule;
        this.networkModule = options.networkModule;
        this.network = options.network;
        this.resourceRentalOptions = options.resourceRentalOptions;
        this.agreementOptions = options.agreementOptions;
        this.logger = options.logger;
        this.minPoolSize =
            (() => {
                if (typeof (options === null || options === void 0 ? void 0 : options.poolSize) === "number") {
                    return options === null || options === void 0 ? void 0 : options.poolSize;
                }
                if (typeof (options === null || options === void 0 ? void 0 : options.poolSize) === "object") {
                    return options === null || options === void 0 ? void 0 : options.poolSize.min;
                }
            })() || 0;
        this.maxPoolSize =
            (() => {
                if (typeof (options === null || options === void 0 ? void 0 : options.poolSize) === "object") {
                    return options === null || options === void 0 ? void 0 : options.poolSize.max;
                }
            })() || MAX_POOL_SIZE;
        this.abortController = new AbortController();
    }
    async createNewResourceRental(signalOrTimeout) {
        this.logger.debug("Creating new resource rental to add to pool");
        const { signal, cleanup } = anyAbortSignal(this.abortController.signal, createAbortSignalFromTimeout(signalOrTimeout));
        try {
            this.rentalsBeingSigned++;
            const agreement = await this.marketModule.signAgreementFromPool(this.proposalPool, this.agreementOptions, signal);
            const networkNode = this.network
                ? await this.networkModule.createNetworkNode(this.network, agreement.provider.id)
                : undefined;
            const resourceRental = this.rentalModule.createResourceRental(agreement, this.allocation, {
                networkNode,
                ...this.resourceRentalOptions,
            });
            this.events.emit("created", { agreement });
            return resourceRental;
        }
        catch (error) {
            if (signal.aborted) {
                this.logger.debug("Creating resource rental was aborted", error);
                throw error;
            }
            this.events.emit("errorCreatingRental", {
                error: new GolemMarketError("Creating resource rental failed", MarketErrorCode.ResourceRentalCreationFailed, error),
            });
            this.logger.error("Creating resource rental failed", error);
            throw error;
        }
        finally {
            this.rentalsBeingSigned--;
            cleanup();
        }
    }
    async validate(resourceRental) {
        try {
            const state = await resourceRental.fetchAgreementState();
            const result = state === "Approved";
            this.logger.debug("Validated resource rental in the pool", { result, state });
            return result;
        }
        catch (err) {
            this.logger.error("Something went wrong while validating resource rental, it will be destroyed", err);
            return false;
        }
    }
    canCreateMoreResourceRentals() {
        return this.getSize() + this.rentalsBeingSigned < this.maxPoolSize;
    }
    /**
     * Take the first valid resource rental from the pool
     * If there is no valid resource rental, return null
     */
    async takeValidResourceRental() {
        let resourceRental = null;
        if (this.highPriority.size > 0) {
            resourceRental = this.highPriority.values().next().value;
            this.highPriority.delete(resourceRental);
        }
        else if (this.lowPriority.size > 0) {
            resourceRental = this.lowPriority.values().next().value;
            this.lowPriority.delete(resourceRental);
        }
        if (!resourceRental) {
            return null;
        }
        const isValid = await this.validate(resourceRental);
        if (!isValid) {
            await this.destroy(resourceRental);
            return this.takeValidResourceRental();
        }
        return resourceRental;
    }
    async enqueueAcquire(signalOrTimeout) {
        const rental = await this.acquireQueue.get(signalOrTimeout);
        this.borrowed.add(rental);
        this.events.emit("acquired", {
            agreement: rental.agreement,
        });
        return rental;
    }
    /**
     * Sign a new resource rental or wait for one to become available in the pool,
     * whichever comes first.
     */
    async raceNewRentalWithAcquireQueue(signalOrTimeout) {
        const ac = new AbortController();
        const { signal, cleanup } = anyAbortSignal(ac.signal, createAbortSignalFromTimeout(signalOrTimeout), this.abortController.signal);
        return Promise.any([
            this.createNewResourceRental(signal),
            this.acquireQueue.get(signal).then((rental) => {
                this.logger.info("A rental became available in the pool, using it instead of creating a new one");
                return rental;
            }),
        ])
            .catch((err) => {
            // if all promises fail (i.e. the signal is aborted by the user) then
            // rethrow the error produced by `createNewResourceRental` because it's more relevant
            throw err.errors[0];
        })
            .finally(() => {
            ac.abort();
            cleanup();
        });
    }
    /**
     * Borrow a resource rental from the pool.
     * If there is no valid resource rental a new one will be created.
     * @param signalOrTimeout - the timeout in milliseconds or an AbortSignal that will be used to cancel the rental request
     */
    async acquire(signalOrTimeout) {
        if (this.isDraining) {
            throw new GolemAbortError("The pool is in draining mode, you cannot acquire new resources");
        }
        let resourceRental = await this.takeValidResourceRental();
        if (!resourceRental) {
            if (!this.canCreateMoreResourceRentals()) {
                return this.enqueueAcquire(signalOrTimeout);
            }
            resourceRental = await this.raceNewRentalWithAcquireQueue(signalOrTimeout);
        }
        this.borrowed.add(resourceRental);
        this.events.emit("acquired", {
            agreement: resourceRental.agreement,
        });
        return resourceRental;
    }
    /**
     * If there are any acquires waiting in the queue, the resource rental will be passed to the first one.
     * Otherwise, the resource rental will be added to the queue.
     */
    passResourceRentalToWaitingAcquireOrBackToPool(resourceRental) {
        if (this.acquireQueue.hasAcquirers()) {
            this.acquireQueue.put(resourceRental);
            return;
        }
        if (resourceRental.hasActivity()) {
            this.highPriority.add(resourceRental);
        }
        else {
            this.lowPriority.add(resourceRental);
        }
    }
    async release(resourceRental) {
        return this.asyncLock.acquire("resource-rental-pool", async () => {
            if (this.getAvailableSize() >= this.maxPoolSize) {
                return this.destroy(resourceRental);
            }
            this.borrowed.delete(resourceRental);
            const isValid = await this.validate(resourceRental);
            if (!isValid) {
                return this.destroy(resourceRental);
            }
            this.passResourceRentalToWaitingAcquireOrBackToPool(resourceRental);
            this.events.emit("released", {
                agreement: resourceRental.agreement,
            });
        });
    }
    async destroy(resourceRental) {
        try {
            this.borrowed.delete(resourceRental);
            this.logger.debug("Destroying resource rental from the pool", { agreementId: resourceRental.agreement.id });
            await Promise.all([resourceRental.stopAndFinalize(), this.removeNetworkNode(resourceRental)]);
            this.events.emit("destroyed", {
                agreement: resourceRental.agreement,
            });
        }
        catch (error) {
            this.events.emit("errorDestroyingRental", {
                agreement: resourceRental.agreement,
                error: new GolemMarketError("Destroying resource rental failed", MarketErrorCode.ResourceRentalTerminationFailed, error),
            });
            this.logger.error("Destroying resource rental failed", error);
        }
    }
    get isDraining() {
        return !!this.drainPromise;
    }
    async startDrain() {
        try {
            await this.asyncLock.acquire("resource-rental-pool", async () => {
                this.abortController.abort("The pool is in draining mode");
                this.events.emit("draining");
                this.acquireQueue.releaseAll();
                const allResourceRentals = Array.from(this.borrowed)
                    .concat(Array.from(this.lowPriority))
                    .concat(Array.from(this.highPriority));
                await Promise.allSettled(allResourceRentals.map((resourceRental) => this.destroy(resourceRental)));
                this.lowPriority.clear();
                this.highPriority.clear();
                this.borrowed.clear();
                this.abortController = new AbortController();
            });
        }
        catch (error) {
            this.logger.error("Draining the pool failed", error);
            throw error;
        }
        finally {
            this.events.emit("end");
        }
    }
    /**
     * Sets the pool into draining mode and then clears it
     *
     * When set to drain mode, no new acquires will be possible. At the same time, all agreements in the pool will be terminated with the Providers.
     *
     * @return Resolves when all agreements are terminated
     */
    async drainAndClear() {
        if (this.isDraining) {
            return this.drainPromise;
        }
        this.drainPromise = this.startDrain().finally(() => {
            this.drainPromise = undefined;
        });
        return this.drainPromise;
    }
    /**
     * Total size (available + borrowed)
     */
    getSize() {
        return this.getAvailableSize() + this.getBorrowedSize();
    }
    /**
     * Available size (how many resource rental are ready to be borrowed)
     */
    getAvailableSize() {
        return this.lowPriority.size + this.highPriority.size;
    }
    /**
     * Borrowed size (how many resource rental are currently out of the pool)
     */
    getBorrowedSize() {
        return this.borrowed.size;
    }
    async ready(timeoutOrAbortSignal) {
        if (this.minPoolSize <= this.getAvailableSize()) {
            return;
        }
        const { signal, cleanup } = anyAbortSignal(this.abortController.signal, createAbortSignalFromTimeout(timeoutOrAbortSignal));
        const tryCreatingMissingResourceRentals = async () => {
            await Promise.allSettled(new Array(this.minPoolSize - this.getAvailableSize()).fill(0).map(() => this.createNewResourceRental(signal).then((resourceRental) => this.lowPriority.add(resourceRental), (error) => this.logger.error("Creating resource rental failed", error))));
        };
        while (this.minPoolSize > this.getAvailableSize()) {
            if (signal.aborted) {
                break;
            }
            await runOnNextEventLoopIteration(tryCreatingMissingResourceRentals);
        }
        cleanup();
        if (this.minPoolSize > this.getAvailableSize()) {
            throw new Error("Could not create enough resource rentals to reach the minimum pool size in time");
        }
        this.events.emit("ready");
    }
    async removeNetworkNode(resourceRental) {
        if (this.network && resourceRental.networkNode) {
            this.logger.debug("Removing a node from the network", {
                network: this.network.getNetworkInfo().ip,
                nodeIp: resourceRental.networkNode.ip,
            });
            await this.networkModule.removeNetworkNode(this.network, resourceRental.networkNode);
        }
    }
    /**
     * Acquire a resource rental from the pool and release it after the callback is done
     * @example
     * ```typescript
     * const result = await pool.withRental(async (rental) => {
     *  // Do something with the rented resources
     *  return result;
     *  // pool.release(rental) is called automatically
     *  // even if an error is thrown in the callback
     * });
     * ```
     * @param callback - a function that takes a `rental` object as its argument. The rental is automatically released after the callback is executed, regardless of whether it completes successfully or throws an error.
     * @param signalOrTimeout - the timeout in milliseconds or an AbortSignal that will be used to cancel the rental request
     */
    async withRental(callback, signalOrTimeout) {
        const rental = await this.acquire(signalOrTimeout);
        try {
            return await callback(rental);
        }
        finally {
            await this.release(rental);
        }
    }
}

class RentalModuleImpl {
    constructor(deps) {
        this.deps = deps;
        this.events = new EventEmitter();
    }
    createResourceRental(agreement, allocation, options) {
        const paymentProcess = this.deps.paymentModule.createAgreementPaymentProcess(agreement, allocation, options === null || options === void 0 ? void 0 : options.payment);
        const rental = new ResourceRental(agreement, this.deps.storageProvider, paymentProcess, this.deps.marketModule, this.deps.activityModule, this.deps.logger.child("resource-rental"), options);
        this.events.emit("resourceRentalCreated", rental.agreement);
        return rental;
    }
    createResourceRentalPool(draftPool, allocation, options) {
        const pool = new ResourceRentalPool({
            allocation,
            rentalModule: this,
            marketModule: this.deps.marketModule,
            networkModule: this.deps.networkModule,
            proposalPool: draftPool,
            resourceRentalOptions: options === null || options === void 0 ? void 0 : options.resourceRentalOptions,
            logger: this.deps.logger.child("resource-rental-pool"),
            network: options === null || options === void 0 ? void 0 : options.network,
            poolSize: options === null || options === void 0 ? void 0 : options.poolSize,
        });
        this.events.emit("resourceRentalPoolCreated");
        return pool;
    }
}

class PaymentApiAdapter {
    constructor(yagna, invoiceRepo, debitNoteRepo, logger) {
        this.yagna = yagna;
        this.invoiceRepo = invoiceRepo;
        this.debitNoteRepo = debitNoteRepo;
        this.logger = logger;
        this.receivedInvoices$ = new Subject();
        this.receivedDebitNotes$ = new Subject();
    }
    async connect() {
        this.logger.debug("Connecting Payment API Adapter");
        from(this.yagna.invoiceEvents$)
            .pipe(mergeMap((invoice) => {
            if (invoice && invoice.invoiceId) {
                return this.invoiceRepo.getById(invoice.invoiceId);
            }
            else {
                return of();
            }
        }))
            .subscribe({
            next: (event) => this.receivedInvoices$.next(event),
            error: (err) => this.receivedInvoices$.error(err),
            complete: () => this.logger.debug("Finished reading InvoiceEvents"),
        });
        from(this.yagna.debitNoteEvents$)
            .pipe(mergeMap((debitNote) => {
            if (debitNote && debitNote.debitNoteId) {
                return this.debitNoteRepo.getById(debitNote.debitNoteId);
            }
            else {
                return of();
            }
        }))
            .subscribe({
            next: (event) => this.receivedDebitNotes$.next(event),
            error: (err) => this.receivedDebitNotes$.error(err),
            complete: () => this.logger.debug("Finished reading DebitNoteEvents"),
        });
        this.logger.debug("Payment API Adapter connected");
    }
    getInvoice(id) {
        return this.invoiceRepo.getById(id);
    }
    getDebitNote(id) {
        return this.debitNoteRepo.getById(id);
    }
    async acceptInvoice(invoice, allocation, amount) {
        try {
            await this.yagna.payment.acceptInvoice(invoice.id, {
                totalAmountAccepted: amount,
                allocationId: allocation.id,
            });
            return this.invoiceRepo.getById(invoice.id);
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemPaymentError(`Could not accept invoice. ${message}`, PaymentErrorCode.InvoiceAcceptanceFailed, allocation, invoice.provider);
        }
    }
    async rejectInvoice(invoice, reason) {
        try {
            await this.yagna.payment.rejectInvoice(invoice.id, {
                rejectionReason: "BAD_SERVICE",
                totalAmountAccepted: "0.00",
                message: reason,
            });
            return this.invoiceRepo.getById(invoice.id);
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemPaymentError(`Could not reject invoice. ${message}`, PaymentErrorCode.InvoiceRejectionFailed, undefined, invoice.provider);
        }
    }
    async acceptDebitNote(debitNote, allocation, amount) {
        try {
            await this.yagna.payment.acceptDebitNote(debitNote.id, {
                totalAmountAccepted: amount,
                allocationId: allocation.id,
            });
            return this.debitNoteRepo.getById(debitNote.id);
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemPaymentError(`Could not accept debit note. ${message}`, PaymentErrorCode.DebitNoteAcceptanceFailed, allocation, debitNote.provider);
        }
    }
    async rejectDebitNote(debitNote) {
        try {
            // TODO: this endpoint is not implemented in Yagna, it always responds 501:NotImplemented.
            // Reported in https://github.com/golemfactory/yagna/issues/1249
            // await this.yagna.payment.rejectDebitNote(debitNote.id, {
            //   rejectionReason: "BAD_SERVICE",
            //   totalAmountAccepted: "0.00",
            //   message: reason,
            // });
            return this.debitNoteRepo.getById(debitNote.id);
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemPaymentError(`Could not reject debit note. ${message}`, PaymentErrorCode.DebitNoteRejectionFailed, undefined, debitNote.provider, error);
        }
    }
    async getAllocation(id) {
        try {
            const model = await this.yagna.payment.getAllocation(id);
            return new Allocation(model);
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemPaymentError(`Could not retrieve allocation. ${message}`, PaymentErrorCode.AllocationCreationFailed, undefined, undefined, error);
        }
    }
    async createAllocation(params) {
        try {
            const { identity: address } = await this.yagna.identity.getIdentity();
            const now = new Date();
            const model = await this.yagna.payment.createAllocation({
                totalAmount: params.budget.toString(),
                paymentPlatform: params.paymentPlatform,
                address,
                timestamp: now.toISOString(),
                timeout: new Date(+now + params.expirationSec * 1000).toISOString(),
                makeDeposit: false,
                remainingAmount: "",
                spentAmount: "",
                allocationId: "",
                deposit: params.deposit,
            });
            this.logger.debug(`Allocation ${model.allocationId} has been created for address ${address} using payment platform ${params.paymentPlatform}`);
            const allocation = new Allocation(model);
            return allocation;
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemPaymentError(`Could not create new allocation. ${message}`, PaymentErrorCode.AllocationCreationFailed, undefined, undefined, error);
        }
    }
    async releaseAllocation(allocation) {
        var _a, _b;
        try {
            return this.yagna.payment.releaseAllocation(allocation.id);
        }
        catch (error) {
            throw new GolemPaymentError(`Could not release allocation. ${((_b = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || error}`, PaymentErrorCode.AllocationReleaseFailed, allocation, undefined, error);
        }
    }
}

class MarketApiAdapter {
    constructor(yagnaApi, agreementRepo, proposalRepo, demandRepo, logger) {
        this.yagnaApi = yagnaApi;
        this.agreementRepo = agreementRepo;
        this.proposalRepo = proposalRepo;
        this.demandRepo = demandRepo;
        this.logger = logger;
    }
    async publishDemandSpecification(spec) {
        const idOrError = await this.yagnaApi.market.subscribeDemand(this.buildDemandRequestBody(spec.prototype));
        if (typeof idOrError !== "string") {
            throw new Error(`Failed to subscribe to demand: ${idOrError.message}`);
        }
        const demand = new Demand(idOrError, spec);
        this.demandRepo.add(demand);
        return demand;
    }
    async unpublishDemand(demand) {
        const result = await this.yagnaApi.market.unsubscribeDemand(demand.id);
        if (result === null || result === void 0 ? void 0 : result.message) {
            throw new Error(`Failed to unsubscribe from demand: ${result.message}`);
        }
    }
    collectMarketProposalEvents(demand) {
        return new Observable((observer) => {
            let isCancelled = false;
            const longPoll = async () => {
                if (isCancelled) {
                    return;
                }
                try {
                    for (const event of await this.yagnaApi.market.collectOffers(demand.id)) {
                        const timestamp = new Date(Date.parse(event.eventDate));
                        switch (event.eventType) {
                            case "ProposalEvent":
                                {
                                    try {
                                        // @ts-expect-error FIXME #ya-ts-client, #ya-client: Fix mappings and type discriminators
                                        const offerProposal = new OfferProposal(event.proposal, demand);
                                        this.proposalRepo.add(offerProposal);
                                        observer.next({
                                            type: "ProposalReceived",
                                            proposal: offerProposal,
                                            timestamp,
                                        });
                                    }
                                    catch (err) {
                                        observer.error(err);
                                        this.logger.error("Failed to create offer proposal from the event", { err, event, demand });
                                    }
                                }
                                break;
                            case "ProposalRejectedEvent": {
                                // @ts-expect-error FIXME #ya-ts-client, #ya-client: Fix mappings and type discriminators
                                const { proposalId, reason } = event;
                                const marketProposal = this.proposalRepo.getById(proposalId);
                                if (marketProposal && this.isOfferCounterProposal(marketProposal)) {
                                    observer.next({
                                        type: "ProposalRejected",
                                        counterProposal: marketProposal,
                                        reason: reason.message,
                                        timestamp,
                                    });
                                }
                                else {
                                    this.logger.error("Could not locate counter proposal with ID issued by the Requestor while handling ProposalRejectedEvent", {
                                        event,
                                    });
                                }
                                break;
                            }
                            case "PropertyQueryEvent":
                                observer.next({
                                    type: "PropertyQueryReceived",
                                    timestamp,
                                });
                                break;
                            default:
                                this.logger.warn("Unsupported demand subscription event", { event });
                        }
                    }
                }
                catch (error) {
                    // when the demand is unsubscribed the long poll will reject with a 404
                    if ("status" in error && error.status === 404) {
                        return;
                    }
                    this.logger.error("Polling yagna for offer proposal events failed", error);
                    observer.error(error);
                }
                void longPoll();
            };
            void longPoll();
            return () => {
                isCancelled = true;
            };
        });
    }
    async counterProposal(receivedProposal, demand) {
        const bodyClone = structuredClone(this.buildDemandRequestBody(demand.prototype));
        bodyClone.properties["golem.com.payment.chosen-platform"] = demand.paymentPlatform;
        const maybeNewId = await this.yagnaApi.market.counterProposalDemand(receivedProposal.demand.id, receivedProposal.id, bodyClone);
        this.logger.debug("Proposal counter result from yagna", { result: maybeNewId });
        if (typeof maybeNewId !== "string") {
            throw new GolemInternalError(`Counter proposal failed ${maybeNewId.message}`);
        }
        const dto = await this.yagnaApi.market.getProposalOffer(receivedProposal.demand.id, maybeNewId);
        const counterProposal = new OfferCounterProposal(dto);
        this.proposalRepo.add(counterProposal);
        return counterProposal;
    }
    async rejectProposal(receivedProposal, reason) {
        try {
            const result = await this.yagnaApi.market.rejectProposalOffer(receivedProposal.demand.id, receivedProposal.id, {
                message: reason,
            });
            this.logger.debug("Proposal rejection result from yagna", { response: result });
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemMarketError(`Failed to reject proposal. ${message}`, MarketErrorCode.ProposalRejectionFailed, error);
        }
    }
    buildDemandRequestBody(decorations) {
        var _a, _b;
        let constraints;
        if (!((_a = decorations.constraints) === null || _a === void 0 ? void 0 : _a.length))
            constraints = "(&)";
        else if (decorations.constraints.length == 1)
            constraints = decorations.constraints[0];
        else
            constraints = `(&${decorations.constraints.join("\n\t")})`;
        const properties = {};
        (_b = decorations.properties) === null || _b === void 0 ? void 0 : _b.forEach((prop) => (properties[prop.key] = prop.value));
        return { constraints, properties };
    }
    async getPaymentRelatedDemandDecorations(allocationId) {
        return this.yagnaApi.payment.getDemandDecorations([allocationId]);
    }
    async confirmAgreement(agreement, options) {
        try {
            // FIXME #yagna, If we don't provide the app-session ID when confirming the agreement, we won't be able to collect invoices with that app-session-id
            //   it's hard to know when the appSessionId is mandatory and when it isn't
            this.logger.debug("Confirming agreement by Requestor", { agreementId: agreement.id });
            await this.yagnaApi.market.confirmAgreement(agreement.id, this.yagnaApi.appSessionId);
            this.logger.debug("Waiting for agreement approval by Provider", { agreementId: agreement.id });
            await this.yagnaApi.market.waitForApproval(agreement.id, (options === null || options === void 0 ? void 0 : options.waitingForApprovalTimeoutSec) || 60);
            this.logger.debug(`Agreement approved by Provider`, { agreementId: agreement.id });
            // Get fresh copy
            return this.agreementRepo.getById(agreement.id);
        }
        catch (error) {
            throw new GolemMarketError(`Unable to confirm agreement with provider`, MarketErrorCode.AgreementApprovalFailed, error);
        }
    }
    async createAgreement(proposal, options) {
        const expirationSec = (options === null || options === void 0 ? void 0 : options.expirationSec) || 3600;
        try {
            const agreementProposalRequest = {
                proposalId: proposal.id,
                validTo: new Date(+new Date() + expirationSec * 1000).toISOString(),
            };
            const agreementId = await withTimeout(this.yagnaApi.market.createAgreement(agreementProposalRequest), 30000);
            if (typeof agreementId !== "string") {
                throw new GolemMarketError(`Unable to create agreement. Invalid response from the server`, MarketErrorCode.ResourceRentalCreationFailed);
            }
            const agreement = await this.agreementRepo.getById(agreementId);
            this.logger.debug(`Agreement created`, {
                agreement,
                proposalId: proposal.id,
                demandId: proposal.demand.id,
            });
            return agreement;
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemMarketError(`Unable to create agreement ${message}`, MarketErrorCode.ResourceRentalCreationFailed, error);
        }
    }
    async proposeAgreement(proposal, options) {
        const agreement = await this.createAgreement(proposal, options);
        const confirmed = await this.confirmAgreement(agreement);
        const state = confirmed.getState();
        if (state !== "Approved") {
            throw new GolemMarketError(`Agreement ${agreement.id} cannot be approved. Current state: ${state}`, MarketErrorCode.AgreementApprovalFailed);
        }
        this.logger.debug("Established agreement", agreement);
        return confirmed;
    }
    getAgreement(id) {
        return this.agreementRepo.getById(id);
    }
    async getAgreementState(id) {
        const entry = await this.agreementRepo.getById(id);
        return entry.getState();
    }
    async terminateAgreement(agreement, reason = "Finished") {
        try {
            // Re-fetch entity before acting to be sure that we don't terminate a terminated activity
            const current = await this.agreementRepo.getById(agreement.id);
            if (current.getState() === "Terminated") {
                throw new GolemUserError("You can not terminate an agreement that's already terminated");
            }
            await withTimeout(this.yagnaApi.market.terminateAgreement(current.id, {
                message: reason,
            }), 30000);
            this.logger.debug(`Agreement terminated`, { id: agreement.id, reason });
            return this.agreementRepo.getById(agreement.id);
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemMarketError(`Unable to terminate agreement ${agreement.id}. ${message}`, MarketErrorCode.ResourceRentalTerminationFailed, error);
        }
    }
    collectAgreementEvents() {
        return this.yagnaApi.agreementEvents$.pipe(switchMap((event) => new Observable((observer) => {
            try {
                this.logger.debug("Market API Adapter received agreement event", { event });
                const timestamp = new Date(Date.parse(event.eventDate));
                // @ts-expect-error FIXME #yagna, wasn't this fixed? {@issue https://github.com/golemfactory/yagna/pull/3136}
                const eventType = event.eventType || event.eventtype;
                this.getAgreement(event.agreementId)
                    .then((agreement) => {
                    switch (eventType) {
                        case "AgreementApprovedEvent":
                            observer.next({
                                type: "AgreementApproved",
                                agreement,
                                timestamp,
                            });
                            break;
                        case "AgreementTerminatedEvent":
                            observer.next({
                                type: "AgreementTerminated",
                                agreement,
                                // @ts-expect-error FIXME #ya-ts-client event type discrimination doesn't work nicely with the current generator
                                terminatedBy: event.terminator,
                                // @ts-expect-error FIXME #ya-ts-client event type discrimination doesn't work nicely with the current generator
                                reason: event.reason.message,
                                timestamp,
                            });
                            break;
                        case "AgreementRejectedEvent":
                            observer.next({
                                type: "AgreementRejected",
                                agreement,
                                // @ts-expect-error FIXME #ya-ts-client event type discrimination doesn't work nicely with the current generator
                                reason: event.reason.message,
                                timestamp,
                            });
                            break;
                        case "AgreementCancelledEvent":
                            observer.next({
                                type: "AgreementCancelled",
                                agreement,
                                timestamp,
                            });
                            break;
                        default:
                            this.logger.warn("Unsupported agreement event type for event", { event });
                            break;
                    }
                })
                    .catch((err) => this.logger.error("Failed to load agreement", { agreementId: event.agreementId, err }));
            }
            catch (err) {
                const golemMarketError = new GolemMarketError("Error while processing agreement event from yagna", MarketErrorCode.InternalError, err);
                this.logger.error(golemMarketError.message, { event, err });
                observer.error(err);
            }
        })));
    }
    isOfferCounterProposal(proposal) {
        return proposal.issuer === "Requestor";
    }
    scan(spec) {
        const ac = new AbortController();
        return new Observable((observer) => {
            this.yagnaApi.market
                .beginScan({
                type: "offer",
                ...this.buildDemandRequestBody(spec),
            })
                .then((iterator) => {
                if (typeof iterator !== "string") {
                    throw new Error(`Something went wrong while starting the scan, ${iterator.message}`);
                }
                return iterator;
            })
                .then(async (iterator) => {
                const cleanupIterator = () => this.yagnaApi.market.endScan(iterator);
                if (ac.signal.aborted) {
                    await cleanupIterator();
                    return;
                }
                const eventSource = new EventSource(`${this.yagnaApi.market.httpRequest.config.BASE}/scan/${iterator}/events`, {
                    headers: {
                        Accept: "text/event-stream",
                        Authorization: `Bearer ${this.yagnaApi.yagnaOptions.apiKey}`,
                    },
                });
                eventSource.addEventListener("offer", (event) => {
                    try {
                        const parsed = JSON.parse(event.data);
                        observer.next(new ScannedOffer(parsed));
                    }
                    catch (error) {
                        observer.error(error);
                    }
                });
                eventSource.addEventListener("error", (error) => observer.error(error));
                ac.signal.onabort = async () => {
                    eventSource.close();
                    await cleanupIterator();
                };
            })
                .catch((error) => {
                const message = getMessageFromApiError(error);
                observer.error(new GolemMarketError(`Error while scanning for offers. ${message}`, MarketErrorCode.ScanFailed, error));
            });
            return () => {
                ac.abort();
            };
        });
    }
}

class InvoiceRepository {
    constructor(paymentClient, marketClient) {
        this.paymentClient = paymentClient;
        this.marketClient = marketClient;
    }
    async getById(id) {
        let model;
        let agreement;
        try {
            model = await this.paymentClient.getInvoice(id);
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemPaymentError(`Failed to get debit note: ${message}`, PaymentErrorCode.CouldNotGetInvoice, undefined, undefined, error);
        }
        try {
            agreement = await this.marketClient.getAgreement(model.agreementId);
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemMarketError(`Failed to get agreement for invoice: ${message}`, MarketErrorCode.CouldNotGetAgreement, error);
        }
        const providerInfo = {
            id: model.issuerId,
            walletAddress: model.payeeAddr,
            name: agreement.offer.properties["golem.node.id.name"],
        };
        return new Invoice(model, providerInfo);
    }
}

class DebitNoteRepository {
    constructor(paymentClient, marketClient) {
        this.paymentClient = paymentClient;
        this.marketClient = marketClient;
    }
    async getById(id) {
        let model;
        let agreement;
        try {
            model = await this.paymentClient.getDebitNote(id);
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemPaymentError(`Failed to get debit note: ${message}`, PaymentErrorCode.CouldNotGetDebitNote, undefined, undefined, error);
        }
        try {
            agreement = await this.marketClient.getAgreement(model.agreementId);
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemMarketError(`Failed to get agreement for debit note: ${message}`, MarketErrorCode.CouldNotGetAgreement, error);
        }
        const providerInfo = {
            id: model.issuerId,
            walletAddress: model.payeeAddr,
            name: agreement.offer.properties["golem.node.id.name"],
        };
        return new DebitNote(model, providerInfo);
    }
}

class ActivityApiAdapter {
    constructor(state, control, exec, activityRepo) {
        this.state = state;
        this.control = control;
        this.exec = exec;
        this.activityRepo = activityRepo;
    }
    getActivity(id) {
        return this.activityRepo.getById(id);
    }
    async createActivity(agreement) {
        try {
            const activityOrError = await this.control.createActivity({
                agreementId: agreement.id,
            });
            if (typeof activityOrError !== "object" || !("activityId" in activityOrError)) {
                // will be caught in the catch block and converted to GolemWorkError
                throw new Error(activityOrError);
            }
            return this.activityRepo.getById(activityOrError.activityId);
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemWorkError(`Failed to create activity: ${message}`, WorkErrorCode.ActivityCreationFailed, agreement, undefined, agreement.provider);
        }
    }
    async destroyActivity(activity) {
        try {
            await this.control.destroyActivity(activity.id, 30);
            return this.activityRepo.getById(activity.id);
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemWorkError(`Failed to destroy activity: ${message}`, WorkErrorCode.ActivityDestroyingFailed, activity.agreement, activity, activity.agreement.provider);
        }
    }
    async getActivityState(id) {
        return this.activityRepo.getStateOfActivity(id);
    }
    async executeScript(activity, script) {
        try {
            return await this.control.exec(activity.id, script);
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemWorkError(`Failed to execute script. ${message}`, WorkErrorCode.ScriptExecutionFailed, activity.agreement, activity, activity.agreement.provider);
        }
    }
    async getExecBatchResults(activity, batchId, commandIndex, timeout) {
        try {
            const results = await this.control.getExecBatchResults(activity.id, batchId, commandIndex, timeout);
            return results.map((r) => new Result(r));
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemWorkError(`Failed to fetch activity results. ${message}`, WorkErrorCode.ActivityResultsFetchingFailed, activity.agreement, activity, activity.provider, error);
        }
    }
    getExecBatchEvents(activity, batchId) {
        return this.exec.observeBatchExecResults(activity.id, batchId);
    }
}

class CacheService {
    constructor() {
        this.storage = new Map();
    }
    set(key, value) {
        this.storage.set(key, value);
        return value;
    }
    get(key) {
        return this.storage.get(key);
    }
    delete(key) {
        return this.storage.delete(key);
    }
    has(key) {
        return this.storage.has(key);
    }
    getAll() {
        return [...this.storage.values()];
    }
    flushAll() {
        return this.storage.clear();
    }
}

class ActivityRepository {
    constructor(state, agreementRepo) {
        this.state = state;
        this.agreementRepo = agreementRepo;
        this.stateCache = new CacheService();
    }
    async getById(id) {
        var _a;
        try {
            const agreementId = await this.state.getActivityAgreement(id);
            const agreement = await this.agreementRepo.getById(agreementId);
            const previousState = (_a = this.stateCache.get(id)) !== null && _a !== void 0 ? _a : ActivityStateEnum.New;
            const state = await this.getStateOfActivity(id);
            const usage = await this.state.getActivityUsage(id);
            return new Activity(id, agreement, state !== null && state !== void 0 ? state : ActivityStateEnum.Unknown, previousState, usage);
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemWorkError(`Failed to get activity: ${message}`, WorkErrorCode.ActivityStatusQueryFailed, undefined, undefined, undefined, error);
        }
    }
    async getStateOfActivity(id) {
        try {
            const yagnaStateResponse = await this.state.getActivityState(id);
            if (!yagnaStateResponse || yagnaStateResponse.state[0] === null) {
                return ActivityStateEnum.Unknown;
            }
            const state = ActivityStateEnum[yagnaStateResponse.state[0]];
            this.stateCache.set(id, state);
            return state;
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemWorkError(`Failed to get activity state: ${message}`, WorkErrorCode.ActivityStatusQueryFailed, undefined, undefined, undefined, error);
        }
    }
}

class AgreementRepository {
    constructor(api, demandRepo) {
        this.api = api;
        this.demandRepo = demandRepo;
    }
    async getById(id) {
        let dto;
        try {
            dto = await this.api.getAgreement(id);
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemMarketError(`Failed to get agreement: ${message}`, MarketErrorCode.CouldNotGetAgreement, error);
        }
        const { demandId } = dto.demand;
        const demand = this.demandRepo.getById(demandId);
        if (!demand) {
            throw new GolemInternalError(`Could not find information for demand ${demandId} of agreement ${id}`);
        }
        const agreement = new Agreement(id, dto, demand);
        return agreement;
    }
}

class ProposalRepository {
    constructor(marketService, identityService, cache) {
        this.marketService = marketService;
        this.identityService = identityService;
        this.cache = cache;
    }
    add(proposal) {
        this.cache.set(proposal.id, proposal);
        return proposal;
    }
    getById(id) {
        return this.cache.get(id);
    }
    async getByDemandAndId(demand, id) {
        try {
            const dto = await this.marketService.getProposalOffer(demand.id, id);
            const identity = await this.identityService.getIdentity();
            const isIssuedByRequestor = identity.identity === dto.issuerId ? "Requestor" : "Provider";
            return isIssuedByRequestor ? new OfferCounterProposal(dto) : new OfferProposal(dto, demand);
        }
        catch (error) {
            const message = error.message;
            throw new GolemMarketError(`Failed to get proposal: ${message}`, MarketErrorCode.CouldNotGetProposal, error);
        }
    }
}

class DemandRepository {
    constructor(api, cache) {
        this.api = api;
        this.cache = cache;
    }
    getById(id) {
        return this.cache.get(id);
    }
    add(demand) {
        this.cache.set(demand.id, demand);
        return demand;
    }
    getAll() {
        return this.cache.getAll();
    }
}

/**
 * IFileServer implementation that uses any StorageProvider to serve files.
 * Make sure that the storage provider implements the `.publishFile()` method.
 */
class StorageServerAdapter {
    constructor(storage) {
        this.storage = storage;
        this.published = new Map();
    }
    async publishFile(sourcePath) {
        if (!this.storage.isReady()) {
            throw new GolemInternalError("The GFTP server as to be initialized before publishing a file ");
        }
        if (!fs__default.existsSync(sourcePath) || fs__default.lstatSync(sourcePath).isDirectory()) {
            throw new GolemConfigError(`File ${sourcePath} does not exist o is a directory`);
        }
        const fileUrl = await this.storage.publishFile(sourcePath);
        const fileHash = await this.calculateFileHash(sourcePath);
        const entry = {
            fileUrl,
            fileHash,
        };
        this.published.set(sourcePath, entry);
        return entry;
    }
    isServing() {
        return this.published.size !== 0;
    }
    getPublishInfo(sourcePath) {
        return this.published.get(sourcePath);
    }
    isFilePublished(sourcePath) {
        return this.published.has(sourcePath);
    }
    async calculateFileHash(localPath) {
        const fileStream = fs__default.createReadStream(localPath);
        const hash = jsSha3__default.sha3_224.create();
        return new Promise((resolve, reject) => {
            fileStream.on("data", (chunk) => hash.update(chunk));
            fileStream.on("end", () => resolve(hash.hex()));
            fileStream.on("error", (err) => reject(new GolemInternalError(`Error calculating file hash: ${err}`, err)));
        });
    }
}

class NetworkApiAdapter {
    constructor(yagnaApi) {
        this.yagnaApi = yagnaApi;
    }
    async createNetwork(options) {
        try {
            const { id, ip, mask, gateway } = await this.yagnaApi.net.createNetwork(options);
            return new Network(id, ip, mask, gateway);
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemNetworkError(`Unable to create network. ${message}`, NetworkErrorCode.NetworkCreationFailed, undefined, error);
        }
    }
    async removeNetwork(network) {
        try {
            await this.yagnaApi.net.removeNetwork(network.id);
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemNetworkError(`Unable to remove network. ${message}`, NetworkErrorCode.NetworkRemovalFailed, network.getNetworkInfo(), error);
        }
    }
    async createNetworkNode(network, nodeId, nodeIp) {
        try {
            await this.yagnaApi.net.addNode(network.id, { id: nodeId, ip: nodeIp });
            const networkNode = new NetworkNode(nodeId, nodeIp, network.getNetworkInfo.bind(network), this.yagnaApi.net.httpRequest.config.BASE);
            return networkNode;
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemNetworkError(`Unable to add node to network. ${message}`, NetworkErrorCode.NodeAddingFailed, network.getNetworkInfo(), error);
        }
    }
    async removeNetworkNode(network, node) {
        try {
            await this.yagnaApi.net.removeNode(network.id, node.id);
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemNetworkError(`Unable to remove network node. ${message}`, NetworkErrorCode.NodeRemovalFailed, network.getNetworkInfo(), error);
        }
    }
    async getIdentity() {
        try {
            return await this.yagnaApi.identity.getIdentity().then((res) => res.identity);
        }
        catch (error) {
            const message = getMessageFromApiError(error);
            throw new GolemNetworkError(`Unable to get requestor identity. ${message}`, NetworkErrorCode.GettingIdentityFailed, undefined, error);
        }
    }
}

/**
 * If no override is provided, return a function that creates a new instance of the default factory.
 * If override is a factory, return a function that creates a new instance of that factory.
 * If override is an instance, return a function that returns that instance (ignoring the arguments).
 */
function getFactory(defaultFactory, override) {
    if (override) {
        if (typeof override === "function") {
            return (...args) => new override(...args);
        }
        return () => override;
    }
    return (...args) => new defaultFactory(...args);
}
/**
 * General purpose and high-level API for the Golem Network
 *
 * This class is the main entry-point for developers that would like to build on Golem Network
 * using `@golem-sdk/golem-js`. It is supposed to provide an easy access API for use 80% of use cases.
 */
class GolemNetwork {
    constructor(options = {}) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        this.events = new EventEmitter();
        this.hasConnection = false;
        this.abortController = new AbortController();
        /**
         * List af additional tasks that should be executed when the network is being shut down
         * (for example finalizing resource rental created with `oneOf`)
         */
        this.cleanupTasks = [];
        this.registeredPlugins = [];
        const optDefaults = {
            dataTransferProtocol: "ws",
        };
        this.options = {
            ...optDefaults,
            ...options,
        };
        this.logger = (_a = options.logger) !== null && _a !== void 0 ? _a : defaultLogger("golem-network");
        this.logger.debug("Creating Golem Network instance with options", { options: this.options });
        try {
            this.yagna =
                ((_b = options.override) === null || _b === void 0 ? void 0 : _b.yagna) ||
                    new YagnaApi({
                        logger: this.logger,
                        apiKey: (_c = this.options.api) === null || _c === void 0 ? void 0 : _c.key,
                        basePath: (_d = this.options.api) === null || _d === void 0 ? void 0 : _d.url,
                    });
            this.storageProvider = ((_e = options.override) === null || _e === void 0 ? void 0 : _e.storageProvider) || this.createStorageProvider();
            const demandCache = new CacheService();
            const proposalCache = new CacheService();
            const demandRepository = new DemandRepository(this.yagna.market, demandCache);
            const proposalRepository = new ProposalRepository(this.yagna.market, this.yagna.identity, proposalCache);
            const agreementRepository = new AgreementRepository(this.yagna.market, demandRepository);
            this.services = {
                logger: this.logger,
                yagna: this.yagna,
                storageProvider: this.storageProvider,
                demandRepository,
                proposalCache,
                proposalRepository,
                paymentApi: ((_f = this.options.override) === null || _f === void 0 ? void 0 : _f.paymentApi) ||
                    new PaymentApiAdapter(this.yagna, new InvoiceRepository(this.yagna.payment, this.yagna.market), new DebitNoteRepository(this.yagna.payment, this.yagna.market), this.logger),
                activityApi: ((_g = this.options.override) === null || _g === void 0 ? void 0 : _g.activityApi) ||
                    new ActivityApiAdapter(this.yagna.activity.state, this.yagna.activity.control, this.yagna.activity.exec, new ActivityRepository(this.yagna.activity.state, agreementRepository)),
                marketApi: ((_h = this.options.override) === null || _h === void 0 ? void 0 : _h.marketApi) ||
                    new MarketApiAdapter(this.yagna, agreementRepository, proposalRepository, demandRepository, this.logger),
                networkApi: ((_j = this.options.override) === null || _j === void 0 ? void 0 : _j.networkApi) || new NetworkApiAdapter(this.yagna),
                fileServer: ((_k = this.options.override) === null || _k === void 0 ? void 0 : _k.fileServer) || new StorageServerAdapter(this.storageProvider),
            };
            this.network = getFactory(NetworkModuleImpl, (_l = this.options.override) === null || _l === void 0 ? void 0 : _l.network)(this.services);
            this.market = getFactory(MarketModuleImpl, (_m = this.options.override) === null || _m === void 0 ? void 0 : _m.market)({
                ...this.services,
                networkModule: this.network,
            }, this.options.market);
            this.payment = getFactory(PaymentModuleImpl, (_o = this.options.override) === null || _o === void 0 ? void 0 : _o.payment)(this.services, this.options.payment);
            this.activity = getFactory(ActivityModuleImpl, (_p = this.options.override) === null || _p === void 0 ? void 0 : _p.activity)(this.services);
            this.rental = getFactory(RentalModuleImpl, (_q = this.options.override) === null || _q === void 0 ? void 0 : _q.rental)({
                activityModule: this.activity,
                paymentModule: this.payment,
                marketModule: this.market,
                networkModule: this.network,
                logger: this.logger,
                storageProvider: this.storageProvider,
            });
        }
        catch (err) {
            this.events.emit("error", err);
            throw err;
        }
    }
    /**
     * "Connects" to the network by initializing the underlying components required to perform operations on Golem Network
     *
     * @return Resolves when all initialization steps are completed
     */
    async connect() {
        try {
            await this.yagna.connect();
            await this.services.paymentApi.connect();
            await this.storageProvider.init();
            await this.connectPlugins();
            this.events.emit("connected");
            this.hasConnection = true;
        }
        catch (err) {
            this.events.emit("error", err);
            throw err;
        }
    }
    async startDisconnect() {
        try {
            this.abortController.abort("Golem Network is disconnecting");
            await Promise.allSettled(this.cleanupTasks.map((task) => task()));
            this.cleanupTasks = [];
            await this.storageProvider
                .close()
                .catch((err) => this.logger.warn("Closing storage provider resulted with an error, it will be ignored", err));
            await this.yagna
                .disconnect()
                .catch((err) => this.logger.warn("Closing connections with yagna resulted with an error, it will be ignored", err));
            this.services.proposalCache.flushAll();
            this.abortController = new AbortController();
        }
        catch (err) {
            this.logger.error("Error while disconnecting", err);
            throw err;
        }
        finally {
            this.events.emit("disconnected");
            this.hasConnection = false;
        }
    }
    /**
     * "Disconnects" from the Golem Network
     *
     * @return Resolves when all shutdown steps are completed
     */
    async disconnect() {
        if (this.disconnectPromise) {
            return this.disconnectPromise;
        }
        this.disconnectPromise = this.startDisconnect().finally(() => {
            this.disconnectPromise = undefined;
        });
        return this.disconnectPromise;
    }
    async getAllocationFromOrder({ order, maxAgreements, }) {
        var _a;
        if (!((_a = order.payment) === null || _a === void 0 ? void 0 : _a.allocation)) {
            const budget = this.market.estimateBudget({ order, maxAgreements });
            /**
             * We need to create allocations that will exist longer than the agreements made.
             *
             * Without this in the event of agreement termination due to its expiry,
             * the invoice for the agreement arrives, and we try to accept the invoice with
             * an allocation that already expired (had the same expiration time as the agreement),
             * which leads to unpaid invoices.
             */
            const EXPIRATION_BUFFER_MINUTES = 15;
            return this.payment.createAllocation({
                budget,
                expirationSec: order.market.rentHours * (60 + EXPIRATION_BUFFER_MINUTES) * 60,
            });
        }
        if (typeof order.payment.allocation === "string") {
            return this.payment.getAllocation(order.payment.allocation);
        }
        return order.payment.allocation;
    }
    /**
     * Define your computational resource demand and access a single instance
     *
     * Use Case: Get a single instance of a resource from the market to execute operations on
     *
     * @example
     * ```ts
     * const rental = await glm.oneOf({ order });
     * await rental
     *  .getExeUnit()
     *  .then((exe) => exe.run("echo Hello, Golem! 👋"))
     *  .then((res) => console.log(res.stdout));
     * await rental.stopAndFinalize();
     * ```
     *
     * @param {Object} options
     * @param options.order - represents the order specifications which will result in access to ResourceRental.
     * @param options.signalOrTimeout - timeout in milliseconds or an AbortSignal that will be used to cancel the rental request
     * @param options.setup - an optional function that is called as soon as the exe unit is ready
     * @param options.teardown - an optional function that is called before the exe unit is destroyed
     */
    async oneOf({ order, setup, teardown, signalOrTimeout, volumes }) {
        this.validateSettings({
            order,
            volumes,
        });
        const { signal, cleanup: cleanupAbortSignals } = anyAbortSignal(createAbortSignalFromTimeout(signalOrTimeout), this.abortController.signal);
        let allocation = undefined;
        let proposalSubscription = undefined;
        let rental = undefined;
        let networkNode = undefined;
        const cleanup = async () => {
            var _a;
            cleanupAbortSignals();
            if (proposalSubscription) {
                proposalSubscription.unsubscribe();
            }
            // First finalize the rental (which will wait for all payments to be processed)
            // and only then release the allocation
            if (rental) {
                await rental.stopAndFinalize().catch((err) => this.logger.error("Error while finalizing rental", err));
            }
            if (order.network && networkNode) {
                await this.network
                    .removeNetworkNode(order.network, networkNode)
                    .catch((err) => this.logger.error("Error while removing network node", err));
            }
            // Don't release the allocation if it was provided by the user
            if (((_a = order.payment) === null || _a === void 0 ? void 0 : _a.allocation) || !allocation) {
                return;
            }
            await this.payment
                .releaseAllocation(allocation)
                .catch((err) => this.logger.error("Error while releasing allocation", err));
        };
        try {
            const proposalPool = new DraftOfferProposalPool({
                logger: this.logger,
                validateOfferProposal: order.market.offerProposalFilter,
                selectOfferProposal: order.market.offerProposalSelector,
            });
            allocation = await this.getAllocationFromOrder({ order, maxAgreements: 1 });
            signal.throwIfAborted();
            const demandSpecification = await this.market.buildDemandDetails(order.demand, order.market, allocation);
            const draftProposal$ = this.market.collectDraftOfferProposals({
                demandSpecification,
                pricing: order.market.pricing,
                filter: order.market.offerProposalFilter,
            });
            proposalSubscription = proposalPool.readFrom(draftProposal$);
            const agreement = await this.market.signAgreementFromPool(proposalPool, {
                expirationSec: order.market.rentHours * 60 * 60,
            }, signal);
            networkNode = order.network
                ? await this.network.createNetworkNode(order.network, agreement.provider.id)
                : undefined;
            rental = this.rental.createResourceRental(agreement, allocation, {
                payment: order.payment,
                activity: order.activity,
                networkNode,
                exeUnit: { setup, teardown, volumes },
            });
            // We managed to create the activity, no need to look for more agreement candidates
            proposalSubscription.unsubscribe();
            this.cleanupTasks.push(cleanup);
            return rental;
        }
        catch (err) {
            this.logger.error("Error while creating rental", err);
            // if the execution was interrupted before we got the chance to add the cleanup task
            // we need to call it manually
            await cleanup();
            throw err;
        }
    }
    /**
     * Define your computational resource demand and access a pool of instances.
     * The pool will grow up to the specified poolSize.
     *
     * @example
     * ```ts
     * // create a pool that can grow up to 3 rentals at the same time
     * const pool = await glm.manyOf({
     *   poolSize: 3,
     *   demand
     * });
     * await Promise.allSettled([
     *   pool.withRental(async (rental) =>
     *     rental
     *       .getExeUnit()
     *       .then((exe) => exe.run("echo Hello, Golem from the first machine! 👋"))
     *       .then((res) => console.log(res.stdout)),
     *   ),
     *   pool.withRental(async (rental) =>
     *     rental
     *       .getExeUnit()
     *       .then((exe) => exe.run("echo Hello, Golem from the second machine! 👋"))
     *       .then((res) => console.log(res.stdout)),
     *   ),
     *   pool.withRental(async (rental) =>
     *     rental
     *       .getExeUnit()
     *       .then((exe) => exe.run("echo Hello, Golem from the third machine! 👋"))
     *       .then((res) => console.log(res.stdout)),
     *   ),
     * ]);
     * ```
     *
     * @param {Object} options
     * @param options.order - represents the order specifications which will result in access to LeaseProcess.
     * @param options.poolSize {Object | number} - can be defined as a number or an object with min and max fields, if defined as a number it will be treated as a min parameter.
     * @param options.poolSize.min - the minimum pool size to achieve ready state (default = 0)
     * @param options.poolSize.max - the maximum pool size, if reached, the next pool element will only be available if the borrowed resource is released or destroyed (dafault = 100)
     * @param options.setup - an optional function that is called as soon as the exe unit is ready
     * @param options.teardown - an optional function that is called before the exe unit is destroyed
     */
    async manyOf({ poolSize, order, setup, teardown, volumes }) {
        var _a, _b;
        this.validateSettings({
            order,
            volumes,
        });
        const signal = this.abortController.signal;
        let allocation = undefined;
        let resourceRentalPool = undefined;
        let subscription = undefined;
        const cleanup = async () => {
            var _a;
            if (subscription) {
                subscription.unsubscribe();
            }
            // First drain the pool (which will wait for all rentals to be paid for
            // and only then release the allocation
            if (resourceRentalPool) {
                await resourceRentalPool
                    .drainAndClear()
                    .catch((err) => this.logger.error("Error while draining resource rental pool", err));
            }
            // Don't release the allocation if it was provided by the user
            if (((_a = order.payment) === null || _a === void 0 ? void 0 : _a.allocation) || !allocation) {
                return;
            }
            await this.payment
                .releaseAllocation(allocation)
                .catch((err) => this.logger.error("Error while releasing allocation", err));
        };
        try {
            const proposalPool = new DraftOfferProposalPool({
                logger: this.logger,
                validateOfferProposal: order.market.offerProposalFilter,
                selectOfferProposal: order.market.offerProposalSelector,
            });
            const maxAgreements = typeof poolSize === "number" ? poolSize : ((_b = (_a = poolSize === null || poolSize === void 0 ? void 0 : poolSize.max) !== null && _a !== void 0 ? _a : poolSize === null || poolSize === void 0 ? void 0 : poolSize.min) !== null && _b !== void 0 ? _b : 1);
            allocation = await this.getAllocationFromOrder({ order, maxAgreements });
            signal.throwIfAborted();
            const demandSpecification = await this.market.buildDemandDetails(order.demand, order.market, allocation);
            const draftProposal$ = this.market.collectDraftOfferProposals({
                demandSpecification,
                pricing: order.market.pricing,
                filter: order.market.offerProposalFilter,
            });
            subscription = proposalPool.readFrom(draftProposal$);
            const rentSeconds = order.market.rentHours * 60 * 60;
            resourceRentalPool = this.rental.createResourceRentalPool(proposalPool, allocation, {
                poolSize,
                network: order.network,
                resourceRentalOptions: {
                    activity: order.activity,
                    payment: order.payment,
                    exeUnit: { setup, teardown, volumes },
                },
                agreementOptions: {
                    expirationSec: rentSeconds,
                },
            });
            this.cleanupTasks.push(cleanup);
            return resourceRentalPool;
        }
        catch (err) {
            this.logger.error("Error while creating rental pool", err);
            // if the execution was interrupted before we got the chance to add the cleanup task
            // we need to call it manually
            await cleanup();
            throw err;
        }
    }
    isConnected() {
        return this.hasConnection;
    }
    /**
     * Creates a new logical network within the Golem VPN infrastructure.
     * Allows communication between network nodes using standard network mechanisms,
     * but requires specific implementation in the ExeUnit/runtime,
     * which must be capable of providing a standard Unix-socket interface to their payloads
     * and marshaling the logical network traffic through the Golem Net transport layer
     * @param options
     */
    async createNetwork(options) {
        return await this.network.createNetwork(options);
    }
    /**
     * Removes an existing network from the Golem VPN infrastructure.
     * @param network
     */
    async destroyNetwork(network) {
        return await this.network.removeNetwork(network);
    }
    use(pluginCallback, pluginOptions) {
        this.registeredPlugins.push({
            initializer: pluginCallback,
            options: pluginOptions,
        });
    }
    createStorageProvider() {
        if (typeof this.options.dataTransferProtocol === "string") {
            switch (this.options.dataTransferProtocol) {
                case "gftp":
                    return new GftpStorageProvider(this.logger);
                case "ws":
                    return new WebSocketStorageProvider(this.yagna, {
                        logger: this.logger,
                    });
                default:
                    throw new GolemConfigError(`Unsupported data transfer protocol ${this.options.dataTransferProtocol}. Supported protocols are "gftp" and "ws"`);
            }
        }
        else if (this.options.dataTransferProtocol !== undefined) {
            return this.options.dataTransferProtocol;
        }
        else {
            return new NullStorageProvider();
        }
    }
    async connectPlugins() {
        this.logger.debug("Started plugin initialization");
        for (const plugin of this.registeredPlugins) {
            const cleanup = await plugin.initializer(this, plugin.options);
            if (cleanup) {
                this.cleanupTasks.push(cleanup);
            }
        }
        this.logger.debug("Finished plugin initialization");
    }
    /**
     * A helper method used to check if the user provided settings and settings are reasonable
     * @param settings
     * @private
     */
    validateSettings(settings) {
        var _a, _b;
        // Rule: If user specifies volumes and the min storage size, then the min storage has to be at least of the largest volume size
        if (settings.volumes && ((_a = settings.order.demand.workload) === null || _a === void 0 ? void 0 : _a.minStorageGib) !== undefined) {
            const largestVolumeSizeGib = Math.max(...Object.values(settings.volumes).map((spec) => spec.sizeGib));
            if (settings.order.demand.workload.minStorageGib < largestVolumeSizeGib) {
                throw new GolemUserError("Your minStorageGib requirement is below your expected largest volume size.");
            }
        }
        // Rule: Require minStorageGib settings for volume users to ensure that they will get suitable providers from the market
        if (settings.volumes && ((_b = settings.order.demand.workload) === null || _b === void 0 ? void 0 : _b.minStorageGib) === undefined) {
            throw new GolemUserError("You have specified volumes but did not specify a minStorageGib requirement.");
        }
    }
}

export { defaultLogger as $, Agreement as A, BasicDemandDirector as B, Batch as C, Demand as D, ExecutionConfig as E, RemoteProcess as F, GolemInternalError as G, GolemWorkError as H, Invoice as I, WorkErrorCode as J, GolemError as K, GolemUserError as L, MarketErrorCode as M, NetworkState as N, OfferProposal as O, PaymentDemandDirector as P, GolemAbortError as Q, ResourceRental as R, ScanDirector as S, TcpProxy as T, GolemConfigError as U, GolemPlatformError as V, WebSocketStorageProvider as W, GolemTimeoutError as X, GolemModuleError as Y, sleep as Z, nullLogger as _, GolemNetwork as a, env as a0, YagnaApi as a1, isBrowser as a2, isNode as a3, isWebWorker as a4, checkAndThrowUnsupportedInBrowserError as a5, createAbortSignalFromTimeout as a6, anyAbortSignal as a7, runOnNextEventLoopIteration as a8, mergeUntilFirstComplete as a9, waitFor as aa, waitAndCall as ab, PaymentApiAdapter as ac, MarketApiAdapter as ad, InvoiceRepository as ae, DebitNoteRepository as af, MIN_SUPPORTED_YAGNA as ag, EventReader as ah, GftpStorageProvider as ai, NullStorageProvider as aj, getPaymentNetwork as ak, ResourceRentalPool as b, RentalModuleImpl as c, DemandSpecification as d, GolemMarketError as e, WorkloadDemandDirector as f, DraftOfferProposalPool as g, MarketModuleImpl as h, ScannedOffer as i, DebitNote as j, Allocation as k, RejectionReason as l, GolemPaymentError as m, PaymentErrorCode as n, InvoiceProcessor as o, PaymentModuleImpl as p, Network as q, NetworkNode as r, NetworkModuleImpl as s, NetworkErrorCode as t, GolemNetworkError as u, Activity as v, ActivityStateEnum as w, Result as x, ActivityModuleImpl as y, ExeUnit as z };
//# sourceMappingURL=shared-7RoNp_qn.mjs.map
