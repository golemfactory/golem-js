const assert = require('assert');

Feature('Demo');

Scenario('Open a page', async ({ I }) => {
  I.amOnPage('https://github.com');
  const width = await I.executeScript(() => window.innerWidth);
  const height = await I.executeScript(() => window.innerHeight);
  assert.strictEqual(1500, width, 'width');
  assert.strictEqual(800, height, 'height');
});
