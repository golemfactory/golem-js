'use strict';

var golemNetwork = require('./shared-BNnsKKpM.js');
var Decimal = require('decimal.js-light');
require('debug');
require('ya-ts-client');
require('uuid');
require('semver/functions/satisfies.js');
require('semver/functions/coerce.js');
require('rxjs');
require('eventsource');
require('eventemitter3');
require('async-lock');
require('path');
require('fs');
require('cross-spawn');
require('flatbuffers/js/flexbuffers.js');
require('js-sha3');
require('ws');
require('net');
require('buffer');
require('async-retry');
require('ip-num');

/** Default Proposal filter that accept all proposal coming from the market */
const acceptAll = () => () => true;
/** Proposal filter blocking every offer coming from a provider whose id is in the array */
const disallowProvidersById = (providerIds) => (proposal) => !providerIds.includes(proposal.provider.id);
/** Proposal filter blocking every offer coming from a provider whose name is in the array */
const disallowProvidersByName = (providerNames) => (proposal) => !providerNames.includes(proposal.provider.name);
/** Proposal filter blocking every offer coming from a provider whose name match to the regexp */
const disallowProvidersByNameRegex = (regexp) => (proposal) => !proposal.provider.name.match(regexp);
/** Proposal filter that only allows offers from a provider whose id is in the array */
const allowProvidersById = (providerIds) => (proposal) => providerIds.includes(proposal.provider.id);
/** Proposal filter that only allows offers from a provider whose name is in the array */
const allowProvidersByName = (providerNames) => (proposal) => providerNames.includes(proposal.provider.name);
/** Proposal filter that only allows offers from a provider whose name match to the regexp */
const allowProvidersByNameRegex = (regexp) => (proposal) => !!proposal.provider.name.match(regexp);
/**
 * Proposal filter only allowing offers that do not exceed the defined usage
 *
 * @param priceLimits.start The maximum start price in GLM
 * @param priceLimits.cpuPerSec The maximum price for CPU usage in GLM/s
 * @param priceLimits.envPerSec The maximum price for the duration of the activity in GLM/s
 */
const limitPriceFilter = (priceLimits) => (proposal) => {
    return (proposal.pricing.cpuSec <= priceLimits.cpuPerSec &&
        proposal.pricing.envSec <= priceLimits.envPerSec &&
        proposal.pricing.start <= priceLimits.start);
};

var strategy$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    acceptAll: acceptAll,
    allowProvidersById: allowProvidersById,
    allowProvidersByName: allowProvidersByName,
    allowProvidersByNameRegex: allowProvidersByNameRegex,
    disallowProvidersById: disallowProvidersById,
    disallowProvidersByName: disallowProvidersByName,
    disallowProvidersByNameRegex: disallowProvidersByNameRegex,
    limitPriceFilter: limitPriceFilter
});

/**
 * Helps to obtain a whitelist of providers which were health-tested.
 *
 * Important: This helper requires internet access to function properly.
 *
 * @return An array with Golem Node IDs of the whitelisted providers.
 */
async function getHealthyProvidersWhiteList() {
    try {
        const response = await fetch("https://reputation.golem.network/v1/provider-whitelist");
        if (response.ok) {
            return response.json();
        }
        else {
            const body = await response.text();
            throw new golemNetwork.GolemInternalError(`Request to download healthy provider whitelist failed: ${body}`);
        }
    }
    catch (err) {
        throw new golemNetwork.GolemInternalError(`Failed to download healthy provider whitelist due to an error: ${err}`, err);
    }
}

var helpers = /*#__PURE__*/Object.freeze({
    __proto__: null,
    getHealthyProvidersWhiteList: getHealthyProvidersWhiteList
});

/** Default DebitNotes filter that accept all debit notes without any validation */
const acceptAllDebitNotesFilter = () => async () => true;
/** Default Invoices filter that accept all invoices without any validation */
const acceptAllInvoicesFilter = () => async () => true;
/** A custom filter that only accepts debit notes below a given value */
const acceptMaxAmountDebitNoteFilter = (maxAmount) => async (debitNote) => new Decimal(debitNote.totalAmountDue).lte(maxAmount);
/** A custom filter that only accepts invoices below a given value */
const acceptMaxAmountInvoiceFilter = (maxAmount) => async (invoice) => new Decimal(invoice.amount).lte(maxAmount);

var strategy = /*#__PURE__*/Object.freeze({
    __proto__: null,
    acceptAllDebitNotesFilter: acceptAllDebitNotesFilter,
    acceptAllInvoicesFilter: acceptAllInvoicesFilter,
    acceptMaxAmountDebitNoteFilter: acceptMaxAmountDebitNoteFilter,
    acceptMaxAmountInvoiceFilter: acceptMaxAmountInvoiceFilter
});

function createDefaultStorageProvider(yagnaApi, logger) {
    return new golemNetwork.WebSocketStorageProvider(yagnaApi, {
        logger: logger === null || logger === void 0 ? void 0 : logger.child("storage"),
    });
}

exports.Activity = golemNetwork.Activity;
exports.ActivityModuleImpl = golemNetwork.ActivityModuleImpl;
Object.defineProperty(exports, "ActivityStateEnum", {
    enumerable: true,
    get: function () { return golemNetwork.ActivityStateEnum; }
});
exports.Agreement = golemNetwork.Agreement;
exports.Allocation = golemNetwork.Allocation;
exports.BasicDemandDirector = golemNetwork.BasicDemandDirector;
exports.Batch = golemNetwork.Batch;
exports.DebitNote = golemNetwork.DebitNote;
exports.DebitNoteRepository = golemNetwork.DebitNoteRepository;
exports.Demand = golemNetwork.Demand;
exports.DemandSpecification = golemNetwork.DemandSpecification;
exports.DraftOfferProposalPool = golemNetwork.DraftOfferProposalPool;
exports.EnvUtils = golemNetwork.env;
exports.EventReader = golemNetwork.EventReader;
exports.ExeUnit = golemNetwork.ExeUnit;
exports.ExecutionConfig = golemNetwork.ExecutionConfig;
exports.GftpStorageProvider = golemNetwork.GftpStorageProvider;
exports.GolemAbortError = golemNetwork.GolemAbortError;
exports.GolemConfigError = golemNetwork.GolemConfigError;
exports.GolemError = golemNetwork.GolemError;
exports.GolemInternalError = golemNetwork.GolemInternalError;
exports.GolemMarketError = golemNetwork.GolemMarketError;
exports.GolemModuleError = golemNetwork.GolemModuleError;
exports.GolemNetwork = golemNetwork.GolemNetwork;
exports.GolemNetworkError = golemNetwork.GolemNetworkError;
exports.GolemPaymentError = golemNetwork.GolemPaymentError;
exports.GolemPlatformError = golemNetwork.GolemPlatformError;
exports.GolemTimeoutError = golemNetwork.GolemTimeoutError;
exports.GolemUserError = golemNetwork.GolemUserError;
exports.GolemWorkError = golemNetwork.GolemWorkError;
exports.Invoice = golemNetwork.Invoice;
exports.InvoiceProcessor = golemNetwork.InvoiceProcessor;
exports.InvoiceRepository = golemNetwork.InvoiceRepository;
exports.MIN_SUPPORTED_YAGNA = golemNetwork.MIN_SUPPORTED_YAGNA;
exports.MarketApiAdapter = golemNetwork.MarketApiAdapter;
Object.defineProperty(exports, "MarketErrorCode", {
    enumerable: true,
    get: function () { return golemNetwork.MarketErrorCode; }
});
exports.MarketModuleImpl = golemNetwork.MarketModuleImpl;
exports.Network = golemNetwork.Network;
Object.defineProperty(exports, "NetworkErrorCode", {
    enumerable: true,
    get: function () { return golemNetwork.NetworkErrorCode; }
});
exports.NetworkModuleImpl = golemNetwork.NetworkModuleImpl;
exports.NetworkNode = golemNetwork.NetworkNode;
Object.defineProperty(exports, "NetworkState", {
    enumerable: true,
    get: function () { return golemNetwork.NetworkState; }
});
exports.NullStorageProvider = golemNetwork.NullStorageProvider;
exports.OfferProposal = golemNetwork.OfferProposal;
exports.PaymentApiAdapter = golemNetwork.PaymentApiAdapter;
exports.PaymentDemandDirector = golemNetwork.PaymentDemandDirector;
Object.defineProperty(exports, "PaymentErrorCode", {
    enumerable: true,
    get: function () { return golemNetwork.PaymentErrorCode; }
});
exports.PaymentModuleImpl = golemNetwork.PaymentModuleImpl;
Object.defineProperty(exports, "RejectionReason", {
    enumerable: true,
    get: function () { return golemNetwork.RejectionReason; }
});
exports.RemoteProcess = golemNetwork.RemoteProcess;
exports.RentalModuleImpl = golemNetwork.RentalModuleImpl;
exports.ResourceRental = golemNetwork.ResourceRental;
exports.ResourceRentalPool = golemNetwork.ResourceRentalPool;
exports.Result = golemNetwork.Result;
exports.ScanDirector = golemNetwork.ScanDirector;
exports.ScannedOffer = golemNetwork.ScannedOffer;
exports.TcpProxy = golemNetwork.TcpProxy;
exports.WebSocketStorageProvider = golemNetwork.WebSocketStorageProvider;
Object.defineProperty(exports, "WorkErrorCode", {
    enumerable: true,
    get: function () { return golemNetwork.WorkErrorCode; }
});
exports.WorkloadDemandDirector = golemNetwork.WorkloadDemandDirector;
exports.YagnaApi = golemNetwork.YagnaApi;
exports.anyAbortSignal = golemNetwork.anyAbortSignal;
exports.checkAndThrowUnsupportedInBrowserError = golemNetwork.checkAndThrowUnsupportedInBrowserError;
exports.createAbortSignalFromTimeout = golemNetwork.createAbortSignalFromTimeout;
exports.defaultLogger = golemNetwork.defaultLogger;
exports.isBrowser = golemNetwork.isBrowser;
exports.isNode = golemNetwork.isNode;
exports.isWebWorker = golemNetwork.isWebWorker;
exports.mergeUntilFirstComplete = golemNetwork.mergeUntilFirstComplete;
exports.nullLogger = golemNetwork.nullLogger;
exports.runOnNextEventLoopIteration = golemNetwork.runOnNextEventLoopIteration;
exports.sleep = golemNetwork.sleep;
exports.waitAndCall = golemNetwork.waitAndCall;
exports.waitFor = golemNetwork.waitFor;
exports.MarketHelpers = helpers;
exports.OfferProposalFilterFactory = strategy$1;
exports.PaymentFilters = strategy;
exports.createDefaultStorageProvider = createDefaultStorageProvider;
//# sourceMappingURL=golem-js.js.map
