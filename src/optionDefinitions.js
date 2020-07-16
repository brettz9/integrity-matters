'use strict';

const pkg = require('../package.json');

// Todo: We really need a comamnd-line-args-TO-typedef-jsdoc generator!
//  Might see about https://github.com/dsheiko/bycontract/
/* eslint-disable jsdoc/require-property -- Should get property from schema */
/**
* @typedef {PlainObject} UpdateCDNURLsOptions
*/
/* eslint-enable jsdoc/require-property -- Should get property from schema */

const optionDefinitions = [
  {
    name: 'file', type: String, multiple: true,
    defaultOption: true,
    description: 'Repeat for each file or file glob you wish to be updated. ' +
      'Required.',
    typeLabel: '{underline file path}'
  },
  {
    name: 'outputPath', type: String, alias: 'o',
    multiple: true,
    description: 'Path(s) to which to save the file if different from ' +
      'input; globs are ignored. Defaults to `file`.',
    typeLabel: '{underline outputPath}'
  },
  {
    name: 'logging', type: String,
    description: 'Logging level; default is "off".',
    typeLabel: '{underline "verbose"|"off"}'
  }
];

const cliSections = [
  {
    // Add italics: `{italic textToItalicize}`
    content: pkg.description +
      '\n\n{italic update-cdn-urls [--outputPath path] file1.js ' +
        'fileGlob*}'
  },
  {
    optionList: optionDefinitions
  }
];

exports.definitions = optionDefinitions;
exports.sections = cliSections;
