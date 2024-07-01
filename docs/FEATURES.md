# Features

## Table of Contents

<!-- TOC -->

- [Features](#features)
  - [Table of Contents](#table-of-contents)
  - [Streaming command results](#streaming-command-results)
  - [File transfer](#file-transfer)
  - [VPN](#vpn)
  - [Events](#events)
  - [Custom filters](#custom-filters)
  - [Custom ranking of proposals](#custom-ranking-of-proposals)
  - [Uploading local images to the provider](#uploading-local-images-to-the-provider)
  - [Setup and teardown methods](#setup-and-teardown-methods)
  - [Market scan](#market-scan)
  - [Read more](#read-more)
  <!-- TOC -->

## Streaming command results

Instead of waiting for the command to finish, you can stream the results as they come in. This is useful for
long-running
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

[Check the full example](../examples/basic/run-and-stream.ts)

## File transfer

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

[Check the full example](../examples/basic/transfer.ts)

## VPN

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

[Check the full example](../examples/basic/vpn.ts)

## Events

You can listen to various events that are emitted by the SDK. This is useful when you want to react to certain
conditions, like calculating the total cost of all invoices received.

```ts
glm.payment.events.on("invoiceAccepted", (invoice) => {
  console.log("Invoice '%s' accepted for %s GLM", invoice.id, invoice.amount);
});
```

[Check the full example](../examples/basic/events.ts)

## Custom filters

You can define custom filters to select the providers that you want to work with. This is useful when you want to
blacklist or whitelist certain providers.

```ts
const myFilter: ProposalFilter = (proposal) => proposal.provider.name !== "bad-provider";

const order: MarketOrderSpec = {
  market: {
    offerProposalFilter: myFilter,
    // other options
  },
};
```

[Check the full example](../examples/advanced/proposal-filter.ts)

We have also prepared a set of predefined filters for common
use-cases. [Check out the example with predefined filters here](../examples/advanced/proposal-predefined-filter.ts)

## Custom ranking of proposals

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

[Check the full example](../examples/advanced/proposal-selector.ts)

## Uploading local images to the provider

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

[Check the full example](../examples/advanced//local-image/)

## Setup and teardown methods

You can define a setup method that will be executed the first time a provider is rented and a teardown method
that will be executed before the rental is done. This is useful when you want to avoid doing the same work
multiple times when running multiple tasks on the same provider.

```ts
// I want to upload a big file to each provider only once
const setup: LifecycleFunction = async (exe) => exe.uploadFile("./big-file.txt", "/golem/work/big-file.txt");

// I want to remove the file after I'm done
const teardown: LifecycleFunction = async (exe) => exe.run("rm /golem/work/big-file.txt");

const pool = await glm.manyOf({
  order,
  poolSize,
  setup,
  teardown,
});
```

[Check the full example](../examples/advanced/setup-and-teardown.ts)

## Market scan

You can scan the market for available providers and their offers. This is useful when you want to see what's available
before placing an order.

```ts
await glm.market
  .scan(order)
  .pipe(takeUntil(timer(10_000)))
  .subscribe({
    next: (scannedOffer) => {
      console.log("Found offer from", scannedOffer.provider.name);
    },
    complete: () => {
      console.log("Market scan completed");
    },
  });
```

[Check the full example](../examples/advanced/scan.ts)

## Read more

If you wish to learn more about how the SDK functions under the hood, please check out our more advanced examples:

- [Creating pools manually](./.../examples/advanced/manual-pools.ts)
- [Performing all market operations manually](./.../examples/advanced/step-by-step.ts)
- [(for library authors) Override internal module](./.../examples/advanced/override-module.ts)
