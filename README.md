# Golem JavaScript API

## Table of contents

<!-- TOC -->

- [Golem JavaScript API](#golem-javascript-api)
  - [Table of contents](#table-of-contents)
  - [What's Golem and `golem-js`?](#whats-golem-and-golem-js)
  - [Golem application development](#golem-application-development)
    - [Installation](#installation)
    - [Building](#building)
    - [Usage](#usage)
      - [Node.js context](#nodejs-context)
      - [Web Browser context](#web-browser-context)
    - [Testing](#testing)
    - [Running unit tests](#running-unit-tests)
    - [Running E2E tests](#running-e2e-tests)
      - [NodeJS](#nodejs)
      - [Cypress](#cypress)
    - [Contributing](#contributing)
  - [Controlling interactions and costs](#controlling-interactions-and-costs)
  - [See also](#see-also)
  <!-- TOC -->

![GitHub](https://img.shields.io/github/license/golemfactory/golem-js)
![npm](https://img.shields.io/npm/v/@golem-sdk/golem-js)
![node-current](https://img.shields.io/node/v/@golem-sdk/golem-js)
![npm type definitions](https://img.shields.io/npm/types/@golem-sdk/golem-js)
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/golemfactory/golem-js/goth.yml)
[![GitHub issues](https://img.shields.io/github/issues/golemfactory/golem-js)](https://github.com/golemfactory/golem-js/issues)
![Discord](https://img.shields.io/discord/684703559954333727?style=flat&logo=discord)

## What's Golem and `golem-js`?

**[The Golem Network](https://golem.network)** fosters a global group of creators building ambitious software solutions
that will shape the technological landscape of future generations by accessing computing resources across the platform.
Golem Network is an accessible, reliable, open access and censorship-resistant protocol, democratizing access to digital
resources and connecting users through a flexible, open-source platform.

**@golem-sdk/golem-js** is the JavaScript API that allows developers to connect to their Golem nodes and manage their
distributed, computational loads through Golem Network.

## Golem application development

For a detailed introduction to using Golem and `@golem-sdk/golem-js` to run your tasks on
Golem [please consult our quickstart section](https://docs.golem.network/creators/javascript/quickstart/).

### Installation

`@golem-sdk/golem-js` is available as a [NPM package](https://www.npmjs.com/package/@golem-sdk/golem-js).

You can install it through `npm`:

```bash
npm install @golem-sdk/golem-js
```

or by `yarn`:

```bash
yarn add @golem-sdk/golem-js
```

### Building

To build a library available to the NodeJS environment:

```bash
npm run build
# or
yarn build
```

This will generate production code in the `dist/` directory ready to be used in your nodejs or browser applications.

### Usage

Hello World

```javascript
import { TaskExecutor } from "@golem-sdk/golem-js";

(async function main() {
  const executor = await TaskExecutor.create("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  await executor.run(async (ctx) => console.log(await ctx.run("echo 'Hello World'")).stdout);
  await executor.end();
})();
```

#### Node.js context

![hello_nodejs](https://user-images.githubusercontent.com/26308335/224720742-1ca115e2-e207-41a7-9537-ffa4ece11406.gif)

#### Web Browser context

![hello_web](https://user-images.githubusercontent.com/26308335/217530424-a1dd4487-f95f-43e6-a91b-7106b6f30802.gif)

For more detailed usage examples and tutorials, see
the [Java Script API section of the Golem Network Docs](https://docs.golem.network/creators/javascript/)

### Testing

### Running unit tests

To run unit tests, you can simply execute the command:

```bash
npm run test:unit
# or
yarn test:unit
```

### Running E2E tests

Both test cases for the NodeJS environment and the browser (cypress) require preparation of a test environment of the
Golem Network with Providers and all the necessary infrastructure. [Goth](https://github.com/golemfactory/goth)
framework is used for this purpose.

To enable E2E testing, you need to ensure that `python -m goth` is executable. Therefore, you must first
install [Goth](https://github.com/golemfactory/goth) according to the instructions described in the readme of the
project.

#### NodeJS

```bash
npm run test:e2e
# or
yarn test:e2e
```

#### Cypress

```bash
npm run test:cypress
# or
yarn test:cypress
```

### Contributing

It is recommended to run unit tests and static code analysis before committing changes.

```bash
yarn lint
# and
yarn format
```

## Controlling interactions and costs

The Golem Network provides an open marketplace where anyone can join as a Provider and supply the network with their
computing power. In return for their service, they are billing Requestors (users of this SDK) according to the pricing
that they define. As a Requestor, you might want to:

- control the limit price so that you're not going to over-spend your funds
- control the interactions with the providers if you have a list of the ones which you like or the ones which you would
  like to avoid

To make this easy, we provided you with a set of predefined market proposal filters, which you can combine to implement
your own market strategy. For example:

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

To learn more about other filters, please check the [API reference of the market/strategy module](https://docs.golem.network/docs/golem-js/reference/modules/market_strategy)

## See also

- [Golem](https://golem.network), a global, open-source, decentralized supercomputer that anyone can access.
- Learn what you need to know to set up your Golem requestor node:
  - [Requestor development: a quick primer](https://handbook.golem.network/requestor-tutorials/flash-tutorial-of-requestor-development)
  - [Quick start](https://docs.golem.network/creators/javascript/quickstart/)
- Have a look at the most important concepts behind any Golem
  application: [Golem application fundamentals](https://handbook.golem.network/requestor-tutorials/golem-application-fundamentals)
- Learn about preparing your own Docker-like images for
  the [VM runtime](https://handbook.golem.network/requestor-tutorials/vm-runtime)
- Write your own app with [JavaScript API](https://docs.golem.network/creators/javascript/high-level/task-model/)
