import { EventEmitter } from 'eventemitter3';
import { L as GolemUserError, Q as GolemAbortError, a as GolemNetwork, $ as defaultLogger, Y as GolemModuleError, _ as nullLogger, ak as getPaymentNetwork, U as GolemConfigError, g as DraftOfferProposalPool } from './shared-DpcN2PRJ.mjs';
import { v4 } from 'uuid';
import 'ya-ts-client';
import 'semver/functions/satisfies.js';
import 'semver/functions/coerce.js';
import 'rxjs';
import 'eventsource';
import 'debug';
import 'async-lock';
import 'decimal.js-light';
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

var JobState;
(function (JobState) {
    JobState["New"] = "new";
    JobState["Queued"] = "queued";
    JobState["Pending"] = "pending";
    JobState["Done"] = "done";
    JobState["Retry"] = "retry";
    JobState["Rejected"] = "rejected";
})(JobState || (JobState = {}));
/**
 * @experimental This API is experimental and subject to change. Use at your own risk.
 *
 * The Job class represents a single self-contained unit of work that can be run on the Golem Network.
 * It is responsible for managing the lifecycle of the work and providing information about its state.
 * It also provides an event emitter that can be used to listen for state changes.
 */
class Job {
    /**
     * @param id
     * @param glm
     * @param order
     * @param logger
     */
    constructor(id, glm, order, logger) {
        this.id = id;
        this.glm = glm;
        this.order = order;
        this.logger = logger;
        this.events = new EventEmitter();
        this.abortController = new AbortController();
        this.state = JobState.New;
    }
    isRunning() {
        const inProgressStates = [JobState.Pending, JobState.Retry];
        return inProgressStates.includes(this.state);
    }
    /**
     * Run your worker function on the Golem Network. This method will synchronously initialize all internal services and validate the job options. The work itself will be run asynchronously in the background.
     * You can use the {@link experimental/job/job.Job.events} event emitter to listen for state changes.
     * You can also use {@link experimental/job/job.Job.waitForResult} to wait for the job to finish and get the results.
     * If you want to cancel the job, use {@link experimental/job/job.Job.cancel}.
     * If you want to run multiple jobs in parallel, you can use {@link experimental/job/job_manager.JobManager.createJob} to create multiple jobs and run them in parallel.
     *
     * @param workOnGolem - Your worker function that will be run on the Golem Network.
     */
    startWork(workOnGolem) {
        this.logger.debug("Staring work in a Job");
        if (this.isRunning()) {
            throw new GolemUserError(`Job ${this.id} is already running`);
        }
        this.state = JobState.Pending;
        this.events.emit("created");
        // reset abort controller
        this.abortController = new AbortController();
        this.runWork({
            workOnGolem,
            signal: this.abortController.signal,
        })
            .then((results) => {
            this.logger.debug("Finished work in job", { results });
            this.results = results;
            this.state = JobState.Done;
            this.events.emit("success");
        })
            .catch((error) => {
            this.logger.error("Running work in job failed due to", error);
            this.error = error;
            this.state = JobState.Rejected;
            this.events.emit("error", error);
        })
            .finally(async () => {
            this.events.emit("ended");
        });
    }
    async runWork({ workOnGolem, signal }) {
        if (signal.aborted) {
            this.events.emit("canceled");
            throw new GolemAbortError("Canceled");
        }
        const rental = await this.glm.oneOf({ order: this.order, signalOrTimeout: signal });
        try {
            const exeUnit = await rental.getExeUnit(signal);
            this.events.emit("started");
            if (signal.aborted) {
                this.events.emit("canceled");
                throw new GolemAbortError("Canceled");
            }
            signal.addEventListener("abort", () => this.events.emit("canceled"), { once: true });
            // remember to `await` here so that the `finally` block is executed AFTER the work is done
            return await workOnGolem(exeUnit);
        }
        finally {
            await rental.stopAndFinalize();
        }
    }
    /**
     * Cancel the job. This method will stop the activity and wait for it to finish.
     * Throws an error if the job is not running.
     */
    async cancel() {
        if (!this.isRunning) {
            throw new GolemUserError(`Job ${this.id} is not running`);
        }
        this.abortController.abort();
        return new Promise((resolve) => {
            this.events.once("ended", resolve);
        });
    }
    /**
     * Wait for the job to finish and return the results.
     * Throws an error if the job was not started.
     */
    async waitForResult() {
        if (this.state === JobState.Done) {
            return this.results;
        }
        if (this.state === JobState.Rejected) {
            throw this.error;
        }
        if (!this.isRunning()) {
            throw new GolemUserError(`Job ${this.id} is not running`);
        }
        return new Promise((resolve, reject) => {
            this.events.once("ended", () => {
                if (this.state === JobState.Done) {
                    resolve(this.results);
                }
                else {
                    reject(this.error);
                }
            });
        });
    }
}

/**
 * @experimental This API is experimental and subject to change. Use at your own risk.
 *
 * The Golem Network class provides a high-level API for running jobs on the Golem Network.
 */
class JobManager {
    /**
     * @param config - Configuration options that will be passed to all jobs created by this instance.
     * @param logger
     */
    constructor(config, logger = defaultLogger("jobs")) {
        var _a, _b;
        this.logger = logger;
        this.jobs = new Map();
        this.glm = new GolemNetwork({
            api: {
                key: (_a = config === null || config === void 0 ? void 0 : config.yagna) === null || _a === void 0 ? void 0 : _a.apiKey,
                url: (_b = config === null || config === void 0 ? void 0 : config.yagna) === null || _b === void 0 ? void 0 : _b.basePath,
            },
            logger: this.logger,
            ...config,
        });
    }
    isInitialized() {
        return this.glm.isConnected();
    }
    async init() {
        await this.glm.connect();
    }
    /**
     * Create a new job and add it to the list of jobs managed by this instance.
     * This method does not start any work on the network, use {@link experimental/job/job.Job.startWork} for that.
     *
     * @param order
     */
    createJob(order) {
        this.checkInitialization();
        const jobId = v4();
        const job = new Job(jobId, this.glm, order, this.logger);
        this.jobs.set(jobId, job);
        return job;
    }
    getJobById(id) {
        this.checkInitialization();
        return this.jobs.get(id);
    }
    /**
     * Close the connection to the Yagna service and cancel all running jobs.
     */
    async close() {
        const pendingJobs = Array.from(this.jobs.values()).filter((job) => job.isRunning());
        await Promise.allSettled(pendingJobs.map((job) => job.cancel()));
        await this.glm.disconnect();
    }
    checkInitialization() {
        if (!this.isInitialized()) {
            throw new GolemUserError("GolemNetwork not initialized, please run init() first");
        }
    }
}

class GolemReputationError extends GolemModuleError {
    constructor(message, cause) {
        super(message, 0, cause);
    }
}

/**
 * Default minimum score for proposals.
 * @experimental
 */
const DEFAULT_PROPOSAL_MIN_SCORE = 0.8;
/**
 * Default weights used to calculate the score for proposals.
 * @experimental
 */
const DEFAULT_PROPOSAL_WEIGHTS = {
    uptime: 0.5,
    successRate: 0.5,
};
/**
 * Default weights used to calculate the score for agreements.
 * @experimental
 */
const DEFAULT_AGREEMENT_WEIGHTS = {
    uptime: 0.5,
    successRate: 0.5,
};
/**
 * Default reputation service URL.
 * @experimental
 */
const DEFAULT_REPUTATION_URL = "https://reputation.golem.network/v2/providers/scores";
/**
 * The number of top scoring providers to consider when selecting an agreement.
 *
 * Default for `topPoolSize` agreement selector option.
 */
const DEFAULT_AGREEMENT_TOP_POOL_SIZE = 2;
/**
 * Predefined presets for reputation system.
 */
const REPUTATION_PRESETS = {
    /**
     * Preset for short CPU intensive compute tasks.
     */
    compute: {
        offerProposalFilter: {
            min: 0.5,
            weights: {
                cpuSingleThreadScore: 1,
            },
        },
        offerProposalSelector: {
            weights: {
                cpuSingleThreadScore: 1,
            },
            topPoolSize: DEFAULT_AGREEMENT_TOP_POOL_SIZE,
        },
    },
    /**
     * Preset for long-running services, where uptime is important.
     */
    service: {
        offerProposalFilter: {
            min: DEFAULT_PROPOSAL_MIN_SCORE,
            weights: {
                uptime: 0.8,
                cpuMultiThreadScore: 0.2,
            },
        },
        offerProposalSelector: {
            weights: {
                uptime: 0.5,
                cpuMultiThreadScore: 0.5,
            },
            topPoolSize: DEFAULT_AGREEMENT_TOP_POOL_SIZE,
        },
    },
};
/**
 * Reputation system client.
 *
 * This class is responsible for fetching and applying reputation data to Golem SDK's market management class.
 *
 * Currently, it includes a proposal filter you can use to filter out providers with low reputation scores.
 *
 * Reputation data is gathered by the following project: https://github.com/golemfactory/reputation-auditor
 *
 * You can adjust the weights used to calculate the score for proposals by using the `setProposalWeights` method.
 *
 * NOTE: This class is currently experimental and subject to change.
 *
 * NOTE: Only providers from polygon network are being tested, so using this class on testnet will not work.
 *
 * @experimental
 */
class ReputationSystem {
    /**
     * Create a new reputation system client and fetch the reputation data.
     */
    static async create(config) {
        const system = new ReputationSystem(config);
        await system.fetchData();
        return system;
    }
    constructor(config) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        this.config = config;
        /**
         * Reputation data.
         */
        this.data = {
            testedProviders: [],
        };
        /**
         * Weights used to calculate the score for proposals.
         */
        this.proposalWeights = DEFAULT_PROPOSAL_WEIGHTS;
        /**
         * Weights used to calculate the score for agreements.
         */
        this.agreementWeights = DEFAULT_AGREEMENT_WEIGHTS;
        /**
         * Map of provider IDs to their reputation data.
         */
        this.providersScoreMap = new Map();
        /**
         * Map of provider IDs to their rejected status.
         * @private
         */
        this.rejectedProvidersMap = new Map();
        /**
         * Map of operators (by wallet address) to their rejected status.
         * @private
         */
        this.rejectedOperatorsMap = new Map();
        this.url = (_b = (_a = this.config) === null || _a === void 0 ? void 0 : _a.url) !== null && _b !== void 0 ? _b : DEFAULT_REPUTATION_URL;
        this.logger = (_e = (_d = (_c = this.config) === null || _c === void 0 ? void 0 : _c.logger) === null || _d === void 0 ? void 0 : _d.child("reputation")) !== null && _e !== void 0 ? _e : nullLogger();
        this.paymentNetwork = (_g = (_f = this.config) === null || _f === void 0 ? void 0 : _f.paymentNetwork) !== null && _g !== void 0 ? _g : getPaymentNetwork();
        this.defaultProposalFilterOptions = {
            min: DEFAULT_PROPOSAL_MIN_SCORE,
            acceptUnlisted: undefined,
        };
        this.defaultAgreementSelectorOptions = {
            topPoolSize: DEFAULT_AGREEMENT_TOP_POOL_SIZE,
        };
        if ((_h = this.config) === null || _h === void 0 ? void 0 : _h.preset) {
            this.usePreset(this.config.preset);
        }
    }
    /**
     * Apply preset to current reputation system configuration.
     * @param presetName Preset name to use.
     */
    usePreset(presetName) {
        var _a, _b, _c, _d, _e, _f, _g;
        const presetConfig = REPUTATION_PRESETS[presetName];
        if (!presetConfig) {
            throw new GolemReputationError(`Reputation preset not found: ${presetName}`);
        }
        if ((_a = presetConfig.offerProposalFilter) === null || _a === void 0 ? void 0 : _a.weights) {
            this.setProposalWeights(presetConfig.offerProposalFilter.weights);
        }
        if ((_b = presetConfig.offerProposalSelector) === null || _b === void 0 ? void 0 : _b.weights) {
            this.setAgreementWeights(presetConfig.offerProposalSelector.weights);
        }
        this.defaultProposalFilterOptions = {
            min: (_d = (_c = presetConfig.offerProposalFilter) === null || _c === void 0 ? void 0 : _c.min) !== null && _d !== void 0 ? _d : this.defaultProposalFilterOptions.min,
            acceptUnlisted: (_e = presetConfig.offerProposalFilter) === null || _e === void 0 ? void 0 : _e.acceptUnlisted, // undefined is meaningful
        };
        this.defaultAgreementSelectorOptions = {
            topPoolSize: (_g = (_f = presetConfig.offerProposalSelector) === null || _f === void 0 ? void 0 : _f.topPoolSize) !== null && _g !== void 0 ? _g : this.defaultAgreementSelectorOptions.topPoolSize,
            // TODO: to be discussed with the reputation team
            // agreementBonus:
            //   presetConfig.proposalSelector?.agreementBonus ?? this.defaultAgreementSelectorOptions.agreementBonus,
        };
    }
    /**
     * Set reputation data.
     *
     * This is useful if you want to cache the date locally, or you have an alternative source of data.
     */
    setData(data) {
        var _a, _b;
        this.data = data;
        this.providersScoreMap.clear();
        this.rejectedProvidersMap.clear();
        this.rejectedOperatorsMap.clear();
        this.data.testedProviders.forEach((entry) => {
            this.providersScoreMap.set(entry.provider.id, entry);
        });
        (_a = this.data.rejectedProviders) === null || _a === void 0 ? void 0 : _a.forEach((entry) => {
            this.rejectedProvidersMap.set(entry.provider.id, entry);
        });
        (_b = this.data.rejectedOperators) === null || _b === void 0 ? void 0 : _b.forEach((entry) => {
            this.rejectedOperatorsMap.set(entry.operator.walletAddress, entry);
        });
    }
    /**
     * Returns current reputation data.
     */
    getData() {
        return this.data;
    }
    /**
     * Fetch data from the reputation service.
     */
    async fetchData() {
        let result;
        try {
            // Add payment network to the URL.
            const url = new URL(this.url);
            url.searchParams.set("network", this.paymentNetwork);
            result = await fetch(url);
        }
        catch (e) {
            throw new GolemReputationError("Failed to fetch reputation data", e);
        }
        if (result.ok) {
            try {
                const data = await result.json();
                this.setData(data);
            }
            catch (e) {
                throw new GolemReputationError("Failed to fetch reputation data: Invalid data", e);
            }
        }
        else {
            throw new GolemReputationError(`Failed to fetch reputation data: ${result.statusText}`);
        }
    }
    /**
     * Set weights used to calculate the score for proposals.
     */
    setProposalWeights(weights) {
        this.proposalWeights = weights;
    }
    /**
     * Returns current proposal weights.
     */
    getProposalWeights() {
        return this.proposalWeights;
    }
    /**
     * Set weights used to calculate the score for agreements.
     */
    setAgreementWeights(weights) {
        this.agreementWeights = weights;
    }
    /**
     * Returns current agreement weights.
     */
    getAgreementWeights() {
        return this.agreementWeights;
    }
    /**
     * Returns scores for a provider or undefined if the provider is unlisted.
     * @param providerId
     */
    getProviderScores(providerId) {
        var _a;
        return (_a = this.providersScoreMap.get(providerId)) === null || _a === void 0 ? void 0 : _a.scores;
    }
    /**
     * Returns a proposal filter that can be used to filter out providers with low reputation scores.
     * @param opts
     */
    offerProposalFilter(opts) {
        return (proposal) => {
            var _a, _b, _c, _d;
            // Filter out rejected operators.
            const operatorEntry = this.rejectedOperatorsMap.get(proposal.provider.walletAddress);
            if (operatorEntry) {
                this.logger.debug(`Proposal from ${proposal.provider.id} rejected due to rejected operator`, {
                    reason: operatorEntry.reason,
                    provider: proposal.provider,
                });
                return false;
            }
            // Filter out rejected providers.
            const providerEntry = this.rejectedProvidersMap.get(proposal.provider.id);
            if (providerEntry) {
                this.logger.debug(`Proposal from ${proposal.provider.id} rejected due to rejected provider`, {
                    reason: providerEntry.reason,
                    provider: proposal.provider,
                });
                return false;
            }
            // Filter based on reputation scores.
            const scoreEntry = this.providersScoreMap.get(proposal.provider.id);
            if (scoreEntry) {
                const min = (_b = (_a = opts === null || opts === void 0 ? void 0 : opts.min) !== null && _a !== void 0 ? _a : this.defaultProposalFilterOptions.min) !== null && _b !== void 0 ? _b : DEFAULT_PROPOSAL_MIN_SCORE;
                const score = this.calculateScore(scoreEntry.scores, this.proposalWeights);
                this.logger.debug(`Proposal score for ${proposal.provider.id}: ${score} - min ${min}`, {
                    provider: proposal.provider,
                    scores: scoreEntry.scores,
                    weights: this.proposalWeights,
                    score,
                    min,
                });
                return score >= min;
            }
            this.logger.debug(`Proposal from unlisted provider ${proposal.provider.id} (known providers: ${this.data.testedProviders.length})`, {
                provider: proposal.provider,
            });
            // Use the acceptUnlisted option if provided, otherwise allow only if there are no known providers.
            return ((_d = (_c = opts === null || opts === void 0 ? void 0 : opts.acceptUnlisted) !== null && _c !== void 0 ? _c : this.defaultProposalFilterOptions.acceptUnlisted) !== null && _d !== void 0 ? _d : this.data.testedProviders.length === 0);
        };
    }
    /**
     * Returns an agreement selector that can be used to select providers based on their reputation scores.
     *
     * The outcome of this function is determined by current provider scores and the agreement weights set.
     *
     * For best results, make sure you test the performance or stability of your workload using different weights.
     *
     * @see setAgreementWeights
     *
     * @param opts
     */
    offerProposalSelector(opts) {
        var _a, _b;
        const poolSize = (_b = (_a = opts === null || opts === void 0 ? void 0 : opts.topPoolSize) !== null && _a !== void 0 ? _a : this.defaultAgreementSelectorOptions.topPoolSize) !== null && _b !== void 0 ? _b : DEFAULT_AGREEMENT_TOP_POOL_SIZE;
        return (proposals) => {
            // Cache scores for providers.
            const scoresMap = new Map();
            proposals.forEach((c) => {
                var _a, _b;
                const data = (_b = (_a = this.providersScoreMap.get(c.provider.id)) === null || _a === void 0 ? void 0 : _a.scores) !== null && _b !== void 0 ? _b : {};
                const score = this.calculateScore(data, this.agreementWeights);
                // TODO: to be discussed with the reputation team
                // if (c.agreement) score += opts?.agreementBonus ?? this.defaultAgreementSelectorOptions.agreementBonus ?? 0;
                scoresMap.set(c.provider.id, score);
            });
            const array = this.sortCandidatesByScore(proposals, scoresMap);
            const topPool = Math.min(poolSize, array.length);
            const index = topPool === 1 ? 0 : Math.floor(Math.random() * topPool);
            return array[index];
        };
    }
    /**
     * Calculate a normalized score based on the given scores and weights.
     * @param scores
     * @param weights
     */
    calculateScore(scores, weights) {
        let totalWeight = 0;
        let score = 0;
        Object.keys(weights).forEach((key) => {
            var _a, _b;
            const weight = (_a = weights[key]) !== null && _a !== void 0 ? _a : 0;
            const value = (_b = scores[key]) !== null && _b !== void 0 ? _b : 0;
            totalWeight += weight;
            score += weight * value;
        });
        // Return normalized score.
        return score / totalWeight;
    }
    /**
     * Based on the current reputation data, calculate a list of providers that meet the minimum score requirement.
     *
     * This method is useful to validate you filter and weights vs the available provider market.
     *
     * @param opts
     */
    calculateProviderPool(opts) {
        var _a, _b;
        const min = (_b = (_a = opts === null || opts === void 0 ? void 0 : opts.min) !== null && _a !== void 0 ? _a : this.defaultProposalFilterOptions.min) !== null && _b !== void 0 ? _b : DEFAULT_PROPOSAL_MIN_SCORE;
        return this.data.testedProviders.filter((entry) => {
            const score = this.calculateScore(entry.scores, this.proposalWeights);
            return score >= min;
        });
    }
    sortCandidatesByScore(proposals, scoresMap) {
        const array = Array.from(proposals);
        array.sort((a, b) => {
            var _a, _b;
            const aId = a.provider.id;
            const bId = b.provider.id;
            // Get the score values.
            const aScoreValue = (_a = scoresMap.get(aId)) !== null && _a !== void 0 ? _a : 0;
            const bScoreValue = (_b = scoresMap.get(bId)) !== null && _b !== void 0 ? _b : 0;
            return bScoreValue - aScoreValue;
        });
        return array;
    }
}

function validateNetworks(components) {
    var _a;
    const networkNames = new Set(components.networks.map((network) => network.name));
    for (const pool of components.resourceRentalPools) {
        if (!((_a = pool.options.deployment) === null || _a === void 0 ? void 0 : _a.network)) {
            continue;
        }
        if (!networkNames.has(pool.options.deployment.network)) {
            throw new GolemConfigError(`Activity pool ${pool.name} references non-existing network ${pool.options.deployment.network}`);
        }
    }
}
function validateDeployment(components) {
    validateNetworks(components);
    // ... other validations
}

var DeploymentState;
(function (DeploymentState) {
    DeploymentState["INITIAL"] = "INITIAL";
    DeploymentState["STARTING"] = "STARTING";
    DeploymentState["READY"] = "READY";
    DeploymentState["STOPPING"] = "STOPPING";
    DeploymentState["STOPPED"] = "STOPPED";
    DeploymentState["ERROR"] = "ERROR";
})(DeploymentState || (DeploymentState = {}));
/**
 * @experimental This feature is experimental!!!
 */
class Deployment {
    constructor(components, deps) {
        this.components = components;
        this.events = new EventEmitter();
        this.state = DeploymentState.INITIAL;
        this.abortController = new AbortController();
        this.pools = new Map();
        this.networks = new Map();
        validateDeployment(components);
        const { logger, yagna, ...modules } = deps;
        this.logger = logger !== null && logger !== void 0 ? logger : defaultLogger("deployment");
        this.yagnaApi = yagna;
        this.modules = modules;
        this.abortController.signal.addEventListener("abort", () => {
            this.logger.info("Abort signal received");
            this.stop().catch((e) => {
                this.logger.error("stop() error on abort", { error: e });
            });
        });
    }
    getState() {
        return this.state;
    }
    async start() {
        var _a, _b, _c, _d, _e, _f;
        if (this.abortController.signal.aborted) {
            throw new GolemAbortError("Calling start after abort signal received");
        }
        if (this.state != DeploymentState.INITIAL) {
            throw new GolemUserError(`Cannot start backend, expected backend state INITIAL, current state is ${this.state}`);
        }
        for (const network of this.components.networks) {
            const networkInstance = await this.modules.network.createNetwork(network.options);
            this.networks.set(network.name, networkInstance);
        }
        // Allocation is re-used for all demands so the expiration date should
        // be the equal to the longest expiration date of all demands
        const longestExpiration = Math.round(Math.max(...this.components.resourceRentalPools.map((pool) => pool.options.market.rentHours)) * 3600);
        const totalBudget = this.components.resourceRentalPools.reduce((acc, pool) => {
            var _a, _b;
            const replicas = pool.options.deployment.replicas;
            const maxAgreements = typeof replicas === "number" ? replicas : ((_b = (_a = replicas === null || replicas === void 0 ? void 0 : replicas.max) !== null && _a !== void 0 ? _a : replicas === null || replicas === void 0 ? void 0 : replicas.min) !== null && _b !== void 0 ? _b : 1);
            return (acc +
                this.modules.market.estimateBudget({
                    order: pool.options,
                    maxAgreements,
                }));
        }, 0);
        const allocation = await this.modules.payment.createAllocation({
            budget: totalBudget,
            expirationSec: longestExpiration,
        });
        for (const pool of this.components.resourceRentalPools) {
            const network = ((_b = (_a = pool.options) === null || _a === void 0 ? void 0 : _a.deployment) === null || _b === void 0 ? void 0 : _b.network)
                ? this.networks.get((_c = pool.options) === null || _c === void 0 ? void 0 : _c.deployment.network)
                : undefined;
            const demandSpecification = await this.modules.market.buildDemandDetails(pool.options.demand, pool.options.market, allocation);
            const proposalPool = new DraftOfferProposalPool({
                logger: this.logger,
                validateOfferProposal: pool.options.market.offerProposalFilter,
                selectOfferProposal: pool.options.market.offerProposalSelector,
            });
            const draftProposal$ = this.modules.market.collectDraftOfferProposals({
                demandSpecification,
                pricing: pool.options.market.pricing,
                filter: pool.options.market.offerProposalFilter,
            });
            const proposalSubscription = proposalPool.readFrom(draftProposal$);
            const resourceRentalPool = this.modules.rental.createResourceRentalPool(proposalPool, allocation, {
                poolSize: (_d = pool.options.deployment) === null || _d === void 0 ? void 0 : _d.replicas,
                network,
                resourceRentalOptions: {
                    activity: (_e = pool.options) === null || _e === void 0 ? void 0 : _e.activity,
                    payment: (_f = pool.options) === null || _f === void 0 ? void 0 : _f.payment,
                },
                agreementOptions: {
                    expirationSec: Math.round(pool.options.market.rentHours * 3600),
                },
            });
            this.pools.set(pool.name, {
                proposalPool,
                proposalSubscription,
                resourceRentalPool,
            });
        }
        await this.waitForDeployment();
        this.events.emit("ready");
    }
    async stop() {
        if (this.state === DeploymentState.STOPPING || this.state === DeploymentState.STOPPED) {
            return;
        }
        this.state = DeploymentState.STOPPING;
        this.events.emit("beforeEnd");
        try {
            this.abortController.abort();
            const stopPools = Array.from(this.pools.values()).map((pool) => Promise.allSettled([pool.proposalSubscription.unsubscribe(), pool.resourceRentalPool.drainAndClear()]));
            await Promise.allSettled(stopPools);
            const stopNetworks = Array.from(this.networks.values()).map((network) => this.modules.network.removeNetwork(network));
            await Promise.allSettled(stopNetworks);
            this.state = DeploymentState.STOPPED;
        }
        catch (err) {
            this.logger.error("The deployment failed with an error", err);
            this.state = DeploymentState.ERROR;
            throw err;
        }
        this.events.emit("end");
    }
    getResourceRentalPool(name) {
        const pool = this.pools.get(name);
        if (!pool) {
            throw new GolemUserError(`ResourceRentalPool ${name} not found`);
        }
        return pool.resourceRentalPool;
    }
    getNetwork(name) {
        const network = this.networks.get(name);
        if (!network) {
            throw new GolemUserError(`Network ${name} not found`);
        }
        return network;
    }
    async waitForDeployment() {
        this.logger.info("Waiting for all components to be deployed...");
        const readyPools = [...this.pools.values()].map((component) => component.resourceRentalPool.ready());
        await Promise.all(readyPools);
        this.logger.info("Components deployed and ready to use");
    }
}

class GolemDeploymentBuilder {
    reset() {
        this.components = {
            resourceRentalPools: [],
            networks: [],
        };
    }
    constructor(glm) {
        this.glm = glm;
        this.components = {
            resourceRentalPools: [],
            networks: [],
        };
    }
    createResourceRentalPool(name, options) {
        if (this.components.resourceRentalPools.some((pool) => pool.name === name)) {
            throw new GolemConfigError(`Resource Rental Pool with name ${name} already exists`);
        }
        this.components.resourceRentalPools.push({ name, options });
        return this;
    }
    createNetwork(name, options = {}) {
        if (this.components.networks.some((network) => network.name === name)) {
            throw new GolemConfigError(`Network with name ${name} already exists`);
        }
        this.components.networks.push({ name, options });
        return this;
    }
    getDeployment() {
        validateDeployment(this.components);
        const deployment = new Deployment(this.components, {
            logger: this.glm.services.logger,
            yagna: this.glm.services.yagna,
            payment: this.glm.payment,
            market: this.glm.market,
            activity: this.glm.activity,
            network: this.glm.network,
            rental: this.glm.rental,
        });
        this.reset();
        return deployment;
    }
}

export { DEFAULT_AGREEMENT_TOP_POOL_SIZE, DEFAULT_AGREEMENT_WEIGHTS, DEFAULT_PROPOSAL_MIN_SCORE, DEFAULT_PROPOSAL_WEIGHTS, DEFAULT_REPUTATION_URL, Deployment, DeploymentState, GolemDeploymentBuilder, Job, JobManager, JobState, ReputationSystem };
//# sourceMappingURL=golem-js-experimental.mjs.map
