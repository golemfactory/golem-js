# Testing

This document provides guidance for testing the SDK.

## Running unit tests

To run unit tests, you can simply execute the command:

```bash
npm run test:unit
# or
yarn test:unit
```

## Running E2E tests

Both test cases for the NodeJS environment and the browser (cypress) require preparation of a test environment of the
Golem Network with Providers and all the necessary infrastructure.

### Prerequisites

1. Ensure you have `docker` and `docker-compose` installed in your system.
2. Your Linux environment should have nested virtualization enabled.

### Test Environment Preparation

Follow these steps to prepare your test environment:

#### Build Docker Containers

First, build the Docker containers using the `docker-compose.yml` file located under `tests/docker`.

Execute this command to build the Docker containers:

    docker-compose -f tests/docker/docker-compose.yml build

#### Start Docker Containers

Then, launch the Docker containers you've just built using the same `docker-compose.yml` file.

Execute this command to start the Docker containers:

    docker-compose -f tests/docker/docker-compose.yml down && docker-compose -f tests/docker/docker-compose.yml up -d

#### Fund the Requestor

The next step is to fund the requestor.

    docker exec -t docker_requestor_1 /bin/sh -c "/golem-js/tests/docker/fundRequestor.sh"

### Install and Build the SDK

Finally, install and build the golem-js SDK in the Docker container

Run this chain of commands to install and build the SDK and prepare cypress.

```docker
docker exec -t docker_requestor_1 /bin/sh -c "cd /golem-js && npm i && npm run build && ./node_modules/.bin/cypress install"
```

### Execute the E2E Tests

With your test environment set up, you can now initiate the E2E tests. Run the following command to start:

```docker
docker exec -t docker_requestor_1 /bin/sh -c "cd /golem-js && npm run test:e2e"
```

### Execute the cypress Tests

First make sure that the webserver that's used for testing is running, by running the command

```docker
docker exec -t -d docker_requestor_1 /bin/sh -c "cd /golem-js/examples/web && node app.mjs"
```

Now you're ready to start the cypress tests by running the command

```docker
docker exec -t docker_requestor_1 /bin/sh -c "cd /golem-js && npm run test:cypress -- --browser chromium"
```
