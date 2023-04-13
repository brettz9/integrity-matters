import {DomHandler} from 'domhandler';
import {Parser} from 'htmlparser2';

/**
 * @external DOMHandlerObject
 * @see https://github.com/fb55/DomHandler#user-content-example
 */

/**
 * @param {string} domString
 * @param {external:DomHandlerOptions} domHandlerOptions
 * @param {external:Htmlparser2Options} htmlparser2Options
 * @returns {Promise<external:DOMHandlerObject>}
 */
function handleDOM (domString, domHandlerOptions, htmlparser2Options) {
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
    }, domHandlerOptions);
    const parser = new Parser(handler, htmlparser2Options);
    parser.write(domString);
    parser.end();
  });
}

export default handleDOM;
