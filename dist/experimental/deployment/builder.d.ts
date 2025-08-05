import { NetworkOptions } from "../../network";
import { Deployment } from "./deployment";
import { GolemNetwork, MarketOrderSpec } from "../../golem-network";
export interface DeploymentOptions {
    replicas: number | {
        min: number;
        max: number;
    };
    network?: string;
}
export interface CreateResourceRentalPoolOptions extends MarketOrderSpec {
    deployment: DeploymentOptions;
}
export declare class GolemDeploymentBuilder {
    private glm;
    private components;
    reset(): void;
    constructor(glm: GolemNetwork);
    createResourceRentalPool(name: string, options: CreateResourceRentalPoolOptions): this;
    createNetwork(name: string, options?: NetworkOptions): this;
    getDeployment(): Deployment;
}
