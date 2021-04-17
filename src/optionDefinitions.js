'use strict';

const pkg = require('../package.json');
const {basePathToRegex} = require('./common.js');

const JSONParser = JSON.parse.bind(JSON);

const getChalkTemplateSingleEscape = (s) => {
  return s.replace(/[{}\\]/gu, (ch) => {
    return `\\u${ch.codePointAt().toString(16).padStart(4, '0')}`;
  });
};

// Todo: We really need a comamnd-line-args-TO-typedef-jsdoc generator!
//  Might see about https://github.com/dsheiko/bycontract/
/* eslint-disable jsdoc/require-property -- Should get property from schema */
/**
* @typedef {PlainObject} IntegrityMattersOptions
*/
/* eslint-enable jsdoc/require-property -- Should get property from schema */

const optionDefinitions = [
  {
    name: 'file', type: String, multiple: true,
    defaultOption: true,
    description: 'Repeat for each file or file glob you wish to be updated. ' +
      'Required. If ends in `.json`, the JSON strategy will be used in ' +
      'place of the HTML strategy.',
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
      'input. Defaults to `file`.',
    typeLabel: '{underline outputPath}'
  },
  {
    name: 'cdnBasePath', type: basePathToRegex,
    multiple: true,
    description: 'Regular expression path(s) with named capturing groups, ' +
      '"name", "version", "dist", "path", "slim", "min", and "ext", ' +
      'indicating how to find CDN URLs and identify the name, version, ' +
      'path, and extension portions. Defaults to an array of specific ' +
      'paths (see source).',
    typeLabel: '{underline base path}'
  },
  {
    name: 'cdnName', type: String,
    multiple: true,
    description: 'Name of the CDN. Should be supplied in the order of ' +
      '`cdnBasePath`. ' +
      `Defaults to 'unpkg', 'node_modules', 'jquery', 'jsdelivr', ` +
      `'bootstrap', and '@fortawesome/fontawesome-free'`,
    typeLabel: '{underline CDN name}'
  },
  {
    name: 'cdnBasePathReplacements', type: String,
    multiple: true,
    description: 'Regular expression replacement expression with named ' +
      'capturing replacements (`$<name>`, `$<path>`, and optionally' +
      '`$<dist>`, `$<slim>`, `$<min>`, `$<ext>` and `$<version>`; the ' +
      'latter defaults to the detected installed version). Defaults to ' +
      'a list of replacements (see source).',
    typeLabel: '{underline path replacement expression}'
  },
  {
    name: 'nodeModulesReplacements', type: String,
    multiple: true,
    description: 'Regular expression replacement expression with named ' +
      'capturing replacements (`$<name>`, `$<path>`, and optionally ' +
      '`$<dist>`, `$<slim>`, `$<min>`, `$<ext>` and `$<version>`). Used to ' +
      'convert a CDN pattern to local `node_modules`. Defaults to a list of ' +
      'replacements (see source).',
    typeLabel: '{underline path replacement expression}'
  },
  {
    name: 'algorithm', type: String,
    multiple: true,
    description: 'Algorithms to enforce on all CDNs, whether previously ' +
      'existing or not. Defaults to not enforcing any besides updating the ' +
      'type(s) present on the `integrity` attribute.',
    typeLabel: '{underline "sha256"|"sha384"|"sha512"}'
  },
  {
    name: 'local', type: Boolean,
    description: 'Use this for avoiding CDN base paths and writing ' +
      '`node_modules` paths for output. Defaults to `false`.'
  },
  {
    name: 'noLocalIntegrity', type: Boolean,
    description: 'Use this for avoiding adding `integrity` when the path ' +
      'is local. Defaults to `false`.'
  },
  {
    name: 'globalCheck', type: String,
    multiple: true,
    description: 'Equals-sign-delimited key-type-value expression of ' +
      'package name, element type ("script" or "link"), and JavaScript ' +
      'string checking for existence of global before attempting to load ' +
      'local fallback (e.g., `jquery=script=window.jQuery` or ' +
      '`bootstrap=link=$.fn.modal`). Add one for each `cdnBasePath`. ' +
      'Has no defaults.',
    typeLabel: '{underline global check string}'
  },
  {
    name: 'fallback', type: Boolean,
    description: 'Add a `document.write` fallback. Defaults to `false`.'
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
      'defaults to checking `process.cwd()`, but if `true`, defaults ' +
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
      'this to `true` to disable. This is automatically implied when ' +
      '`outputPath` is set. Defaults to `false`.'
  },
  {
    name: 'addCrossorigin', type: String,
    description: 'Whether to add `crossorigin` to all scripts and links ' +
      'with `integrity` and no preexisting `crossorigin`. Note that the ' +
      'empty string and "anonymous" are equivalent in HTML. Defaults to ' +
      '`false`.',
    typeLabel: '{underline ""|"anonymous"|"use-credentials"}'
  },
  {
    name: 'packagesToCdns', type: JSONParser,
    description: 'Maps npm package names to the CDN names of `cdnName` ' +
      'so that when specific packages are detected within CDN-ambiguous ' +
      'URL patterns, e.g., with local `node_modules` URLs, a particular ' +
      'CDN can be forced for a particular package. Set to an empty object ' +
      'to avoid package-specific overrides. Defaults to ' +
      getChalkTemplateSingleEscape(
        '`{"jquery": "jquery", "bootstrap": "jsdelivr"}`'
      ),
    typeLabel: '{underline JSON object string}'
  },
  {
    name: 'domHandlerOptions', type: JSONParser,
    description: 'Options to pass to DomHandler. Defaults to none.',
    typeLabel: '{underline JSON object string}'
  },
  {
    name: 'htmlparser2Options', type: JSONParser,
    description: 'Options to pass to htmlparser2. Defaults to none.',
    typeLabel: '{underline JSON object string}'
  },
  {
    name: 'jsonSpace', type (val) {
      if (Number.isNaN(Number.parseInt(val))) {
        return val;
      }
      return Number(val);
    },
    description: 'Argument to pass for `space` `JSON.stringify`. ' +
      'If parsing to a number, a number will be used. Defaults to 2.',
    typeLabel: '{underline JSON object string}'
  },
  {
    name: 'dropModules', type: Boolean,
    description: 'Whether to convert `type="module"` scripts to `defer=""` ' +
      'and drop any `nomodule=""` scripts (assumes targeted script file ' +
      'will be of the same name as the ESM input, but resolving to a ' +
      'different (UMD/IIFE) path after rolling up). Useful when source is ' +
      'intended to avoid a build step (e.g., functional ESM with ' +
      '`node_modules` paths in source) but output is CDN-friendly UMD or ' +
      'IIFE without the cascading HTTP requests of ESM. Defaults to `false`.'
  },
  {
    name: 'dropBase', type: Boolean,
    description: 'Whether to drop `<base href>` in the output. Useful when ' +
      'source is intended to work against development files but the ' +
      'output file does not need this.'
  },
  {
    name: 'disclaimer', type: String,
    description: 'Comment text to add at beginning of output HTML file.',
    typeLabel: '{underline disclaimer string}'
  },
  {
    name: 'forceIntegrityChecks', type: Boolean,
    description: 'Forces `integrity` checks even when the version ' +
      'does not need to be changed. Defaults to `false`.'
  },
  {
    name: 'urlIntegrityCheck', type: Boolean,
    description: 'Set if you wish to confirm the CDN URL\'s ' +
      'contents currently match the expected hash. Defaults to `false`.'
  },
  {
    name: 'ignoreURLFetches', type: Boolean,
    description: 'Avoids sending requests to confirm that the new ' +
      'URL can be successfully resolved. Defaults to `false`.'
  },
  {
    name: 'dryRun', type: Boolean,
    description: 'If set to `true`. Defaults to `false`.'
  }
  // Todo: Logging
  /* ,
  {
    name: 'logging', type: String,
    description: 'Logging level; defaults to "off".',
    typeLabel: '{underline "verbose"|"off"}'
  } */
];

const cliSections = [
  {
    // Add italics: `{italic textToItalicize}`
    content: pkg.description +
      '\n\n{italic integrity [--outputPath path] file1.js ' +
        'fileGlob*}'
  },
  {
    optionList: optionDefinitions
  }
];

exports.definitions = optionDefinitions;
exports.sections = cliSections;
