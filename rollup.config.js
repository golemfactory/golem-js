import path from "path";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";
import nodePolyfills from "rollup-plugin-node-polyfills";
import injectProcessEnv from "rollup-plugin-inject-process-env";

export default {
  input: path.resolve(__dirname, "./dist/index_web.js"),
  output: {
    file: path.resolve(__dirname, "./examples/web/js/bundle.js"),
    format: "iife",
    name: "yajsapi",
  },
  plugins: [
    resolve({ browser: true, preferBuiltins: false }),
    commonjs(),
    nodePolyfills(),
    json(),
    injectProcessEnv({
      YAGNA_APPKEY: "xxx",
    }),
  ],
};
