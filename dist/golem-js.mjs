import { G as GolemInternalError, W as WebSocketStorageProvider } from './shared-DpcN2PRJ.mjs';
export { v as Activity, y as ActivityModuleImpl, w as ActivityStateEnum, A as Agreement, k as Allocation, B as BasicDemandDirector, C as Batch, j as DebitNote, af as DebitNoteRepository, D as Demand, d as DemandSpecification, g as DraftOfferProposalPool, a0 as EnvUtils, ah as EventReader, z as ExeUnit, E as ExecutionConfig, ai as GftpStorageProvider, Q as GolemAbortError, U as GolemConfigError, K as GolemError, e as GolemMarketError, Y as GolemModuleError, a as GolemNetwork, u as GolemNetworkError, m as GolemPaymentError, V as GolemPlatformError, X as GolemTimeoutError, L as GolemUserError, H as GolemWorkError, I as Invoice, o as InvoiceProcessor, ae as InvoiceRepository, ag as MIN_SUPPORTED_YAGNA, ad as MarketApiAdapter, M as MarketErrorCode, h as MarketModuleImpl, q as Network, t as NetworkErrorCode, s as NetworkModuleImpl, r as NetworkNode, N as NetworkState, aj as NullStorageProvider, O as OfferProposal, ac as PaymentApiAdapter, P as PaymentDemandDirector, n as PaymentErrorCode, p as PaymentModuleImpl, l as RejectionReason, F as RemoteProcess, c as RentalModuleImpl, R as ResourceRental, b as ResourceRentalPool, x as Result, S as ScanDirector, i as ScannedOffer, T as TcpProxy, J as WorkErrorCode, f as WorkloadDemandDirector, a1 as YagnaApi, a7 as anyAbortSignal, a5 as checkAndThrowUnsupportedInBrowserError, a6 as createAbortSignalFromTimeout, $ as defaultLogger, a2 as isBrowser, a3 as isNode, a4 as isWebWorker, a9 as mergeUntilFirstComplete, _ as nullLogger, a8 as runOnNextEventLoopIteration, Z as sleep, ab as waitAndCall, aa as waitFor } from './shared-DpcN2PRJ.mjs';
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
