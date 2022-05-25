const codeceptjs = require('codeceptjs');

if (!codeceptjs.config.addHook) throw new Error('CodeceptJS >= 2.3.3 is required to use config hooks.');

module.exports = codeceptjs;
