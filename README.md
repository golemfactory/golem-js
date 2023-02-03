# Golem JavaScript API

![GitHub](https://img.shields.io/github/license/golemfactory/yajsapi)
![npm](https://img.shields.io/npm/v/yajsapi) 
![node-current](https://img.shields.io/node/v/yajsapi)
![npm type definitions](https://img.shields.io/npm/types/yajsapi)
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/golemfactory/yajsapi/goth.yml)
[![GitHub issues](https://img.shields.io/github/issues/golemfactory/yajsapi)](https://github.com/golemfactory/yajsapi/issues)
![Discord](https://img.shields.io/discord/684703559954333727?style=flat&logo=discord)

## What's Golem and yajsapi?

**[The Golem Network](https://golem.network)** fosters a global group of creators building ambitious software solutions that will shape the technological landscape of future generations by accessing computing resources across the platform. Golem Network is an accessible, reliable, open access and censorship-resistant protocol, democratizing access to digital resources and connecting users through a flexible, open-source platform.

**Yajsapi** is the JavaScript API that allows developers to connect to their Golem nodes and manage their distributed, computational loads through Golem Network.

## Golem application development

For a detailed introduction to using Golem and yajsapi to run your tasks on Golem and a guide to Golem Network application development in general, [please consult our handbook](https://handbook.golem.network/requestor-tutorials/flash-tutorial-of-requestor-development).

### Installation

`yajsapi` is available as a [NPM package](https://www.npmjs.com/package/yajsapi/).

You can install it through `npm`:

```bash
npm install yajsapi
```
or by `yarn`:

```bash
yarn add yajsapi
```

### Building

To build a library available to the nodejs environment:

```bash
npm run build
```

or

```bash
yarn build
```

This will generate production code in the `dist/` directory ready to be used in your nodejs applications.

To build a browser runnable library:

```bash
npm run build:browser
```

or 

```bash
yarn build:browser
```

Then include `dist/yajsapi.min.js` in your html file.

### API Reference

For a comprehensive API reference, please refer to [our official API reference page](https://handbook.golem.network/yajsapi/docs).

### Usage

Hello World

```javascript
import { TaskExecutor } from "yajsapi";

(async function main() {
  const executor = await TaskExecutor.create("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  await executor.run(async (ctx) => console.log(await ctx.run("echo 'Hello World'")).stdout);
  await executor.end();
})();
```

#### Node.js context
![](docs/assets/hello_nodejs.gif)

#### Web Browser context
![](docs/assets/hello_web.gif)

For more detailed usage examples and tutorials, see the [Java Script API section of the Handbook](https://handbook.golem.network/yajsapi/)

### Testing

### Running unit tests

To run unit tests, you can simply execute the command:

```bash
npm run test:unit
```

or

```bash
yarn test:unit
```

### Running integration tests

Both test cases for the nodejs environment and the browser (cypress) require preparation of a test environment of the golem network with providers and all the necessary infrastructure. [Goth](https://github.com/golemfactory/goth) framework is used for this purpose..

To enable integration testing, you need to ensure that `python -m goth` is executable. Therefore, you must first install [Goth](https://github.com/golemfactory/goth) according to the instructions described in the readme of the project.

#### Nodejs

```bash
npm run test:integration
```

or

```bash
yarn test:integration
```

#### Cypress

```bash
npm run test:cypress
```

or

```bash
yarn test:cypress
```

### Contributing

It is recommended to run unit tests and static code analysis before committing changes.

```bash
yarn lint
```

and

```bash
yarn format
```

## See also

* [Golem](https://golem.network), a global, open-source, decentralized supercomputer that anyone can access.
* Learn what you need to know to set-up your Golem requestor node:
    * [Requestor development: a quick primer](https://handbook.golem.network/requestor-tutorials/flash-tutorial-of-requestor-development)
    * [Run first task on Golem](https://handbook.golem.network/requestor-tutorials/flash-tutorial-of-requestor-development/run-first-task-on-golem)
* Have a look at the most important concepts behind any Golem application: [Golem application fundamentals](https://handbook.golem.network/requestor-tutorials/golem-application-fundamentals)
* Learn about preparing your own Docker-like images for the [VM runtime](https://handbook.golem.network/requestor-tutorials/vm-runtime)
