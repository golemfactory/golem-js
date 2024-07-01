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
import fs from "node:fs";
import { fileURLToPath } from "node:url";

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
      deleteExistingBundles("dist"),
      ignore(["tmp"]),
      nodeResolve({ browser: true, preferBuiltins: true }),
      commonjs(),
      nodePolyfills(),
      typescript({ tsconfig: "./tsconfig.json", exclude: ["**/*.test.ts"] }),
      terser(),
      filesize({ reporter: [sizeValidator, "boxen"] }),
    ],
  },
  // NodeJS
  {
    input: {
      "golem-js": "src/index.ts",
      "golem-js-experimental": "src/experimental/index.ts",
    },
    output: {
      dir: "dist",
      format: "esm",
      sourcemap: true,
      chunkFileNames: "shared-[hash].mjs",
      entryFileNames: "[name].mjs",
    },
    plugins: [
      typescript({ tsconfig: "./tsconfig.json", exclude: ["**/*.test.ts"] }),
      filesize({ reporter: [sizeValidator, "boxen"] }),
    ],
  },
  {
    input: {
      "golem-js": "src/index.ts",
      "golem-js-experimental": "src/experimental/index.ts",
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
        exclude: ["**/*.test.ts"],
        module: "ES2020",
      }),
      filesize({ reporter: [sizeValidator, "boxen"] }),
    ],
  },
];

function deleteExistingBundles(path) {
  return {
    name: "delete-existing-bundles",
    buildStart: () => {
      const distDir = fileURLToPath(new URL(path, import.meta.url).toString());
      if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true });
      }
      console.log("Deleted " + distDir);
    },
  };
}

function sizeValidator(options, bundle, { bundleSize }) {
  if (parseInt(bundleSize) === 0) {
    throw new Error(`Something went wrong while building. Bundle size = ${bundleSize}`);
  }
}
