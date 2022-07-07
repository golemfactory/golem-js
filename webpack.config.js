const path = require("path");
const webpack = require("webpack");

module.exports = {
  entry: "./yajsapi/mid-level-api/index.ts",
  mode: "development",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
    alias: {
      // "ya-ts-client/dist/ya-activity/api$": path.resolve(__dirname, "tests/mock/activity_api.ts"),
    },
    fallback: {
      child_process: "empty",
      // fs: require.resolve("browserify-fs"),
      stream: require.resolve("stream-browserify"),
      buffer: require.resolve("buffer/"),
      timers: require.resolve("timers-browserify"),
      eventsource: require.resolve("eventsource/lib/eventsource-polyfill.js"),
      http: require.resolve("stream-http"),
      https: require.resolve("https-browserify"),
      // dgram: require.resolve("dgram-browserify"),
      // util: require.resolve("util"),
      // net: require.resolve("net-browserify"),
      // crypto: require.resolve("crypto-browserify"),
      // path: require.resolve("path-browserify"),
      // os: require.resolve("os-browserify"),
      // zlib: require.resolve("browserify-zlib"),
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
    }),
    new webpack.ProvidePlugin({
      process: "process/browser",
    }),
  ],
  output: {
    filename: "bundle.js",
    // path: path.resolve(__dirname, "tests/web/activity"),
    path: path.resolve(__dirname, "examples/web"),
    library: "yajsapi",
  },
};
