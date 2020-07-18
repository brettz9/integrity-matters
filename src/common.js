'use strict';

exports.basePathToRegex = (cliString) => {
  return new RegExp(cliString, 'um');
};
