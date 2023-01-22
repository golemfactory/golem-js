# Ya*JS*api 0.7.0

Introducing a new version of the JavaScript SDK. The new version provides several important changes:
* Completely new simplified API
* Split into High-level and Mid-level api
* Support from both Node and popular browsers

## Two distributions of SDK
Currently, the SDK is available in two different versions, both for browser(WebRequestor) and for Node. Depending on the expected use case, the build process varies:
* [Node version](internal_docs/node.md)
* [Browser version - WebRequestor](internal_docs/webrequestor.md)

## Tutorial - How to get started
If you are already familiar with the above two sections on the available API distributions, we would like to invite you to learn about how to quickly start working with a new version of the SDK in our [tutorial](internal_docs/tutorial.md).

## Testing
You can run the tests using following commands.

| Command NPM                | Command Yarn            | Description       | 
|----------------------------|-------------------------|-------------------|
| `npm run test:unit`        | `yarn test:unit`        | Unit tests        |
| `npm run test:integration` | `yarn test:integration` | Integration tests |
| `npm run test:cypress`     | `yarn test:cypress`     | Cypress tests     |

## Code coverage
In the new version of the SDK, we have focused on more test coverage to make our development more efficient. You can check the test coverage using the following commands

TODO table with description in here