# External API request

Example showing how to make a REST call to an external, public API from a VM running on a Provider node.

Computation Payload Manifest making use of Outbound Network requires either:

1. Requestor certificate that's trusted by the Providers
2. an instance of a Provider with the particular domain this example uses added to its domain whitelist
3. an instance of a Provider with the requestor's self-signed Certificate imported into its keystore

The following example will show cases 2. and 3. so it will be necessary to start a local instance of a Provider.
