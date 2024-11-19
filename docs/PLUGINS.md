# Golem Network Plugins

Welcome to the Golem Network Plugins documentation! Here we aim to provide friendly and comprehensive guidance for
developers interested in creating reusable and generic modules for the Golem Network.

## Why do we need plugins?

### Requestor script maintainability

As detailed in our [concepts](./CONCEPTS.md) guide, the SDK models the intricate domain of the Golem Network by defining
the `GolemNetwork` class, which is built from various subdomains of the project.

If you've written a few `golem-js` scripts, you might have noticed your scripts growing quickly as you add logic for
market, activity, or payment events. This can make your main requestor script bulky and difficult to maintain.

Golem Plugins offer a solution to this problem by providing a simple interface for attaching different types of logic to
your `GolemNetwork` instance. This allows you to break down your large scripts into smaller, more manageable modules and
use `GolemNetwork.use` to integrate them into your main script seamlessly.

### Opening the ecosystem for extensions

We warmly invite other developers to [contribute](./CONTRIBUTING.md) to our ecosystem. We recognize that creating core
SDK components requires considerable effort and dedication.

To make contributions more accessible, we're introducing a new pathway for developers familiar with `golem-js` to create
their `GolemNetwork` plugins and share them via NPM.

## Example plugins

### Provider tracker

Let's say you want to track unique providers on the network for statistical purposes. Here's an example plugin:

```ts
import { GolemNetwork, GolemPluginInitializer } from "@golem-sdk/golem-js";

/**
 * Example plugin that tracks unique provider ID/name pairs on the market
 */
const providerTracker: GolemPluginInitializer = (glm) => {
  const seenProviders: { id: string; name: string }[] = [];

  glm.market.events.on("offerProposalReceived", (event) => {
    const { id, name } = event.offerProposal.provider;
    const providerInfo = { id, name };
    if (!seenProviders.includes(providerInfo)) {
      seenProviders.push(providerInfo);
      console.log("Saw new provider %s named %s", id, name);
    }
  });

  // Return a cleanup function that will be executed during the `disconnect`
  return () => {
    console.log("Provider tracker found a total of %d providers", seenProviders.length);
  };
};
```

You can connect this plugin to your main script as follows:

```ts
const glm = new GolemNetwork();

// Register the plugin that will be initialized during `connect` call
glm.use(providerTracker);
```

#### Check GLM price before starting (asynchronous plugin)

If you want to avoid running your requestor script when the GLM price exceeds a certain USD value, you can capture this
policy with a reusable plugin:

```ts
import { GolemNetwork, GolemPluginInitializer } from "@golem-sdk/golem-js";

const checkGlmPriceBeforeStarting: GolemPluginInitializer<{
  maxPrice: number;
}> = async (_glm, opts) => {
  // Call an exchange to get the quotes
  const response = await fetch("https://api.coinpaprika.com/v1/tickers/glm-golem");

  if (!response.ok) {
    throw new Error("Failed to fetch GLM price");
  } else {
    // Execute your logic
    const data = await response.json();
    const price = parseFloat(data.quotes.USD.price);

    console.log("=== GLM Price ===");
    console.log("GLM price is", price);
    console.log("=== GLM Price ===");

    if (price > opts.maxPrice) {
      // Throwing inside the plugin will make `connect` throw, and then prevent
      // execution of the rest of the script
      throw new Error("GLM price is too high, won't compute today :O");
    }
  }
};
```

Here's how to use the plugin:

```ts
const glm = new GolemNetwork();

glm.use(checkGlmPriceBeforeStarting, {
  maxPrice: 0.5,
});
```

## Plugin lifecycle and cleanup

When you register plugins using `GolemNetwork.use`, they are initialized during the `GolemNetwork.connect` call. If any
plugin throws an error during initialization, the entire `connect` method will throw an error.

Each plugin can return a cleanup function, which will be executed during `GolemNetwork.disconnect`. This is particularly
useful for plugins that allocate resources, use timers, or open database connections.

## Synchronous and asynchronous plugins

The SDK supports both synchronous and asynchronous plugins. You can register all of them using the `GolemNetwork.use`
method, and they will be initialized sequentially in the order they were registered.

## Dear developers!

### Become a Golem Network Creator

We hope you find this guide helpful and enjoy contributing to the Golem Network. Happy coding!

### Community developed plugins

Here's the list of plugins developed by Golem's Community.

> Let us know about your plugins so we can feature them in our documentation.
