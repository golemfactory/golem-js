const path = require("path");
const stdLibBrowser = require("node-stdlib-browser");
const { default: resolve } = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const json = require("@rollup/plugin-json");
const alias = require("@rollup/plugin-alias");
const inject = require("@rollup/plugin-inject");

module.exports = {
  input: path.resolve(__dirname, "./dist/yajsapi/index_browser.js"),
  output: {
    file: path.resolve(__dirname, "./examples/web/js/bundle.js"),
    format: "iife",
    name: "yajsapi",
  },
  plugins: [
    alias({
      entries: stdLibBrowser,
    }),
    resolve({ browser: true }),
    commonjs(),
    json(),
    inject({
      process: stdLibBrowser.process,
      Buffer: [stdLibBrowser.buffer, "Buffer"],
    }),
  ],
};
