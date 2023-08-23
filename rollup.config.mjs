import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import alias from "@rollup/plugin-alias";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import nodePolyfills from "rollup-plugin-polyfill-node";
import pkg from "./package.json" assert { type: "json" };
import ignore from "rollup-plugin-ignore";

/**
 * Looking for plugins?
 *
 * Check: {@link https://github.com/rollup/awesome}
 */

export default [
  // Browser
  {
    input: "src/index.ts",
    output: {
      inlineDynamicImports: true,
      file: pkg.browser,
      name: "GolemJs",
      sourcemap: true,
      format: "es",
    },
    plugins: [
      ignore(["tmp", "pino", "eventsource"]),
      alias({
        entries: [
          { find: "stream", replacement: "stream-browserify" },
          { find: /RedisDatastore/, replacement: "tests/mock/utils/empty_default.js" },
          { find: /IORedisConnection/, replacement: "tests/mock/utils/empty_default.js" },
          { find: /RedisConnection/, replacement: "tests/mock/utils/empty_default.js" },
          { find: /src\/api\/provider-api$/, replacement: "." },
          { find: /\.\/gftp.js/, replacement: "tests/mock/utils/empty.js" },
        ],
      }),
      nodeResolve({ browser: true, preferBuiltins: true }),
      commonjs(),
      nodePolyfills(),
      json(), // Required because one our dependencies (bottleneck) loads its own 'version.json'
      typescript({ tsconfig: "./tsconfig.json" }),
      terser({ keep_classnames: true }),
      {
        // Temporary workaround  https://github.com/rollup/rollup/issues/4213
        closeBundle() {
          if (!process.env.ROLLUP_WATCH) {
            setTimeout(() => process.exit(0), 5_000);
          }
        },
        name: "force-close",
      },
    ],
  },
  // NodeJS
  {
    input: "src/index.ts",
    output: [
      { file: pkg.main, format: "cjs", sourcemap: true },
      { file: pkg.module, format: "es", sourcemap: true },
    ],
    plugins: [typescript({ tsconfig: "./tsconfig.json" })],
  },
];
