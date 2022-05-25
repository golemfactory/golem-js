const merge = require('lodash.mergewith');

function customizer(objValue, srcValue) {
  if (Array.isArray(objValue)) {
    return objValue.concat(srcValue);
  }
}

module.exports = function (a, b) {
  return merge(a, b, customizer); 
}