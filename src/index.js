'use strict';

const {readFile: readFileCallback, readFileSync, existsSync} = require('fs');
const {resolve: pathResolve, join} = require('path');
const {promisify} = require('util');

const semver = require('semver');
// const prompts = require('prompts');
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
 * @throws {Error}
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
    cli,
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

  let checkDependency;
  try {
    const packageJSON = getLocalJSON(
      join(cwd, 'package.json')
    );
    const {dependencies, devDependencies} = packageJSON;
    checkDependency = (name, versionToCheck) => {
      const depRange = dependencies && dependencies[name];
      const type = depRange ? 'dependency' : 'devDependency';
      const range = depRange || (devDependencies && devDependencies[name]);
      const satisfied = semver.satisfies(versionToCheck, range);
      const gtr = semver.gtr(versionToCheck, range);
      const ltr = semver.ltr(versionToCheck, range);
      return range
        ? {
          type,
          range,
          satisfied,
          gtr,
          ltr
        }
        : {};
    };
  } catch (e) {
    //
  }

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

  for (const fileContents of fileContentsArr) {
    const scriptObjects = getScriptObjects(fileContents);
    const linkObjects = getLinkObjects(fileContents);
    const objects = [...scriptObjects, ...linkObjects];

    for (const {src} of objects) {
      for (const [i, cdnBasePath] of cdnBasePaths.entries()) {
        // https://unpkg.com/leaflet@1.4.0/dist/leaflet.css
        const match = src.match(cdnBasePath);
        if (!match) {
          continue;
        }
        const {groups: {name, version, path}} = match;
        // eslint-disable-next-line no-console -- a
        console.log(
          `Hello ${name} ${version} ${path}`
        );
        if (name && path && !version) {
          // Todo: Get version added with a replace expression
          break;
        }

        const {
          type,
          range,
          ltr,
          gtr,
          satisfied
        } = checkDependency(name, version);

        if (!type) {
          const errorMessage =
            `Package "${name}" is not found in \`package.json\`.`;
          // eslint-disable-next-line max-len -- Over
          // eslint-disable-next-line sonarjs/no-all-duplicated-branches -- May change later
          if (cli) {
            throw new Error(errorMessage);
            // Todo: Add prompt to optionally install?
            // await prompts();
          } else {
            throw new Error(errorMessage);
          }
        }

        if (satisfied) {
          // eslint-disable-next-line no-console -- CLI
          console.log(
            `The URL's version (${version}) is satisfied by the ` +
            `dependency "${name}"'s current '\`package.json\` range, ` +
            `"${range}"...Continuing...`
          );
        } else if (ltr) {
          // Todo: We'd ideally have an option to update to the max version
          //   in the range ourselves (or update the range to the max
          //   available on npm); see `.idea/notes.js`
          // + ' Please point the URL to at least a minimum supported version.';
          const info =
            `The URL's version (${version}) is less than the dependency ` +
            `"${name}"'s current '\`package.json\` range, "${range}."` +
            ' Updating URL version...';
          // eslint-disable-next-line no-console -- CLI
          console.info(info);
        } else if (gtr) {
          // eslint-disable-next-line max-len -- Fails
          // // eslint-disable-next-line no-await-in-loop -- Prompt should be blocking
          /*
          await prompts({
            type: 'text',
            name: 'newVersion',
            message: ''
          });
          */

          const errorMessage =
            `The URL's version (${version}) is greater than the dependency ` +
            `"${name}"'s current '\`package.json\` range, "${range}."` +
            ' Please either update your `package.json` range to support the ' +
            ' higher URL version (or downgrade your version in the URL).';
          throw new Error(
            errorMessage
          );
        } else {
          throw new Error(
            'Unexpected error: Not greater or less than range, nor satisfied.'
          );
        }

        console.log(
          'version range in package.json',
          range,
          type,
          satisfied
        );

        // eslint-disable-next-line no-console -- Testing
        console.log(
          'version in nm',
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
        break;
      }
    }
  }
  // // eslint-disable-next-line no-console -- CLI
  // console.log('fileContentsArr', fileContentsArr);
}

exports.updateCDNURLs = updateCDNURLs;
