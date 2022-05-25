## CodeceptJS Configuration Hooks [![Build Status](https://travis-ci.org/codeceptjs/configure.svg?branch=master)](https://travis-ci.org/codeceptjs/configure)

Configuration hook helps you update CodeceptJS configuration at ease.

Those hooks are expected to simplify configuration for common use cases.

**Requires CodeceptJS >= 2.3.3**

## Install it

```
npm i @codeceptjs/configure --save
```

## How to use it

Better to see once.

**Watch [YouTube video](https://www.youtube.com/watch?v=onBnfo_rJa4)**

### setHeadlessWhen

Toggle headless mode for Puppeteer, WebDriver, TestCafe, Nightmare and Playwright on condition.

Usage:

```js
// in codecept.conf.js
const { setHeadlessWhen } = require('@codeceptjs/configure');

// enable headless when env var HEADLESS exists
// Use it like:
//
// export HEADLESS=true && npx codeceptjs run
setHeadlessWhen(process.env.HEADLESS); 

exports.config = {
  helpers: {
    // standard config goes here
    WebDriver: {} 
    // or Puppeteer
    // or TestCafe
  }
}
```

* For Puppeteer, TestCafe, Nigthmare, Playwright: it enables `show: true`.
* For WebDriver with Chrome or Firefox browser: it adds `--headless` option to chrome/firefox options inside `desiredCapabilities`.

### setHeadedWhen

Opposite to [setHeadlessWhen](#setHeadlessWhen). Forces window mode for running tests.

```js
// in codecept.conf.js
const { setHeadlessWhen } = require('@codeceptjs/configure');

// enable window mode when env var DEV exists
// Use it like:
//
// export DEV=true && npx codeceptjs run
setHeadedWhen(process.env.DEV); 
```
### setCommonPlugins

Enables CodeceptJS plugins which are recommened for common usage.
The list of plugins can be updated from version to version so this hook ensures that all of them are loaded and you won't need to update them in a config:

```js
// in codecept.conf.js
const { setCommonPlugins } = require('@codeceptjs/configure');

setCommonPlugins();
```

These plugins will be loaded:

* tryTo (enabled globally)
* retryFailedStep (enabled globally)
* retryTo (enabled globally)
* eachElement (enabled globally)
* pauseOnFail (disabled, should be turned on when needed)
* screenshotOnFail (enable globally)

### setSharedCookies

Shares cookies between browser and REST/GraphQL helpers.

This hooks sets `onRequest` function for REST, GraphQL, ApiDataFactory, GraphQLDataFactory.
This function obtains cookies from an active session in WebDriver or Puppeteer helpers.

```js
// in codecept.conf.js
const { setSharedCookies } = require('@codeceptjs/configure');

// share cookies between browser helpers and REST/GraphQL
setSharedCookies();

exports.config = {
  helpers: {
    WebDriver: {
      // standard config goes here      
    },
    // or Puppeteer
    // or TestCafe,
    REST: {
      // standard config goes here      
      // onRequest: <= will be set by hook
    },
    ApiDataFactory: {
      // standard config goes here
      // onRequest: <= will be set by hook
    }
  }
}

```

### setBrowser

Changes browser in config for Playwright, Puppeteer, WebDriver, Protractor & TestCafe:

```js
const { setBrowser } = require('@codeceptjs/configure');

setBrowser(process.env.BROWSER);
```

### setWindowSize

Universal way to set a browser window size. For Puppeteer this launches Chrome browser with a specified width and height dimensions without changing viewport size. 

Usage: `setWindowSize(width, height)`.

```js
// in codecept.conf.js
const { setWindowSize } = require('@codeceptjs/configure');

setWindowSize(1600, 1200);

exports.config = {
  helpers: {
    Puppeteer: {}
  }
}
```

### setTestHost

Changes url in config for Playwright, Puppeteer, WebDriver, Protractor & TestCafe:

```js
const { setTestHost } = require('@codeceptjs/configure');

setTestHost(process.env.TEST_HOST);
```

## Contributing

Please send your config hooks!

If you feel that `codecept.conf.js` becomes too complicated and you know how to make it simpler, 
send a pull request with a config hook to solve your case.

Good ideas for config hooks:

* Setting the same window size for all browser helpers.
* Configuring `run-multiple`
* Changing browser in WebDriver or Protractor depending on environment variable.

To create a custom hook follow this rules.

1. Create a file starting with prefix `use` in `hooks` directory.
2. Create a js module that exports a function.
3. Require `config` object from `codeceptjs` package.
4. Use `config.addHook((config) => {})` to set a hook for configuration
5. Add a test to `index_test.js`
6. Run `mocha index_test.js`

See current hooks as examples.

