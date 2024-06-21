# Concepts

This document explains the concepts modelled by the SDK which foster your interactions with the Golem Network.

## Table of Contents

<!-- TOC -->

- [Concepts](#concepts)
  - [Table of Contents](#table-of-contents)
  - [Resource Rental Model](#resource-rental-model)
    - [Why it is needed](#why-it-is-needed)
    - [What it should do](#what-it-should-do)
    - [How it was done](#how-it-was-done)
    - [How is it different from TaskExecutor available in versions `1.x` and `2.x`](#how-is-it-different-from-taskexecutor-available-in-versions-1x-and-2x)
  - [Exe Unit](#exe-unit)
    - [Why is it needed](#why-is-it-needed)
    - [What it should do](#what-it-should-do-1)
    - [How it was done](#how-it-was-done-1)
  <!-- TOC -->

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

When you obtain resources via the Golem Network, your _Golem Virtual Machine Image (GVMI for short)_ is going to be deployed for you by the SDK on the Provider within an _exe-unit_ started within an _activity_ created on the Provider.

If you're familiar with containers, you can picture the architecture in the following way:

| Golem    | Docker       | Kubernetes   |
| -------- | ------------ | ------------ |
| GVMI     | Docker Image | Docker Image |
| Exe Unit | Container    | Container    |
| Activity |              | Pod \*       |

`*` - in Golem you can have only one ExeUnit (container) within an Activity, while Kubernetes Pods can host multiple containers.

> **DISCLAIMER**
>
> The above comparison is used only for illustrative purposes. Golem GVMIs, ExeUnits and Activities behave differently compared to Docker or Kubernetes.

As a Requestor you're interested in quickly executing your commands within the container that runs youre image. The `ExeUnit` abstraction delivered by the SDK is meant to do enable you to do so.

### What it should do

The delivered `ExeUnit` implementation is a **use case** object which exposes APIs that simplify the interaction with the exe-unit running on the Provider. Technically, it models the _commands_ supported by the exe-unit depending on its runtime, so that the user can focus on issuing `exe.upload` or `exe.run` commands instead of understanding the implementation details of the VM exe-unit runtime.

### How it was done

Given a Requestor obtains `ResourceRental`, they can obtain the handle to the exe-unit thanks to `getExeUnit` method.
