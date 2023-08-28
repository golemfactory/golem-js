# External API request

Example showing how to make a REST call to an external, public API from a VM running on a Provider node.

## Prerequisites

Computation Payload Manifest making use of Outbound Network requires either:

1. Requestor certificate that's trusted by the Providers
2. an instance of a Provider with the particular domain this example uses added to its domain whitelist
3. an instance of a Provider with the requestor's self-signed Certificate imported into its keystore

The following example will show cases 2. and 3. so it will be necessary to start a local instance of a Provider.

## Example app

An example app will request an external API using Provider's network and then it will print the API response to the console.

### 1. Manifest file

For an app to make an _Outbound Network_ request it needs to declare which tools it will use and which URLs it will access in a manifest file.

This example will make an HTTPS request using `curl` to a public REST API with the URL `https://api.coingecko.com`.

_Computation Payload Manifest_ will need to have following objects:

- [`net`](../vm-runtime/computation-payload-manifest.md#compmanifestnet--object) computation constraints with `URL`s the app will access (`https://api.coingecko.com`)
- [`script`](../vm-runtime/computation-payload-manifest.md#compmanifestscript) computation constraint with `command`s app will execute (`curl`)
- [`payload`](../vm-runtime/computation-payload-manifest.md#payload-object) defining golem image containing tools used by the app (`curl`)

Example _Computation Payload Manifest_ must follow a specific schema, and for our example it will take form of following `manifest.json` file.

### 2. Verification of a request with Computation Payload Manifest

_Providers_ verify the incoming request with a _Computation Payload Manifest_ by checking if it arrives with a signature and _App author's certificate_ signed by a certificate they trust. If there is no signature, they verify if URLs used by _Computation Payload Manifest_ are whitelisted.

There are two ways to make our _local_ _Provider_ verify the request:

- #### Whitelisting of the domain used by the app

  - Add `api.coingecko.com` to Provider's domain whitelist: `ya-provider whitelist add --patterns api.coingecko.com --type strict`

  - And set outbound mode to `Everyone: whitelist`: `ya-provider rule set outbound everyone --mode whitelist`

- #### Signing manifest and adding signature with a certificate to the request

  Generate self signed certificate and then generate manifest signature.

  With a generated certificate and a signature, you can pass them to the Executor options as follow:

```ts
const executor = await TaskExecutor.create({
  manifest: Buffer.from(readFileSync(`${__dirname}/manifest.json`, "utf-8")).toString("base64"),
  manifestSig: readFileSync(`${__dirname}/manifest.json.base64.sign.sha256.base64`, "utf-8"),
  manifestCert: readFileSync(`${__dirname}/golem-manifest.crt.pem.base64`, "utf-8"),
  manifestSigAlgorithm: "sha256",
  capabilities: ["inet", "manifest-support"],
});
```

### 3. Launching the app

With both _Requestor_ and _Provider_ yagna nodes and `ya-provider` running in the background run:

```sh
npm run external-request
```

(keep in mind to set `YAGNA_APPKEY` env variable pointing to the local _Requestor_ node)
