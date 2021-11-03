'use strict';

module.exports = {
  reject: [
    // Lock in cheerio as new changes dropped preservation of some info:
    'cheerio',

    // Lock in these until going ESM only
    'command-line-basics',
    'escape-string-regexp',
    'globby',
    'node-fetch',
    'semver-regex',

    // Lock in the npm packages we are testing here (easier than to rewrite
    //   test fixtures for each of their updates); not using internally so
    //   not a dev. security concern
    '@fortawesome/fontawesome-free',
    'bootstrap',
    'jquery',
    'leaflet',
    'popper.js'
  ]
};
