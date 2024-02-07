# Golem Backend

## TODO

- [ ] Brainstorm the naming used in this API
  - GolemBackend
  - GolemInstance
  - Golem - To prefix or not to prefix?
- [ ] Networking
- [ ] Add missing event activityDeployError
- [ ] Implement passing abortController into services
- [ ] Add abortControllers to commands
  - Should commands accept additional abort controllers?
    - Command should be aborted when backend is being shut down
    - Command should be aborted when only the instance is being destroyed
    - Command could be aborted if user wants to abort current command without aborting
      the entire instance. This might already be possible if we delete the batach that
      is being executed, but we would need to expose this functionality to the user.
      Use-case: Ctrl+C in `run-on-golem`

## Networking

### Use-case: Basic

In this use-case, we want minimal setup and we want to use the default network configuration.

```typescript
const backend1 = new GolemBackend({
  networking: "10.0.0.0/24",
});
```

Features:

- The backend will be responsible for creating and destroying the network.
- Requestor will be added to the network
  (considering later use-cases, `Network` factory should include an option for that)
- Backend will add every instance it creates to this network.

> **To Discuss:** Also to consider even easier setup. Since on provider, app can bind to 0.0.0.0 and
> on requestor we use a websocket to connect to a specific host (reference by nodeId, not IP address),
> we could skip the IP configuration and have a default network setup.
>
> ```typescript
> const backend1 = new GolemBackend({
>   networking: true,
> });
> ```

### Use-case: Without requestor node

> **Note:** This use-case will make more sense later on, with deployments.

With minimal setup, we want to use the network configuration, but we don't want to add the requestor node to the network.
This is useful if only the instances are supposed to talk to each other.

```typescript
// Option by network object
const network = await Network.create({
  yagnaApi,
  network: "10.0.0.0/24",
});
const backend1 = new GolemBackend({
  networking: network,
});

// Teardown
backend1.stop(); // destroy privately created network
network.stop(); // destroy network
```

### Use-case: Multiple networks

When doing more advanced setups, with multiple backends (for different images), or later on with deployments,
multiple networks might be needed.

```typescript
const networks = new NetworkManager(yagnaAPI);
const net1 = await networks.create("network1", {
  network: "10.0.0.0/24",
  client: true, // Add requestor node to the network
});
const net2 = await networks.create("network2", {
  network: "10.0.1.0/24",
  // Do not add requestor node to the network
});

const backend1 = new GolemBackend({
  networking: [net1, net2],
});
const backend2 = new GolemBackend({
  networking: [networks.get("network1")],
});

// Teardown
await backend1.stop(); // on activity destroy, remove activity from networks
await backend2.stop();
await networks.stop();
```

> **Note:** `NetworkManager` is not needed for the start, it can be implemented later, just before GolemDeployment

### Accessing provider network

There need to be an accessor that will return the websocket URL.

```typescript
const url = instance.network().getWebsocketUrl(80); // throws error - requestor not connected to network
```

Bellow are some signatures to consider for `network()`:

`.network()` will return the first network the instance is connected to. If the instance is connected to multiple network 'configuration' object.

`.network(index)` will return the network at given index.

`.network(id)` will return the network with given network ID.

`.network(networkObject)` will return the network with given network.

`.network(name)` will return the network with given name. (Tagging networks might make sense, especially for remote agent)

The synchronous nature of this setup could be an issue in the future for requestor agent setup, as network configuration
might change over time.
This can be addressed either by listening for changes in the instance/activity or by providing a dedicated method
to update network status or the entire instance configuration.
