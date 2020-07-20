'use strict';

const {readFile: readFileCallback, readFileSync, existsSync} = require('fs');
const {resolve: pathResolve, join} = require('path');
const {promisify} = require('util');
const globby = require('globby');
const {basePathToRegex} = require('./common.js');

const readFile = promisify(readFileCallback);

const getLocalJSON = (path) => {
  return JSON.parse(readFileSync(path), 'utf8');
};

const semverVersionString = '(?<version>\\d+\\.\\d+.\\d+)';
const pathVersionString = '(?<path>[^ \'"]*)';

const defaultCdnBasePaths = [
  'https://unpkg.com/(?<name>[^@]*)@' + semverVersionString + pathVersionString,
  'node_modules/(?<name>[^/]*)/' + pathVersionString,
  'https://code.jquery.com/(?<name>[^-]*?)-' + semverVersionString + pathVersionString,
  'https://cdn.jsdelivr.net/npm/(?<name>[^@]*?)@' + semverVersionString + pathVersionString,
  'https://stackpath.bootstrapcdn.com/(?<name>[^/]*)/' + semverVersionString + pathVersionString
].map((url) => {
  return basePathToRegex(url);
});

const defaultNodeModulesReplacements = [
  'node_modules/$<name>$<path>',
  'node_modules/$<name>$<path>',
  'node_modules/$<name>/dist/jquery$<path>',
  'node_modules/$<name>$<path>',
  'node_modules/$<name>/dist$<path>'
];

// Todo: May need to have replacements back to node_modules, e.g., if CDN
//  doesn't show `dist`
const defaultCdnBasePathReplacements = [
  'https://unpkg.com/$<name>@$<version>$<path>',
  'https://unpkg.com/$<name>@$<version>$<path>',
  'https://code.jquery.com/$<name>-$<version>$<path>',
  'https://cdn.jsdelivr.net/npm/$<name>@$<version>$<path>',
  'https://stackpath.bootstrapcdn.com/$<name>/$<version>$<path>'
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
    nodeModulesReplacements = defaultNodeModulesReplacements,
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

  // eslint-disable-next-line unicorn/no-unsafe-regex -- Disable for now
  const scriptPattern = /<script\s+src=['"](?<src>[^'"]*)"(?:\s+integrity="(?<integrity>[^'"]*))?"[^>]*?><\/script>/gum;

  // eslint-disable-next-line unicorn/no-unsafe-regex -- Disable for now
  const linkPattern = /<link\s+rel="stylesheet"\s+href=['"](?<src>[^'"]*)"(?:\s+integrity="(?<integrity>[^'"]*))?"[^>]*?(?:\/ ?)?>/gum;

  /**
   * @todo Replace this with htmlparser2 routine
   * @callback ObjectGetter
   * @param {string} fileContents
   * @returns {TagObject[]}
   */

  /**
   * @param {string} type
   * @param {RegExp} pattern
   * @returns {ObjectGetter}
   */
  function getObjects (type, pattern) {
    return (fileContents) => {
      const matches = [];
      let match;
      // Todo[engine:node@>=12]: use `matchAll` instead:
      // `for (const match of fileContents.matchAll(cdnBasePath)) {`
      while ((match = pattern.exec(fileContents)) !== null) {
        const {groups: {src, integrity}} = match;
        const obj = {
          src,
          integrity,
          // Add this to find position in original string if replacing in place
          lastIndex: pattern.lastIndex
        };
        matches.push(obj);
      }
      return matches;
    };
  }

  const getScriptObjects = getObjects('script', scriptPattern);
  const getLinkObjects = getObjects('link', linkPattern);

  let packageJSON;
  try {
    packageJSON = getLocalJSON(
      join(cwd, 'package.json')
    );
  } catch (e) {
    //
  }
  console.log('packageJSON version', packageJSON.version);

  let packageLockJSON, yarnLockJSON;
  try {
    packageLockJSON = getLocalJSON(
      join(cwd, 'package-lock.json')
    );
  } catch (err) {
    //
  }
  try {
    yarnLockJSON = getLocalJSON(
      join(cwd, 'yarn.lock')
    );
  } catch (err) {
    //
  }

  console.log(
    'lock',
    packageLockJSON && packageLockJSON.version,
    yarnLockJSON && yarnLockJSON.version
  );

  fileContentsArr.forEach((fileContents) => {
    const scriptObjects = getScriptObjects(fileContents);
    const linkObjects = getLinkObjects(fileContents);
    const objects = [...scriptObjects, ...linkObjects];

    objects.forEach(({src}) => {
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

        // eslint-disable-next-line no-console -- Testing
        console.log(
          'version',
          getLocalJSON(
            join(cwd, 'node_modules', name, 'package.json')
          ).version
        );

        const cdnBasePathReplacement = cdnBasePathReplacements[i];
        // eslint-disable-next-line no-console -- disable
        console.log(
          'cdnBasePathReplacement',
          src.replace(cdnBasePath, cdnBasePathReplacement)
        );

        const nodeModulesReplacement = nodeModulesReplacements[i];
        const nmPath = src.replace(cdnBasePath, nodeModulesReplacement);
        console.log(
          'nodeModulesReplacements',
          nmPath
        );
        console.log('existsSync', existsSync(nmPath), '\n');
        return true;
      });
    });
  });
  // // eslint-disable-next-line no-console -- CLI
  // console.log('fileContentsArr', fileContentsArr);
}

exports.updateCDNURLs = updateCDNURLs;
