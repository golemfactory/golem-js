/**
 * Helper which allows replacing the default logger implemented in jest with the standard one for the duration of the test
 *
 * It was needed because of the way Goth tests are implemented - producing a lot of output on the console during the test
 * which is considered as an issue when using jest. Once we change the way we store Goth related logs, then we'll be
 * able to remove this file.
 */

const jestConsole = console;

beforeAll(() => {
  global.console = require("console");
});

afterAll(() => {
  global.console = jestConsole;
});
