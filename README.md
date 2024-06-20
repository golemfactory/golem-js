# Golem JavaScript API

![GitHub](https://img.shields.io/github/license/golemfactory/golem-js)
![npm](https://img.shields.io/npm/v/@golem-sdk/golem-js)
![node-current](https://img.shields.io/node/v/@golem-sdk/golem-js)
![npm type definitions](https://img.shields.io/npm/types/@golem-sdk/golem-js)
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/golemfactory/golem-js/goth.yml)
[![GitHub issues](https://img.shields.io/github/issues/golemfactory/golem-js)](https://github.com/golemfactory/golem-js/issues)
![Discord](https://img.shields.io/discord/684703559954333727?style=flat&logo=discord)

## Table of contents

<!-- TOC -->

- [Golem JavaScript API](#golem-javascript-api)
  - [Table of contents](#table-of-contents)
  - [What's Golem and `golem-js`?](#whats-golem-and-golem-js)
  - [Documentation](#documentation)
  - [Installation](#installation)
  - [Supported environments](#supported-environments)
  - [Getting started with Golem Network](#getting-started-with-golem-network)
    - [Obtain an `app-key` to use with SDK](#obtain-an-app-key-to-use-with-sdk)
  - [Usage](#usage)
    - [Renting a single machine and running a simple task on it](#renting-a-single-machine-and-running-a-simple-task-on-it)
    - [Renting many machines and running tasks in parallel](#renting-many-machines-and-running-tasks-in-parallel)
  - [Features](#features)
    - [Streaming command results](#streaming-command-results)
    - [File transfer](#file-transfer)
    - [VPN](#vpn)
    - [Events](#events)
    - [Custom filters](#custom-filters)
    - [Custom ranking of proposals](#custom-ranking-of-proposals)
    - [Uploading local images to the provider](#uploading-local-images-to-the-provider)
  - [Going further](#going-further)
  - [More examples](#more-examples)
  - [Debugging](#debugging)
  - [Testing](#testing)
  - [Contributing](#contributing)
  - [See also](#see-also)

## What's Golem and `golem-js`?

**[The Golem Network](https://golem.network)** fosters a global group of creators building ambitious software solutions
that will shape the technological landscape of future generations by accessing computing resources across the platform.
Golem Network is an accessible, reliable, open access and censorship-resistant protocol, democratizing access to digital
resources and connecting users through a flexible, open-source platform.

**golem-js** is the JavaScript API that allows developers to connect to their Golem nodes and manage their
distributed, computational loads through Golem Network.

## Documentation

Visit our [official documentation](https://docs.golem.network/docs/creators/javascript) to learn more about the
JavaScript SDK and how to use it.

## Installation

To quickly get started with a new project using `golem-js`, you can use the following template:

```bash
npx @golem-sdk/cli@latest new my-awesome-golem-project
```

`@golem-sdk/golem-js` is available as a [NPM package](https://www.npmjs.com/package/@golem-sdk/golem-js).

You can install it through `npm`:

```bash
npm install @golem-sdk/golem-js
```

or by `yarn`:

```bash
yarn add @golem-sdk/golem-js
```

## Supported environments

The SDK is designed to work with LTS versions of Node (starting from 18)
and with browsers.

## Getting started with Golem Network

Before you start using the SDK, you need to have `yagna` installed and running on your machine. Yagna is a service that
communicates and performs operations on the Golem Network, upon your requests via the SDK. You can follow the instructions below or visit the [official documentation](https://docs.golem.network/docs/creators/javascript/quickstarts/quickstart#install-yagna-2) to set it up.

```bash
# Join the network as a requestor
curl -sSf https://join.golem.network/as-requestor | bash -

# Start the golem node on your machine,
# you can use `daemonize` to run this in background
yagna service run
```

Now that you have `yagna` running, you can initialize your requestor and request funds (`tGLM` tokens) on the test network.

```bash
# IN SEPARATE TERMINAL (if not daemonized)
# Initialize your requestor
yagna payment init --sender --network holesky

# Request funds on the test network
yagna payment fund --network holesky

# Check the status of the funds
yagna payment status --network holesky
```

### Obtain an `app-key` to use with SDK

If you don't have any app-keys available from `yagna app-key list`, go ahead and create one with the command below.
You will need this key in order to communicate with `yagna` from your application. You can set it
as `YAGNA_APPKEY` environment variable.

```bash
yagna app-key create my-golem-app
```

## Usage

### Renting a single machine and running a simple task on it

```ts
import { MarketOrderSpec, GolemNetwork } from "@golem-sdk/golem-js";

// Define the order that we're going to place on the market
const order: MarketOrderSpec = {
  demand: {
    workload: { imageTag: "golem/alpine:latest" },
  },
  market: {
    // We're only going to rent the provider for 5 minutes max
    rentHours: 5 / 60,
    pricing: {
      model: "linear",
      maxStartPrice: 0.5,
      maxCpuPerHourPrice: 1.0,
      maxEnvPerHourPrice: 0.5,
    },
  },
};

(async () => {
  const glm = new GolemNetwork();

  try {
    await glm.connect();
    // Rent a machine
    const rental = await glm.oneOf(order);
    await rental
      .getExeUnit()
      .then((exe) => exe.run("echo Hello, Golem! 👋"))
      .then((res) => console.log(res.stdout));
    await rental.stopAndFinalize();
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
```

### Renting many machines and running tasks in parallel

```ts
import { GolemNetwork, MarketOrderSpec } from "@golem-sdk/golem-js";

// Define the order that we're going to place on the market
const order: MarketOrderSpec = {
  demand: {
    workload: { imageTag: "golem/alpine:latest" },
  },
  market: {
    rentHours: 0.5,
    pricing: {
      model: "linear",
      maxStartPrice: 0.5,
      maxCpuPerHourPrice: 1.0,
      maxEnvPerHourPrice: 0.5,
    },
  },
};

(async () => {
  const glm = new GolemNetwork();

  try {
    await glm.connect();
    // create a pool that can grow up to 3 rentals at the same time
    const pool = await glm.manyOf({
      concurrency: 3,
      order,
    });
    // run 3 tasks in parallel on 3 different machines
    await Promise.allSettled([
      pool.withRental(async (rental) =>
        rental
          .getExeUnit()
          .then((exe) => exe.run("echo Hello, Golem from the first machine! 👋"))
          .then((res) => console.log(res.stdout)),
      ),
      pool.withRental(async (rental) =>
        rental
          .getExeUnit()
          .then((exe) => exe.run("echo Hello, Golem from the second machine! 👋"))
          .then((res) => console.log(res.stdout)),
      ),
      pool.withRental(async (rental) =>
        rental
          .getExeUnit()
          .then((exe) => exe.run("echo Hello, Golem from the third machine! 👋"))
          .then((res) => console.log(res.stdout)),
      ),
    ]);
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
```

## Features

### Streaming command results

Instead of waiting for the command to finish, you can stream the results as they come in. This is useful for long-running
commands, where you want to see the output as it's being produced.

```ts
const remoteProcess = await exe.runAndStream(
  `
sleep 1
echo -n 'Hello from stdout' >&1
sleep 1
echo -n 'Hello from stdout again' >&1
sleep 1
echo -n 'Hello from stdout yet again' >&1
`,
);
remoteProcess.stdout.on("data", (data) => console.log("stdout>", data));
await remoteProcess.waitForExit();
```

[Check the full example](./examples/basic/run-and-stream.ts)

### File transfer

You can transfer files to and from the remote machine. This is useful when you need to provide input files or retrieve
the results of the computation.

```ts
await exe
  .beginBatch()
  .run(`echo "Message from provider ${exe.provider.name}. Hello 😻" >> /golem/work/message.txt`)
  .downloadFile("/golem/work/message.txt", "./message.txt")
  .end();
console.log(await readFile("./results.txt", { encoding: "utf-8" }));
```

[Check the full example](./examples/basic/transfer.ts)

### VPN

You can connect yourself and multiple providers to a VPN network. This is useful when you want to communicate
securely between the nodes.

```ts
const network = await glm.createNetwork({ ip: "192.168.7.0/24" });
// ...
const exe1 = await rental1.getExeUnit();
const exe2 = await rental2.getExeUnit();
await exe1
  .run(`ping ${exe2.getIp()} -c 4`)
  .then((res) => console.log(`Response from provider: ${exe1.provider.name} (ip: ${exe1.getIp()})`, res.stdout));
```

[Check the full example](./examples/basic/vpn.ts)

### Events

You can listen to various events that are emitted by the SDK. This is useful when you want to react to certain
conditions, like calculating the total cost of all invoices received.

```ts
glm.payment.events.on("invoiceAccepted", (invoice) => {
  console.log("Invoice '%s' accepted for %s GLM", invoice.id, invoice.amount);
});
```

[Check the full example](./examples/basic/events.ts)

### Custom filters

You can define custom filters to select the providers that you want to work with. This is useful when you want to
blacklist or whitelist certain providers.

```ts
const myFilter: ProposalFilter = (proposal) => proposal.provider.name !== "bad-provider";

const order: MarketOrderSpec = {
  market: {
    proposalFilter: myFilter,
    // other options
  },
};
```

[Check the full example](./examples/advanced/proposal-filter.ts)

We have also prepared a set of predefined filters for common use-cases. [Check out the example with predefined filters here](./examples/advanced/proposal-predefined-filter.ts)

### Custom ranking of proposals

You can define a method that will select which proposal should be chosen first. This is useful when you want to
prioritize certain providers over others.

```ts
const scores = {
  "very-good-provider": 10,
  "good-provider": 5,
  "bad-provider": -10,
};

const bestProviderSelector = (proposals: OfferProposal[]) => {
  return proposals.sort((a, b) => (scores[b.provider.name] || 0) - (scores[a.provider.name] || 0))[0];
};

const order: MarketOrderSpec = {
  market: {
    proposalSelector: bestProviderSelector,
    // other options
  },
};
```

[Check the full example](./examples/advanced/proposal-selector.ts)

### Uploading local images to the provider

You can avoid using the registry and upload a GVMI image directly to the provider. This is useful when you want to
quickly prototype your image without having to update the registry with every change.

```ts
const order: MarketOrderSpec = {
  demand: {
    workload: {
      imageUrl: "file:///path/to/your/image.gvmi",
    },
    // other options
  },
};
```

[Check the full example](./examples/advanced//local-image/)

<!--
TODO:
 ### Market scan

You can scan the market for available providers and their offers. This is useful when you want to see what's available
before placing an order.

```ts
await glm.market.scan(order).subscribe({
  next: (proposal) => {
    console.log("Received proposal from provider", proposal.provider.name);
  },
  complete: () => {
    console.log("Market scan completed");
  },
});
```

[Check the full example](./examples/basic/market-scan.ts) -->

## Going further

If you wish to learn more about how the SDK functions under the hood, please check out our more advanced examples:

- [Creating pools manually](./examples/advanced/manual-pools.ts)
- [Performing all market operations manually](./examples/advanced/step-by-step.ts)
- [(for library authors) Override internal module](./examples/advanced/override-module.ts)

## More examples

The [examples directory](./examples) in the repository contains various usage patterns for the SDK. You can browse
through them and learn about the recommended practices. All examples are automatically tested during our release
process.

In case you find an issue with the examples, feel free to submit
an [issue report](https://github.com/golemfactory/golem-js/issues) to the repository.

You can find even more examples and tutorials in
the [JavaScript API section of the Golem Network Docs](https://docs.golem.network/docs/creators/javascript).

## Debugging

The SDK uses the [debug](https://www.npmjs.com/package/debug) package to provide debug logs. To enable them, set the `DEBUG` environment variable to `golem-js:*` or `golem-js:market:*` to see all logs or only the market-related ones, respectively. For more information, please refer to the [debug package documentation](https://www.npmjs.com/package/debug).

## Testing

Read the dedicated [testing documentation](./TESTING.md) to learn more about how to run tests of the SDK.

## Contributing

It is recommended to run unit tests and static code analysis before committing changes.

```bash
yarn lint
# and
yarn format
```

## See also

- [Golem](https://golem.network), a global, open-source, decentralized supercomputer that anyone can access.
- Learn what you need to know to set up your Golem requestor node:
  - [Requestor development: a quick primer](https://docs.golem.network/docs/quickstarts/python-quickstart)
  - [Quick start](https://docs.golem.network/docs/creators/javascript/quickstarts)
- Have a look at the most important concepts behind any Golem
  application: [Golem application fundamentals](https://docs.golem.network/docs/creators/python/guides/application-fundamentals)
- Learn about preparing your own Docker-like images for
  the [VM runtime](https://docs.golem.network/docs/creators/javascript/examples/tools/converting-docker-image-to-golem-format)
- Write your own app with [JavaScript API](https://docs.golem.network/docs/creators/javascript/quickstarts/quickstart)
