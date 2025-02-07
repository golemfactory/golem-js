import { GolemNetwork } from "./golem-network";
/**
 * Represents a generic cleanup task function that will be executed when the plugin lifetime reaches its end
 */
export type GolemPluginDisconnect = () => Promise<void> | void;
/**
 * Generic type for plugin options
 *
 * Plugin options are optional by design and plugin developers should use this type when they
 * want to enforce type safety on their plugin usage
 */
export type GolemPluginOptions = Record<string, any> | undefined;
/**
 * A generic plugin registration/connect function
 *
 * Golem plugins are initialized during {@link GolemNetwork.connect}
 *
 * A plugin initializer may return a cleanup function which will be called during {@link GolemNetwork.disconnect}
 */
export type GolemPluginInitializer<T extends GolemPluginOptions = undefined> = (glm: GolemNetwork, options: T) => void | GolemPluginDisconnect | Promise<GolemPluginDisconnect | void>;
/**
 * Internal data structure that allows deferring plugin initialization to the `connect` call
 */
export type GolemPluginRegistration<T extends GolemPluginOptions = any> = {
    /** Plugin initialization function */
    initializer: GolemPluginInitializer<T>;
    /** Options to pass to the initialization function when it's executed */
    options?: T;
};
