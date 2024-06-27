# Contributing

You want to contribute to `golem-js`? That's great! This guide will help you get started.

## Setup local environment

1. Clone this repository
2. In the root of this project run `npm install` to install all necessary dependencies
3. To build the SDK run `npm run build`
4. Install yagna as described in the [README](../README.md) file - you will need it to test your changes against testnet (no real funds will be required to execute workloads on Golem Network)

### Unit Testing

For unit testing `golem-js` uses `jest` with [ts-mockito](https://www.npmjs.com/package/@johanblumenberg/ts-mockito) to mock code.

You can run tests using:

```bash
npm run test:unit
```

The test files are usually co-located with the files that they test in the `src/` folder.

### Pre-commit hooks

We use `husky` to enforce few rules using `prettier`, `eslint` or even commit message format which allows us to use [semantic-release](https://github.com/semantic-release/semantic-release).

## Pull Request Guidelines

Our development revolves around few branches:

- `master` - contains the latest stable production code (production track)
- `beta` - where the SDK team developers next major releases (slow track)
- `alpha` - when a different major release has to take precedence before `beta` (fast track)

The process is as follows:

- Depending on the contribution you're planning to make, create a `feature/`, `bugfix/` branch from the base branch (typically `master`), and merge back against that branch.
- In case of any contribution:
  - Make sure you provide proper description for the PR (see template below)
  - Add test cases if possible within the same PR

### PR description templates

#### Feature

```markdown
## Why is it needed?

_Explain why the feature is valuable and what problem does it solve._

## What should be changed?

_Explain the general idea behind the code changes - high level description of your solution to the problem stated above._
```

#### Bugfix

```markdown
## Steps to reproduce

1. _Do this_
2. _Then that_
3. _Finally this_

## Expected result

_Describe the desired outcome (how does fixed look like)_

## Actual result

_Describe the actual outcome (what happens now)_
```

## Discord

Feel invited to join our [Discord](http://discord.gg/golem). You can meet other SDK users and developers in the `#sdk-discussion` and `#js-discussion` channels.

## Thanks 💙

Thanks for all your contributions and efforts towards improving `golem-js`!
