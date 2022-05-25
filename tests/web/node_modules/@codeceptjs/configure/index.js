module.exports = {
  setHeadlessWhen: require('./hooks/setHeadlessWhen'),
  setHeadedWhen: require('./hooks/setHeadedWhen'),
  setSharedCookies: require('./hooks/setSharedCookies'),
  setWindowSize: require('./hooks/setWindowSize'),
  setBrowser: require('./hooks/setBrowser'),
  setTestHost: require('./hooks/setTestHost'),
  setCommonPlugins: require('./hooks/setCommonPlugins'),
}
