module.exports = {
  extends: "@istanbuljs/nyc-config-typescript",
  include: ["yajsapi/**/*.ts"],
  exclude: ["tests", "yajsapi/utils/*Logger.ts", "yajsapi/*.ts"],
  all: true,
};
