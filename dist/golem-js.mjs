import { G as GolemInternalError, W as WebSocketStorageProvider } from './shared-CQTypKVt.mjs';
export { v as Activity, y as ActivityModuleImpl, w as ActivityStateEnum, A as Agreement, k as Allocation, B as BasicDemandDirector, F as Batch, C as ComparisonOperator, j as DebitNote, ag as DebitNoteRepository, D as Demand, d as DemandSpecification, g as DraftOfferProposalPool, a1 as EnvUtils, ai as EventReader, z as ExeUnit, E as ExecutionConfig, aj as GftpStorageProvider, U as GolemAbortError, V as GolemConfigError, L as GolemError, e as GolemMarketError, Z as GolemModuleError, a as GolemNetwork, u as GolemNetworkError, m as GolemPaymentError, X as GolemPlatformError, Y as GolemTimeoutError, Q as GolemUserError, J as GolemWorkError, I as Invoice, o as InvoiceProcessor, af as InvoiceRepository, ah as MIN_SUPPORTED_YAGNA, ae as MarketApiAdapter, M as MarketErrorCode, h as MarketModuleImpl, q as Network, t as NetworkErrorCode, s as NetworkModuleImpl, r as NetworkNode, N as NetworkState, ak as NullStorageProvider, O as OfferProposal, ad as PaymentApiAdapter, P as PaymentDemandDirector, n as PaymentErrorCode, p as PaymentModuleImpl, l as RejectionReason, H as RemoteProcess, c as RentalModuleImpl, R as ResourceRental, b as ResourceRentalPool, x as Result, S as ScanDirector, i as ScannedOffer, T as TcpProxy, K as WorkErrorCode, f as WorkloadDemandDirector, a2 as YagnaApi, a8 as anyAbortSignal, a6 as checkAndThrowUnsupportedInBrowserError, a7 as createAbortSignalFromTimeout, a0 as defaultLogger, a3 as isBrowser, a4 as isNode, a5 as isWebWorker, aa as mergeUntilFirstComplete, $ as nullLogger, a9 as runOnNextEventLoopIteration, _ as sleep, ac as waitAndCall, ab as waitFor } from './shared-CQTypKVt.mjs';
import Decimal from 'decimal.js-light';
import 'debug';
import 'ya-ts-client';
import 'uuid';
import 'semver/functions/satisfies.js';
import 'semver/functions/coerce.js';
import 'rxjs';
import 'eventsource';
import 'eventemitter3';
import 'async-lock';
import 'path';
import 'fs';
import 'cross-spawn';
import 'flatbuffers/js/flexbuffers.js';
import 'js-sha3';
import 'ws';
import 'net';
import 'buffer';
import 'async-retry';
import 'ip-num';

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
            throw new GolemInternalError(`Request to download healthy provider whitelist failed: ${body}`);
        }
    }
    catch (err) {
        throw new GolemInternalError(`Failed to download healthy provider whitelist due to an error: ${err}`, err);
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
    return new WebSocketStorageProvider(yagnaApi, {
        logger: logger === null || logger === void 0 ? void 0 : logger.child("storage"),
    });
}

export { GolemInternalError, helpers as MarketHelpers, strategy$1 as OfferProposalFilterFactory, strategy as PaymentFilters, WebSocketStorageProvider, createDefaultStorageProvider };
//# sourceMappingURL=golem-js.mjs.map
