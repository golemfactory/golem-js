const path = require("path");
const stdLibBrowser = require("node-stdlib-browser");
const { default: resolve } = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const json = require("@rollup/plugin-json");
const alias = require("@rollup/plugin-alias");
const inject = require("@rollup/plugin-inject");
const minify = require("rollup-plugin-minify");
// const { visualizer } = require("rollup-plugin-visualizer");

module.exports = {
  input: path.resolve(__dirname, "./dist/index.js"),
  output: {
    file: path.resolve(__dirname, "./examples/web/js/bundle.js"),
    format: "iife",
    name: "yajsapi",
  },
  plugins: [
    alias({
      entries: [
        ...Object.keys(stdLibBrowser).map((k) => ({ find: k, replacement: stdLibBrowser[k] })),
        { find: /winstonLogger$/, replacement: "." },
        { find: "eventsource", replacement: "." },
        { find: /src\/api\/provider-api$/, replacement: "." },
        { find: /gftp$/, replacement: "." },
      ],
    }),
    resolve({ browser: true, preferBuiltins: true }),
    commonjs(),
    json(),
    inject({
      process: stdLibBrowser.process,
    }),
    minify(),
    // visualizer(),
  ],
};
