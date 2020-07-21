'use strict';

const pkg = require('../package.json');
const {basePathToRegex} = require('./common.js');

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
    name: 'configPath', type: String,
    description: 'Path to config file for options. Lower priority than ' +
      'other CLI options. Defaults to non-use.',
    typeLabel: '{underline path to config file}'
  },
  {
    name: 'outputPath', type: String, alias: 'o',
    multiple: true,
    description: 'Path(s) to which to save the file if different from ' +
      'input; globs are ignored. Defaults to `file`.',
    typeLabel: '{underline outputPath}'
  },
  {
    name: 'cdnBasePath', type: basePathToRegex,
    multiple: true,
    description: 'Regular expression path(s) with named capturing groups, ' +
      '"name", "version", and "path", indicating how to find CDN URLs and ' +
      'identify the name, version, and path portions. Defaults to an array ' +
      'of these URLs: ' +
      '`https://unpkg.com/(?<name>[^@]*)@(?<version>\\d+\\.\\d+.\\d+)/' +
        '(?<path>[^ \'"]*)`, `node_modules/(?<name>[^/]*)/(?<path>[^\'"]*)`',
    typeLabel: '{underline base path}'
  },
  {
    name: 'cdnBasePathReplacements', type: String,
    multiple: true,
    description: 'Regular expression replacement expression with named ' +
      'capturing replacements (`$<name>`, `$<path>`, and optionally ' +
      '`$<version>`; the latter defaults to the detected installed version).',
    typeLabel: '{underline path replacement expression}'
  },
  {
    name: 'nodeModulesReplacements', type: String,
    multiple: true,
    description: 'Regular expression replacement expression with named ' +
      'capturing replacements (`$<name>`, `$<path>`, and optionally ' +
      '`$<version>`). Used to convert a CDN pattern to local `node_modules`.',
    typeLabel: '{underline path replacement expression}'
  },
  {
    name: 'noConfig', type: Boolean,
    description: 'Avoid checking any config, including defaulting to ' +
      'checking `package.json`. Defaults to `false`.'
  },
  {
    name: 'packageJsonPath', type: String,
    description: 'Path to `package.json` for discovery of its ' +
      '`updateCDNURLs` property. If `noConfig` is `false` (the default), ' +
      'defaults to checking `process.cwd()`, but if `true` will default ' +
      'to not checking for a `package.json` and just using the regular ' +
      'CLI options. This option is ignored if `configPath` is set.',
    typeLabel: '{underline path to package.json}'
  },
  {
    name: 'cwd', type: String,
    description: 'Current working directory path. Defaults to ' +
      '`process.cwd()`.',
    typeLabel: '{underline cwd path}'
  },
  {
    name: 'noGlobs', type: Boolean,
    description: '`file` files will be treated by default as globs. Set ' +
      'this to `true` to disable. Defaults to `false`.'
  },
  {
    name: 'forceIntegrityChecks', type: Boolean,
    description: 'Forces `integrity` checks even when the version ' +
      'does not need to be changed. Default is `false`.'
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
