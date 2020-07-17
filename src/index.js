'use strict';

const {readFile: readFileCallback} = require('fs');
const {resolve: pathResolve} = require('path');
const {promisify} = require('util');
const globby = require('globby');
const {basePathToRegex} = require('./common.js');

const readFile = promisify(readFileCallback);

const defaultCdnBasePaths = [
  'https://unpkg.com/(?<name>[^@]*)@(?<version>\\d+\\.\\d+.\\d+)/(?<path>[^ \'"]*)'
].map((url) => {
  return basePathToRegex(url);
});

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

  fileContentsArr.forEach((fileContents) => {
    cdnBasePaths.forEach((cdnBasePath) => {
      // https://unpkg.com/leaflet@1.4.0/dist/leaflet.css
      let match;
      // Todo[engine:node@>=12]: use `matchAll` instead:
      // `for (const match of fileContents.matchAll(cdnBasePath)) {`
      while ((match = cdnBasePath.exec(fileContents)) !== null) {
        // eslint-disable-next-line no-console -- a
        console.log(
          // eslint-disable-next-line max-len -- a
          `Hello ${match.groups.name} ${match.groups.version} ${match.groups.path}`
        );
      }
    });
  });

  // // eslint-disable-next-line no-console -- CLI
  // console.log('fileContentsArr', fileContentsArr);
}

exports.updateCDNURLs = updateCDNURLs;
