'use strict';

const {DomHandler} = require('domhandler');
const {Parser} = require('htmlparser2');

/**
 * @external DOMHandlerObject
 * @see https://github.com/fb55/DomHandler#user-content-example
 */

/**
 * @param {string} domString
 * @returns {Promise<external:DOMHandlerObject>}
 */
function handleDOM (domString) {
  // eslint-disable-next-line promise/avoid-new -- Has no Promise API
  return new Promise((resolve, reject) => {
    const handler = new DomHandler(function (error, dom) {
      if (error) {
        reject(error);
        return;
      }
      resolve(dom);
    });
    const parser = new Parser(handler);
    parser.write(domString);
    parser.end();
  });
}

module.exports = handleDOM;
