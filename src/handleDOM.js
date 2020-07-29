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
      // Per https://github.com/fb55/htmlparser2/search?q=onerror&unscoped_q=onerror ,
      //   including the one more relevant source: https://github.com/fb55/htmlparser2/blob/0189e56a876e17c60be5ff7433bcfea3756f9ab9/src/Tokenizer.ts
      //  ...it seems `onerror` should never occur based on our usage (i.e.,
      //  we are not calling `end` or `write` after `end` and states
      //  will presumably not be unknown)
      // istanbul ignore if
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
