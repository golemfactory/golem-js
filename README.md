<br />

<p align=center>
 <img src=https://repository-images.githubusercontent.com/293524572/b8635cf6-9653-416d-ae56-bc9c6a43e503 alt="golem-js SDK logo" width=480 />
</p>

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
  - [Features](#features)
  - [Getting Started](#getting-started)
    - [What's Golem and `golem-js`?](#whats-golem-and-golem-js)
    - [SDK Learning resources](#sdk-learning-resources)
  - [Installation](#installation)
  - [Supported environments](#supported-environments)
  - [Getting started with Golem Network](#getting-started-with-golem-network)
    - [Obtain an `app-key` to use with SDK](#obtain-an-app-key-to-use-with-sdk)
  - [Usage](#usage)
  - [Examples](#examples)
  - [Documentation](#documentation)
  - [Debugging](#debugging)
  - [Testing](#testing)
  - [Contributing](#contributing)
  - [Discord](#discord)
  - [See also](#see-also)
  <!-- TOC -->

## Features

Become a **Requestor** in the **Golem Network** and use this SDK to:

- 🌐 Acquire compute resources from Providers using a convenient API
- 🚢 Run your workloads with these resources and get the results back to your machine
- 🔐 Build N-tier application deployments and run them within a VPN
- 💰 Settle payments with Providers for the resources you've utilized

## Getting Started

### What's Golem and `golem-js`?

**[The Golem Network](https://golem.network)** fosters a global group of creators building ambitious software solutions
that will shape the technological landscape of future generations by accessing computing resources across the platform.
Golem Network is an accessible, reliable, open access and censorship-resistant protocol, democratizing access to digital
resources and connecting users through a flexible, open-source platform.

**golem-js** is the JavaScript API that allows developers to connect to their Golem nodes and manage their
distributed, computational loads through Golem Network.

### SDK Learning resources

- [Basic concepts documentation](./docs/CONCEPTS.md) - Learn about the basic and advanced building blocks at your
  disposal.
- [Usage documentation](./docs/USAGE.md) - Explore supported usage and implementation patterns.
- [Feature documentation](./docs/FEATURES.md) - Description of interesting features that we've prepared.

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
communicates and performs operations on the Golem Network, upon your requests via the SDK. You can follow the
instructions below or visit
the [official documentation](https://docs.golem.network/docs/creators/javascript/quickstarts/quickstart#install-yagna-2)
to set it up.

```bash
# Join the network as a requestor
curl -sSf https://join.golem.network/as-requestor | bash -

# Start the golem node on your machine,
# you can use `daemonize` to run this in background
yagna service run
```

Now that you have `yagna` running, you can initialize your requestor and request funds (`tGLM` tokens) on the test
network.

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

You can rent a single machine and run a simple task on it:

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
    const rental = await glm.oneOf({ order });
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

Read about [other available usage patterns](./docs/USAGE.md) to learn more on how you can leverage the SDK.

## Examples

The [examples directory](./examples) in the repository contains various usage patterns for the SDK. You can browse
through them and learn about the recommended practices. All examples are automatically tested during our release
process.

You can find even more examples and tutorials in
the [JavaScript API section of the Golem Network Docs](https://docs.golem.network/docs/creators/javascript).

## Documentation

Visit our [official documentation](https://docs.golem.network/docs/creators/javascript) to learn more about the
JavaScript SDK and how to use it.

## Debugging

The SDK uses the [debug](https://www.npmjs.com/package/debug) package to provide debug logs. To enable them, set
the `DEBUG` environment variable to `golem-js:*` or `golem-js:market:*` to see all logs or only the market-related ones,
respectively. For more information, please refer to
the [debug package documentation](https://www.npmjs.com/package/debug).

## Testing

Read the dedicated [testing documentation](./docs/TESTING.md) to learn more about how to run tests of the SDK.

## Contributing

Read the [Contributing Guide](docs/CONTRIBUTING.md) for details on how you can get involved. In case you find an issue with the examples or the SDK itself, feel free to submit
an [issue report](https://github.com/golemfactory/golem-js/issues) to the repository.

## Discord

Feel invited to join our [Discord](http://discord.gg/golem). You can meet other SDK users and developers in the `#sdk-discussion` and `#js-discussion` channels.

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
