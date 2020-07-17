'use strict';

const {readFile: readFileCallback} = require('fs');
const {resolve: pathResolve} = require('path');
const {promisify} = require('util');
const globby = require('globby');

const readFile = promisify(readFileCallback);

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
    file: fileArray, noGlobs, cdnBasePath: cdnBasePaths, cwd = process.cwd()
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
      while ((match = cdnBasePath.exec(fileContents)) !== null) {
        // eslint-disable-next-line no-console -- a
        console.log(`Hello ${match.groups.name} ${match.groups.version} ${match.groups.path}`);
      }
    });
  });

  // // eslint-disable-next-line no-console -- CLI
  // console.log('fileContentsArr', fileContentsArr);
}

exports.updateCDNURLs = updateCDNURLs;
