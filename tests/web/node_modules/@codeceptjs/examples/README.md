This repo contains tests for TodoMVC application.
Tests can be executed via different backends.

![](todo.png)

# Installation

This is a playground for your first steps in testing, so instead of installing it from NPM it is recommended to clone it from repo instead.

1. Clone this repository.
2. Install dependencies:

```
npm i
```

This will install codeceptjs with puppeteer, webdriverio & testcafe packages. 

# Running Tests

Default helper is Playwright.

## Playwright

Use `codecept.conf.js` to run tests with Playwright:

```
npx codeceptjs run --steps
```

Run tests in headless mode:

```
HEADLESS=true npx codeceptjs run --steps
```

Run tests in parallel with 3 workers (headless mode):

```
HEADLESS=true npx codeceptjs run-workers 3
```


## Puppeteer

Use `codecept.puppeteer.conf.js` to run tests with Puppeteer:

```
npx codeceptjs run --steps -c codecept.webdriver.conf.js 
```

Run tests in headless mode:

```
HEADLESS=true npx codeceptjs run --steps -c codecept.webdriver.conf.js 
```

Run tests in parallel with 3 workers (headless mode):

```
HEADLESS=true npx codeceptjs run-workers 3 -c codecept.webdriver.conf.js 
```

## WebDriver

Use `codecept.webdriver.conf.js` to run tests with WebDriver in Chrome:

```
npx codeceptjs run -c codecept.webdriver.conf.js --steps 
```

Run tests in headless mode:

```
HEADLESS=true npx codeceptjs run -c codecept.webdriver.conf.js --steps 
```

Run tests in parallel with 3 workers (headless mode):

```
HEADLESS=true npx codeceptjs run-workers 3 -c codecept.webdriver.conf.js
```

## TestCafe

Use `codecept.testcafe.conf.js` to run tests with TestCafe in Chrome:

```
npx codeceptjs run -c codecept.testcafe.conf.js --steps 
```

Run tests in headless mode:

```
HEADLESS=true npx codeceptjs run -c codecept.testcafe.conf.js --steps 
```

Run tests in parallel with 3 workers (headless mode):

```
HEADLESS=true npx codeceptjs run-workers 3 -c codecept.testcafe.conf.js
```

## Credits

Created as part of codepress by Stefan Huber.
Maintained by CodeceptJS Team.

## LICENSE

MIT
