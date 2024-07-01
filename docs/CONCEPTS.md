# Concepts

This document explains the concepts modelled by the SDK which foster your interactions with the Golem Network.

## Table of Contents

<!-- TOC -->

- [Concepts](#concepts)
  - [Table of Contents](#table-of-contents)
  - [GolemNetwork module](#golemnetwork-module)
    - [Why is it needed](#why-is-it-needed)
    - [What should it do](#what-should-it-do)
    - [How it was done](#how-it-was-done)
  - [Resource Rental Model](#resource-rental-model)
    - [Why it is needed](#why-it-is-needed)
    - [What it should do](#what-it-should-do)
    - [How it was done](#how-it-was-done-1)
    - [How is it different from TaskExecutor available in versions `1.x` and `2.x`](#how-is-it-different-from-taskexecutor-available-in-versions-1x-and-2x)
  - [Exe Unit](#exe-unit)
    - [Why is it needed](#why-is-it-needed-1)
    - [What it should do](#what-it-should-do-1)
    - [How it was done](#how-it-was-done-2)
    <!-- TOC -->

## GolemNetwork module

### Why is it needed

When picturing the problem domain which is tackled by Golem Network, one see that the activities performed in this domain can fall into the following categories:

- **Market** - where the computational needs of the Requestors need to meet the offers of the Providers, so that they can negotiate and establish an agreement.
- **Activity** - where Activities are started on ExeUnits running on the Providers under the terms of the negotiated Agreement.
- **Work** - where the Requestors preform their operations on the acquired resources (within the started activities).
- **Payment** - where payment related entities (DebitNotes, Invoices) are exchanged and final payments are made by the Requestor to the Provider.

With `golem-js` we help you (the Requestor) by taking care of the _Market_, _Activity_ and _Payments_ faucets of the domain.

### What should it do

The `GolemNetwork` should serve as the main entry-point for `golem-js`. Users are expected to create new instances of this object, use `connect` and `disconnect` methods properly to feel the notion of "connecting" to the Golem Network.

```ts
import { GolemNetwork } from "@golem-sdk/golem-js";

const glm = new GolemNetwork();

try {
  await glm.connect();

  // Do your work here
} catch (err) {
  // Handle any errors
} finally {
  await glm.disconnect();
}
```

Once the user _connects_ to the network (in reality, connecting to the locally installed `yagna`), they have two was of leveraging the API's of that object.

1. Use high-level generic purpose APIs such as `oneOf` or `manyOf` to acquire computational resources, without the need of diving deep into the various subdomains within Golem Network's problem space.
2. Use low-level modules representing these subdomains by accessing `glm.market`, `glm.activity`, `glm.payment` properties of the `GolemNetwork` object.

### How it was done

We do this by shaping modules reflecting these subdomains and exposing them from `golem-js` in form of properties of the `GolemNetwork` object. This way, you can rely on `golem-js` in these three areas and focus on your field of expertise, which is _Work_.

## Resource Rental Model

### Why it is needed

The [Golem Network's whitepaper](https://assets.website-files.com/62446d07873fde065cbcb8d5/62446d07873fdeb626bcb927_Golemwhitepaper.pdf) coined the following definition:

> Golem connects computers in a peer-to-peer network, enabling both application
> owners and individual users ("requestors") to rent resources of other users’
> ("providers") machines. These resources can be used to complete tasks requiring any
> amount of computation time and capacity.

Since version `3.0`, `golem-js` leverages the notion of _renting compute resources_ and models the exposed domain APIs around it.

### What it should do

The primary tasks for the model to deliver are:

- provide an abstraction over the complexity of _Golem Network Protocol_ and leverage the "rent compute resources, access agreement and cost information"
- shorten the path of the user required to access a deployed instance of their workload
- provide convenience APIs that allow easier exploration of the Golem Network domain (example: `rental.agreement.provider` allows _easier_ access to Provider information)

### How it was done

To deliver this vision, `golem-js` exposes the `ResourceRental` **aggregate** which wraps around the details of the _Golem Network Protocol_: the loosely coupled entities which it defines, and the processes/communication schemes which it requires. These include things _Agreements_, _Allocations_, _Activities_, _Invoices_, _DebitNotes_ and related conversations required by the protocol such as _debit note or invoice acceptance_ between Provider and Requestor (you).

When using the `ResourceRental` model, you can still access these lower level domain objects via the APIs exposed by the `ResourceRental` object instance.

### How is it different from TaskExecutor available in versions `1.x` and `2.x`

`TaskExecutor` implemented the so-called _Task Model_, which is oriented around the notion of a _Task_ defined as a series of commands to be executed that have to succeed altogether for the task to be considered as successful. While this model is suitable for use-cases involving batch-map-reduce type of operations that can be distributed across many rented resources, it falls short in cases where users want to rent out resources and execute long-running activities such as hosting web services for many users (multi-tenancy).

## Exe Unit

### Why is it needed

When you obtain resources via the Golem Network, your _Golem Virtual Machine Image (GVMI for short)_ is going to be deployed by `golem-js` into the _Activity_ running on the Provider. Technically, on the Provider instantiates an _ExeUnit_ which is a physical implementation of the _Activity_ of the Golem Network Protocol. Without digging in too much details, it's this _ExeUnit_ which at the end performs the operations that you issue via the Golem Network.

As a Requestor you're interested in quickly executing your commands within the container that runs your image. The `ExeUnit` abstraction delivered by the SDK is meant to do enable you to do so. The `ExeUnit` type documents the available features of particular ExeUnit type so that you can build up your solution faster, and in a type-safe manner.

### What it should do

The delivered `ExeUnit` implementation is a **use case** object which exposes APIs that simplify the interaction with the exe-unit running on the Provider. Technically, it models the _commands_ supported by the exe-unit depending on its runtime, so that the user can focus on issuing `exe.upload` or `exe.run` commands instead of understanding the implementation details of the VM exe-unit runtime.

### How it was done

Given a Requestor obtains `ResourceRental`, they can obtain the handle to the exe-unit thanks to `getExeUnit` method.
