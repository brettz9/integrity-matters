'use strict';

exports.basePathToRegex = (cliString) => {
  return new RegExp(cliString, 'um');
};

exports.hasOwn = (obj, prop) => {
  return {}.hasOwnProperty.call(obj, prop);
};
