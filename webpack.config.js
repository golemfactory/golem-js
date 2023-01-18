const path = require("path");
const webpack = require("webpack");

module.exports = {
  entry: "./yajsapi/index_browser.ts",
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
      [path.resolve(__dirname, "./yajsapi/activity/secure")]: false,
      [path.resolve(__dirname, "./yajsapi/storage/gftp")]: false,
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
    path: path.resolve(__dirname, "dist/web"),
    library: "yajsapi",
    clean: true,
  },
};
