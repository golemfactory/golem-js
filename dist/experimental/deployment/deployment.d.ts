import { Logger, YagnaApi } from "../../shared/utils";
import { EventEmitter } from "eventemitter3";
import { ActivityModule } from "../../activity";
import { Network, NetworkModule, NetworkOptions } from "../../network";
import { MarketModule } from "../../market";
import { PaymentModule } from "../../payment";
import { CreateResourceRentalPoolOptions } from "./builder";
import { RentalModule, ResourceRentalPool } from "../../resource-rental";
export declare enum DeploymentState {
    INITIAL = "INITIAL",
    STARTING = "STARTING",
    READY = "READY",
    STOPPING = "STOPPING",
    STOPPED = "STOPPED",
    ERROR = "ERROR"
}
export interface DeploymentEvents {
    /**
     * Fires when backend is started.
     */
    ready: () => void;
    /**
     * Fires when a new instance encounters an error during initialization.
     * @param error
     */
    /**
     * Fires when backend is about to be stopped.
     */
    beforeEnd: () => void;
    /**
     * Fires when backend is completely terminated.
     */
    end: () => void;
}
export type DeploymentComponents = {
    resourceRentalPools: {
        name: string;
        options: CreateResourceRentalPoolOptions;
    }[];
    networks: {
        name: string;
        options: NetworkOptions;
    }[];
};
/**
 * @experimental This feature is experimental!!!
 */
export declare class Deployment {
    private readonly components;
    readonly events: EventEmitter<DeploymentEvents, any>;
    private state;
    private readonly logger;
    private readonly abortController;
    private readonly yagnaApi;
    private readonly pools;
    private readonly networks;
    private readonly modules;
    constructor(components: DeploymentComponents, deps: {
        logger: Logger;
        yagna: YagnaApi;
        market: MarketModule;
        activity: ActivityModule;
        payment: PaymentModule;
        network: NetworkModule;
        rental: RentalModule;
    });
    getState(): DeploymentState;
    start(): Promise<void>;
    stop(): Promise<void>;
    getResourceRentalPool(name: string): ResourceRentalPool;
    getNetwork(name: string): Network;
    private waitForDeployment;
}
