import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import alias from "@rollup/plugin-alias";
import terser from "@rollup/plugin-terser";
import nodePolyfills from "rollup-plugin-polyfill-node";
// import { visualizer } from "rollup-plugin-visualizer";

export default {
  input: "dist/index.js",
  output: {
    inlineDynamicImports: true,
    file: "dist/yajsapi.min.js",
    name: "yajsapi",
  },
  plugins: [
    alias({
      entries: [
        { find: "stream", replacement: "stream-browserify" },
        { find: /\.\/winstonLogger.js/, replacement: "tests/mock/utils/empty.js" },
        { find: /eventsource\/lib\/eventsource.js/, replacement: "tests/mock/utils/empty_default.js" },
        { find: /src\/api\/provider-api$/, replacement: "." },
        { find: /\.\/gftp.js/, replacement: "tests/mock/utils/empty.js" },
      ],
    }),
    nodeResolve({ browser: true, preferBuiltins: true }),
    commonjs(),
    nodePolyfills(),
    json(),
    terser({ keep_classnames: true }),
    // visualizer(),
  ],
  onwarn: (warning) => {
    if (warning.code !== "CIRCULAR_DEPENDENCY") console.error(`(!) ${warning.message}`);
  },
};
