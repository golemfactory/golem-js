module.exports = {
  verbose: true,
  testEnvironment: "node",
  // disable transforming source files because we want to execute the
  // es modules directly
  transform: {},
  moduleFileExtensions: ["js", "cjs", "mjs"],
  testMatch: ["**/?(*.)+(spec|test).mjs", "**/?(*.)+(spec|test).cjs"],
};
