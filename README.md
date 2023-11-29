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
  - [System requirements](#system-requirements)
  - [Installation](#installation)
  - [Building](#building)
  - [Usage](#usage)
    - [Hello World example](#hello-world-example)
    - [More examples](#more-examples)
    - [Node & Browser support](#node--browser-support)
  - [Golem Network Market Basics](#golem-network-market-basics)
    - [Mid-agreement payments to the Providers for used resources](#mid-agreement-payments-to-the-providers-for-used-resources)
    - [Limit price limits to filter out offers that are too expensive](#limit-price-limits-to-filter-out-offers-that-are-too-expensive)
    - [Work with reliable providers](#work-with-reliable-providers)
  - [Testing](#testing)
  - [Contributing](#contributing)
  - [See also](#see-also)
  <!-- TOC -->

## What's Golem and `golem-js`?

**[The Golem Network](https://golem.network)** fosters a global group of creators building ambitious software solutions
that will shape the technological landscape of future generations by accessing computing resources across the platform.
Golem Network is an accessible, reliable, open access and censorship-resistant protocol, democratizing access to digital
resources and connecting users through a flexible, open-source platform.

**golem-js** is the JavaScript API that allows developers to connect to their Golem nodes and manage their
distributed, computational loads through Golem Network.

## System requirements

To use `golem-js` you need to have `yagna` installed at least in version `v0.13.2`. Yagna is a service that communicates and performs operations on the Golem Network, upon your requests via the SDK. You can [follow these instructions](https://docs.golem.network/docs/creators/javascript/quickstarts/quickstart#install-yagna-2) to set it up.

## Installation

`@golem-sdk/golem-js` is available as a [NPM package](https://www.npmjs.com/package/@golem-sdk/golem-js).

You can install it through `npm`:

```bash
npm install @golem-sdk/golem-js
```

or by `yarn`:

```bash
yarn add @golem-sdk/golem-js
```

## Building

To build a library available to the NodeJS environment:

```bash
npm run build
# or
yarn build
```

This will generate production code in the `dist/` directory ready to be used in your nodejs or browser applications.

## Usage

### Hello World example

```ts
import { TaskExecutor } from "@golem-sdk/golem-js";

(async () => {
  const executor = await TaskExecutor.create("golem/alpine:latest");
  await executor.run(async (ctx) => console.log(await ctx.run("echo 'Hello World'")).stdout);
  await executor.shutdown();
})().catch((err) => console.error(err, "Error in main"));
```

### More examples

The [examples directory](./examples) in the repository contains various usage patterns for the SDK. You can browse through them and learn about the recommended practices. All examples are automatically tested during our release process.

In case you find an issue with the examples, feel free to submit an [issue report](https://github.com/golemfactory/golem-js/issues) to the repository.

You can find even more examples and tutorials in the [JavaScript API section of the Golem Network Docs](https://docs.golem.network/docs/creators/javascript).

### Node & Browser support

The SDK is designed to work with LTS versions of Node (starting from 18)

![hello_nodejs](https://user-images.githubusercontent.com/26308335/224720742-1ca115e2-e207-41a7-9537-ffa4ece11406.gif)

and with browsers

![hello_web](https://user-images.githubusercontent.com/26308335/217530424-a1dd4487-f95f-43e6-a91b-7106b6f30802.gif)

## Golem Network Market Basics

The Golem Network provides an open marketplace where anyone can join as a Provider and supply the network with their
computing power. In return for their service, they are billing Requestors (users of this SDK) according to the pricing
that they define.

As a Requestor, you might want to:

- control the limit price so that you're not going to over-spend your funds
- control the interactions with the providers if you have a list of the ones which you like or the ones which you would
  like to avoid

To make this easy, we provided you with a set of predefined market proposal filters, which you can combine to implement
your own market strategy (described below).

### Mid-agreement payments to the Providers for used resources

When you obtain resources from the Provider and start using them, the billing cycle will start immediately.
Since reliable service and payments are important for all actors in the Golem Network,
the SDK makes use of the mid-agreement payments model and implements best practices for the market, which include:

- responding and accepting debit notes for activities that last longer than 30 minutes
- issuing mid-agreement payments (pay-as-you-go)

By default, the SDK will:

- accept debit notes sent by the Providers within 2 minutes from receiving them (so that the Provider knows that we're alive, and it will continue serving the resources)
- issue a mid-agreement payment each 12 hours (so that the provider will be paid on a regular interval for serving the resources for more than 10 hours)

You can learn more about
the [mid-agreement and other payment models from the official docs](https://docs.golem.network/docs/golem/payments).

These values are defaults and can be influenced by the following settings:

- `DemandOptions.expirationSec`
- `DemandOptions.debitNotesAcceptanceTimeoutSec`
- `DemandOptions.midAgreementPaymentTimeoutSec`

If you're using `TaskExecutor` to run tasks on Golem, you can pass them as part of the configuration object accepted
by `TaskExecutor.create`. Consult [JS API reference](https://docs.golem.network/docs/golem-js/reference/overview) for
details.

### Limit price limits to filter out offers that are too expensive

```typescript
import { TaskExecutor, ProposalFilters } from "@golem-sdk/golem-js";

const executor = await TaskExecutor.create({
  // What do you want to run
  package: "golem/alpine:3.18.2",

  // How much you wish to spend
  budget: 0.5,
  proposalFilter: ProposalFilters.limitPriceFilter({
    start: 1,
    cpuPerSec: 1 / 3600,
    envPerSec: 1 / 3600,
  }),

  // Where you want to spend
  payment: {
    network: "polygon",
  },
});
```

To learn more about other filters, please check
the [API reference of the market/strategy module](https://docs.golem.network/docs/golem-js/reference/modules/market_strategy)

### Work with reliable providers

The `getHealthyProvidersWhiteList` helper will provide you with a list of Provider ID's that were checked with basic
health-checks. Using this whitelist will increase the chance of working with a reliable provider. Please note, that you
can also build up your own list of favourite providers and use it in a similar fashion.

```typescript
import { TaskExecutor, ProposalFilters, MarketHelpers } from "@golem-sdk/golem-js";

// Prepare the price filter
const acceptablePrice = ProposalFilters.limitPriceFilter({
  start: 1,
  cpuPerSec: 1 / 3600,
  envPerSec: 1 / 3600,
});

// Collect the whitelist
const verifiedProviders = await MarketHelpers.getHealthyProvidersWhiteList();

// Prepare the whitelist filter
const whiteList = ProposalFilters.whiteListProposalIdsFilter(verifiedProviders);

const executor = await TaskExecutor.create({
  // What do you want to run
  package: "golem/alpine:3.18.2",

  // How much you wish to spend
  budget: 0.5,
  proposalFilter: async (proposal) => (await acceptablePrice(proposal)) && (await whiteList(proposal)),

  // Where you want to spend
  payment: {
    network: "polygon",
  },
});
```

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
  - [Requestor development: a quick primer](https://handbook.golem.network/requestor-tutorials/flash-tutorial-of-requestor-development)
  - [Quick start](https://docs.golem.network/docs/creators/javascript/quickstarts)
- Have a look at the most important concepts behind any Golem
  application: [Golem application fundamentals](https://handbook.golem.network/requestor-tutorials/golem-application-fundamentals)
- Learn about preparing your own Docker-like images for
  the [VM runtime](https://handbook.golem.network/requestor-tutorials/vm-runtime)
- Write your own app with [JavaScript API](https://docs.golem.network/docs/creators/javascript/quickstarts/quickstart)
