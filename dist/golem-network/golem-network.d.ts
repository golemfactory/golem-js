import { Logger, YagnaApi } from "../shared/utils";
import { IMarketApi, MarketModule, MarketModuleOptions, OfferProposal, OrderMarketOptions } from "../market";
import { Allocation, IPaymentApi, PaymentModule, PaymentModuleOptions } from "../payment";
import { ActivityModule, ExeUnitOptions, IActivityApi, IFileServer } from "../activity";
import { INetworkApi, Network, NetworkModule, NetworkOptions } from "../network";
import { EventEmitter } from "eventemitter3";
import { PoolSize, RentalModule, ResourceRental, ResourceRentalOptions, ResourceRentalPool } from "../resource-rental";
import { CacheService } from "../shared/cache/CacheService";
import { IDemandRepository, OrderDemandOptions } from "../market/demand";
import { StorageProvider } from "../shared/storage";
import { DataTransferProtocol } from "../shared/types";
import { IProposalRepository } from "../market/proposal";
import { GolemPluginInitializer, GolemPluginOptions } from "./plugin";
/**
 * Instance of an object or a factory function that you can call `new` on.
 * Optionally you can provide constructor arguments.
 */
export type InstanceOrFactory<TargetInterface, ConstructorArgs extends unknown[] = never[]> = TargetInterface | {
    new (...args: ConstructorArgs): TargetInterface;
};
export interface GolemNetworkOptions {
    /**
     * Logger instance to use for logging.
     * If no logger is provided you can view debug logs by setting the
     * `DEBUG` environment variable to `golem-js:*`.
     */
    logger?: Logger;
    /**
     * Set the API key and URL for the Yagna API.
     */
    api?: {
        key?: string;
        url?: string;
    };
    /**
     * Set payment-related options.
     *
     * This is where you can specify the network, payment driver and more.
     * By default, the network is set to the `holesky` test network.
     */
    payment?: Partial<PaymentModuleOptions>;
    /**
     * Set market related options.
     *
     * This is where you can globally specify several options that determine how the SDK will
     * interact with the market.
     */
    market?: Partial<MarketModuleOptions>;
    /**
     * Set the data transfer protocol to use for file transfers.
     * Default is `ws`.
     */
    dataTransferProtocol?: DataTransferProtocol;
    /**
     * Override some of the services used by the GolemNetwork instance.
     * This is useful for testing or when you want to provide your own implementation of some services.
     * Only set this if you know what you are doing.
     * To override a module you can pass either an instance of an object or a factory function (that we can call `new` on).
     */
    override?: Partial<GolemServices & {
        market: InstanceOrFactory<MarketModule>;
        payment: InstanceOrFactory<PaymentModule>;
        activity: InstanceOrFactory<ActivityModule>;
        network: InstanceOrFactory<NetworkModule>;
        rental: InstanceOrFactory<RentalModule>;
    }>;
}
type AllocationOptions = {
    /**
     * Optionally pass an existing allocation to use or an ID of an allocation that already exists in yagna.
     * If this is not provided, a new allocation will be created based on an estimated budget.
     */
    allocation?: Allocation | string;
};
/**
 * Represents the order specifications which will result in access to ResourceRental.
 */
export interface MarketOrderSpec {
    demand: OrderDemandOptions;
    market: OrderMarketOptions;
    activity?: ResourceRentalOptions["activity"];
    payment?: ResourceRentalOptions["payment"] & AllocationOptions;
    /** The network that should be used for communication between the resources rented as part of this order */
    network?: Network;
}
export interface GolemNetworkEvents {
    /** Fires when all startup operations related to GN are completed */
    connected: () => void;
    /** Fires when an error will be encountered */
    error: (error: Error) => void;
    /** Fires when all shutdown operations related to GN are completed */
    disconnected: () => void;
}
export interface OneOfOptions {
    order: MarketOrderSpec;
    signalOrTimeout?: number | AbortSignal;
    setup?: ExeUnitOptions["setup"];
    teardown?: ExeUnitOptions["teardown"];
    /**
     * Define additional volumes ot be mounted when the activity is deployed
     *
     * @experimental The Provider has to run yagna 0.17.x or newer and offer `vm` runtime 0.5.x or newer
     */
    volumes?: ExeUnitOptions["volumes"];
}
export interface ManyOfOptions {
    order: MarketOrderSpec;
    poolSize: PoolSize;
    setup?: ExeUnitOptions["setup"];
    teardown?: ExeUnitOptions["teardown"];
    /**
     * Define additional volumes ot be mounted when the activity is deployed
     *
     * @experimental The Provider has to run yagna 0.17.x or newer and offer `vm` runtime 0.5.x or newer
     */
    volumes?: ExeUnitOptions["volumes"];
}
/**
 * Dependency Container
 */
export type GolemServices = {
    yagna: YagnaApi;
    logger: Logger;
    paymentApi: IPaymentApi;
    activityApi: IActivityApi;
    marketApi: IMarketApi;
    networkApi: INetworkApi;
    proposalCache: CacheService<OfferProposal>;
    proposalRepository: IProposalRepository;
    demandRepository: IDemandRepository;
    fileServer: IFileServer;
    storageProvider: StorageProvider;
};
/**
 * General purpose and high-level API for the Golem Network
 *
 * This class is the main entry-point for developers that would like to build on Golem Network
 * using `@golem-sdk/golem-js`. It is supposed to provide an easy access API for use 80% of use cases.
 */
export declare class GolemNetwork {
    readonly events: EventEmitter<GolemNetworkEvents, any>;
    readonly options: GolemNetworkOptions;
    private readonly logger;
    private readonly yagna;
    readonly market: MarketModule;
    readonly payment: PaymentModule;
    readonly activity: ActivityModule;
    readonly network: NetworkModule;
    readonly rental: RentalModule;
    /**
     * Dependency Container
     */
    readonly services: GolemServices;
    private hasConnection;
    private disconnectPromise;
    private abortController;
    private readonly storageProvider;
    /**
     * List af additional tasks that should be executed when the network is being shut down
     * (for example finalizing resource rental created with `oneOf`)
     */
    private cleanupTasks;
    private registeredPlugins;
    constructor(options?: Partial<GolemNetworkOptions>);
    /**
     * "Connects" to the network by initializing the underlying components required to perform operations on Golem Network
     *
     * @return Resolves when all initialization steps are completed
     */
    connect(): Promise<void>;
    private startDisconnect;
    /**
     * "Disconnects" from the Golem Network
     *
     * @return Resolves when all shutdown steps are completed
     */
    disconnect(): Promise<void>;
    private getAllocationFromOrder;
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
    oneOf({ order, setup, teardown, signalOrTimeout, volumes }: OneOfOptions): Promise<ResourceRental>;
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
    manyOf({ poolSize, order, setup, teardown, volumes }: ManyOfOptions): Promise<ResourceRentalPool>;
    isConnected(): boolean;
    /**
     * Creates a new logical network within the Golem VPN infrastructure.
     * Allows communication between network nodes using standard network mechanisms,
     * but requires specific implementation in the ExeUnit/runtime,
     * which must be capable of providing a standard Unix-socket interface to their payloads
     * and marshaling the logical network traffic through the Golem Net transport layer
     * @param options
     */
    createNetwork(options?: NetworkOptions): Promise<Network>;
    /**
     * Removes an existing network from the Golem VPN infrastructure.
     * @param network
     */
    destroyNetwork(network: Network): Promise<void>;
    use(pluginCallback: GolemPluginInitializer): void;
    use<TPOptions extends GolemPluginOptions>(pluginCallback: GolemPluginInitializer<TPOptions>, pluginOptions: TPOptions): void;
    private createStorageProvider;
    private connectPlugins;
    /**
     * A helper method used to check if the user provided settings and settings are reasonable
     * @param settings
     * @private
     */
    private validateSettings;
}
export {};
