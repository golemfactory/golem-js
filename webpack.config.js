const path = require("path");
const webpack = require("webpack");

module.exports = {
  entry: "./yajsapi/mid-level-api/activity/activity.ts",
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
    fallback: {
      child_process: "empty",
      // fs: require.resolve("browserify-fs"),
      stream: require.resolve("stream-browserify"),
      buffer: require.resolve("buffer/"),
      // dgram: require.resolve("dgram-browserify"),
      // util: require.resolve("util"),
      // http: require.resolve("stream-http"),
      // https: require.resolve("https-browserify"),
      // net: require.resolve("net-browserify"),
      // crypto: require.resolve("crypto-browserify"),
      // path: require.resolve("path-browserify"),
      // os: require.resolve("os-browserify"),
      // zlib: require.resolve("browserify-zlib"),
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: "process/browser",
    }),
  ],
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "tests/web/activity"),
    library: "yajsapi",
  },
};
