'use strict';

const {readFile: readFileCallback, readFileSync} = require('fs');
const {resolve: pathResolve} = require('path');
const {promisify} = require('util');
const globby = require('globby');
const {basePathToRegex} = require('./common.js');

const readFile = promisify(readFileCallback);

const defaultCdnBasePaths = [
  'https://unpkg.com/(?<name>[^@]*)@(?<version>\\d+\\.\\d+.\\d+)/(?<path>[^ \'"]*)',
  'node_modules/(?<name>[^/]*)/(?<path>[^\'"]*)'
].map((url) => {
  return basePathToRegex(url);
});

const defaultCdnBasePathReplacements = [
  'https://unpkg.com/$<name>@$<version>/$<path>',
  'https://unpkg.com/$<name>@$<version>/$<path>'
];

/**
 * @param {UpdateCDNURLsOptions} options
 * @returns {void}
 */
async function updateCDNURLs (options) {
  const {configPath, packageJsonPath, noConfig} = options;
  const opts = noConfig
    ? options
    : configPath
      // eslint-disable-next-line import/no-dynamic-require -- User file
      ? {...require(pathResolve(process.cwd(), configPath)), ...options}
      : {
        // eslint-disable-next-line import/no-dynamic-require -- User file
        ...require(
          pathResolve(
            process.cwd(),
            packageJsonPath || './package.json'
          )
        ).updateCDNURLs,
        ...options
      };

  const {
    file: fileArray,
    cdnBasePath: cdnBasePaths = defaultCdnBasePaths,
    cdnBasePathReplacements = defaultCdnBasePathReplacements,
    noGlobs,
    cwd = process.cwd()
    // , outputPath
  } = opts;

  const files = noGlobs
    ? fileArray
    : await globby(fileArray, {
      cwd
    });

  const fileContentsArr = await Promise.all(files.map((file) => {
    return readFile(file, 'utf8');
  }));

  /**
  * @typedef {PlainObject} TagObject
  * @property {string} src
  * @property {string} integrity
  * @property {Integer} lastIndex
  */

  // Todo: Make for links
  // eslint-disable-next-line unicorn/no-unsafe-regex -- Disable for now
  const scriptPattern = /<script\s+src=['"](?<src>[^'"]*)"(?:\s+integrity="(?<integrity>[^'"]*))?"[^>]*?><\/script>/gum;
  /**
   * @todo Replace this with htmlparser2 routine
   * @param {string} fileContents
   * @returns {TagObject[]}
   */
  function getScriptObjects (fileContents) {
    const matches = [];
    let match;
    // Todo[engine:node@>=12]: use `matchAll` instead:
    // `for (const match of fileContents.matchAll(cdnBasePath)) {`
    while ((match = scriptPattern.exec(fileContents)) !== null) {
      const {groups: {src, integrity}} = match;
      const obj = {
        src,
        integrity,
        // Add this to find position in original string if replacing in place
        lastIndex: scriptPattern.lastIndex
      };
      matches.push(obj);
    }
    return matches;
  }

  fileContentsArr.forEach((fileContents) => {
    const scriptObjects = getScriptObjects(fileContents);
    // console.log('scriptObjects', scriptObjects);

    scriptObjects.forEach(({src}) => {
      cdnBasePaths.some((cdnBasePath, i) => {
        // https://unpkg.com/leaflet@1.4.0/dist/leaflet.css
        const match = src.match(cdnBasePath);
        if (!match) {
          return false;
        }
        const {groups: {name, version, path}} = match;
        // eslint-disable-next-line no-console -- a
        console.log(
          `Hello ${name} ${version} ${path}`
        );
        if (name && path && !version) {
          // Todo: Get version added with a replace expression
          return true;
        }
        console.log('aaa', readFileSync(`../node_modules/${name}/package.json`));

        const cdnBasePathReplacement = cdnBasePathReplacements[i];
        // eslint-disable-next-line no-console -- disable
        console.log(
          'cdnBasePathReplacement',
          src.replace(cdnBasePath, cdnBasePathReplacement)
        );
        return true;
      });
    });
  });
  // // eslint-disable-next-line no-console -- CLI
  // console.log('fileContentsArr', fileContentsArr);
}

exports.updateCDNURLs = updateCDNURLs;
