const path = require("path");
const stdLibBrowser = require("node-stdlib-browser");
const { default: resolve } = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const json = require("@rollup/plugin-json");
const alias = require("@rollup/plugin-alias");
const inject = require("@rollup/plugin-inject");
const { uglify } = require("rollup-plugin-uglify");

module.exports = {
  input: path.resolve(__dirname, "./dist/index_browser.js"),
  // TODO: tests es module format in browser
  output: {
    file: path.resolve(__dirname, "./examples/web/js/bundle.js"),
    format: "iife",
    name: "yajsapi",
  },
  external: ["temp-dir", "child_process", "tmp", "@rauschma/stringio"],
  plugins: [
    alias({
      entries: stdLibBrowser,
    }),
    resolve({ browser: true, preferBuiltins: true }),
    commonjs(),
    json(),
    inject({
      process: stdLibBrowser.process,
      Buffer: [stdLibBrowser.buffer, "Buffer"],
    }),
    uglify(),
  ],
};
