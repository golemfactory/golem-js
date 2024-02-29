import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import alias from "@rollup/plugin-alias";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import nodePolyfills from "rollup-plugin-polyfill-node";
import pkg from "./package.json" assert { type: "json" };
import ignore from "rollup-plugin-ignore";
import filesize from "rollup-plugin-filesize";
import { createRequire } from "module";

const resolveModule = createRequire(import.meta.url).resolve;

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
      ignore(["tmp", "pino"]),
      alias({
        entries: [
          { find: "stream", replacement: "stream-browserify" },
          { find: /RedisDatastore/, replacement: "tests/mock/utils/empty_default.js" },
          { find: /IORedisConnection/, replacement: "tests/mock/utils/empty_default.js" },
          { find: /RedisConnection/, replacement: "tests/mock/utils/empty_default.js" },
          { find: /src\/api\/provider-api$/, replacement: "." },
          { find: /\.\/gftp.js/, replacement: "tests/mock/utils/empty.js" },
          { find: /GftpStorageProvider/, replacement: "tests/mock/utils/empty.js" },
        ],
      }),
      nodeResolve({ browser: true, preferBuiltins: true }),
      commonjs(),
      nodePolyfills(),
      json(), // Required because one our dependencies (bottleneck) loads its own 'version.json'
      typescript({ tsconfig: "./tsconfig.json", exclude: ["**/__tests__", "**/*.test.ts"] }),
      terser({ keep_classnames: true }),
      filesize({ reporter: [sizeValidator, "boxen"] }),
    ],
  },
  // NodeJS
  {
    input: {
      "golem-js": "src/index.ts",
      "golem-js-experimental": "src/experimental.ts",
    },
    output: {
      dir: "dist",
      format: "esm",
      sourcemap: true,
      chunkFileNames: "shared-[hash].mjs",
      entryFileNames: "[name].mjs",
      paths: (id) => {
        if (!id.startsWith("ya-ts-client/dist")) return id;
        // allow importing files directly from ya-ts-client/dist/... without adding .js extension
        const resolved = resolveModule(id);
        const path = resolved.split("node_modules/")[1];
        return path;
      },
    },
    plugins: [
      typescript({ tsconfig: "./tsconfig.json", exclude: ["**/__tests__", "**/*.test.ts"] }),
      filesize({ reporter: [sizeValidator, "boxen"] }),
    ],
  },
  {
    input: {
      "golem-js": "src/index.ts",
      "golem-js-experimental": "src/experimental.ts",
    },
    output: {
      dir: "dist",
      format: "cjs",
      sourcemap: true,
      chunkFileNames: "shared-[hash].js",
    },
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        exclude: ["**/__tests__", "**/*.test.ts"],
        module: "ES2020",
      }),
      filesize({ reporter: [sizeValidator, "boxen"] }),
    ],
  },
];

function sizeValidator(options, bundle, { bundleSize }) {
  if (parseInt(bundleSize) === 0) {
    throw new Error(`Something went wrong while building. Bundle size = ${bundleSize}`);
  }
}
