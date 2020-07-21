'use strict';

const {
  readFile: readFileCallback,
  writeFile: writeFileCallback,
  readFileSync,
  existsSync
} = require('fs');

const {resolve: pathResolve, join} = require('path');
const {promisify} = require('util');

const cheerio = require('cheerio');
const semver = require('semver');
// const prompts = require('prompts');
const globby = require('globby');

const {basePathToRegex} = require('./common.js');
const handleDOM = require('./handleDOM.js');
const getHash = require('./getHash.js');

const readFile = promisify(readFileCallback);
const writeFile = promisify(writeFileCallback);

const getLocalJSON = (path) => {
  return JSON.parse(readFileSync(path), 'utf8');
};

// https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity
const htmlPermittedAlgorithms = new Set(['sha256', 'sha384', 'sha512']);

const semverVersionString = '(?<version>\\d+\\.\\d+.\\d+)';
const pathVersionString = '(?<path>[^ \'"]*)';

const defaultCdnBasePaths = [
  'https://unpkg.com/(?<name>[^@]*)@' + semverVersionString +
    pathVersionString,
  'node_modules/(?<name>[^/]*)/' + pathVersionString,
  'https://code.jquery.com/(?<name>[^-]*?)-' + semverVersionString +
    pathVersionString,
  'https://cdn.jsdelivr.net/npm/(?<name>[^@]*?)@' + semverVersionString +
    pathVersionString,
  'https://stackpath.bootstrapcdn.com/(?<name>[^/]*)/' + semverVersionString +
    pathVersionString
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
* @typedef {PlainObject} TagObject
* @property {string} src
* @property {string} integrity
* @property {Integer} lastIndex
*/

/**
* @typedef {PlainObject} ObjectInfo
* @property {TagObject} doc
* @property {TagObject[]} objects
*/

/**
 * @param {string} contents
 * @returns {Promise<ObjectInfo>}
 */
async function getObjects (contents) {
  const doc = await handleDOM(contents);
  const $ = cheerio.load(doc);

  const scripts = $('script[src]').toArray().map((elem) => {
    const {
      attribs: {src, integrity}
    } = elem;
    return {src, integrity, type: 'script', elem: $(elem)};
  });

  const links = $('link[rel=stylesheet][href]').toArray().map((elem) => {
    const {
      attribs: {href: src, integrity}
    } = elem;
    return {src, integrity, type: 'link', elem: $(elem)};
  });

  return {
    // $,
    doc,
    objects: [...scripts, ...links]
  };
}

/* eslint-disable class-methods-use-this -- Debugging */
/**
 * For updating JSON files.
 */
class JSONStrategy {
  /**
   * @param {SrcIntegrityObject} info
   * @param {string} newSrc
   * @returns {void}
   */
  update (info, newSrc) {
    // Todo:
  }

  /**
   * @returns {void}
   */
  save () {
    // Todo:
  }
}

/**
 * For updating HTML files.
 */
class HTMLStrategy {
  /**
   * @param {SrcIntegrityObject} info
   * @param {string} newSrc
   * @returns {void}
   */
  update (info, newSrc) {
    if (info.type === 'link') {
      info.elem.attr('href', newSrc);
    } else {
      info.elem.attr('src', newSrc);
    }
  }

  /**
   * @param {SrcIntegrityObject} info
   * @param {string} file Path
   * @returns {void}
   */
  async save (info, file) {
    const serialized = cheerio.html(info);
    // console.log('info.elem', serialized);
    await writeFile(file, serialized);
  }
}
/* eslint-enable class-methods-use-this -- Debugging */

/**
 * @param {string} extension
 * @returns {UpdateStrategy}
 */
function getStrategyForExtension (extension) {
  switch (extension) {
  case '.json':
    return new JSONStrategy();
  case '.html': default:
    return new HTMLStrategy();
  }
}

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
    forceIntegrityChecks,
    dryRun,
    cli,
    cwd = process.cwd()
    // , outputPath
  } = opts;

  const files = fileArray
    ? noGlobs
      ? fileArray
      : await globby(fileArray, {
        cwd
      })
    : [];

  const fileContentsArr = await Promise.all(files.map(async (file) => {
    const extension = file.match(/\..*$/u);
    return {
      file,
      extension: extension && extension[0],
      contents: await readFile(file, 'utf8')
    };
  }));

  let checkDependency;
  try {
    const packageJSON = getLocalJSON(
      join(cwd, 'package.json')
    );
    const {dependencies, devDependencies} = packageJSON;
    checkDependency = (name, versionToCheck) => {
      const depRange = dependencies && dependencies[name];
      const dependencyType = depRange ? 'dependency' : 'devDependency';
      const range = depRange || (devDependencies && devDependencies[name]);
      const satisfied = semver.satisfies(versionToCheck, range);
      const gtr = semver.gtr(versionToCheck, range);
      const ltr = semver.ltr(versionToCheck, range);
      return range
        ? {
          dependencyType,
          range,
          satisfied,
          gtr,
          ltr
        }
        : {};
    };
    // eslint-disable-next-line no-console -- CLI
    console.info('INFO: Found `package.json`');
  } catch (e) {
    // eslint-disable-next-line no-console -- CLI
    console.error('Unable to retrieve `package.json`');
    return;
  }

  let packageLockJSON;
  try {
    packageLockJSON = getLocalJSON(
      join(cwd, 'package-lock.json')
    );
    // eslint-disable-next-line no-console -- CLI
    console.info('INFO: Found `package-lock.json`');
  } catch (err) {
    // eslint-disable-next-line no-console -- CLI
    console.info('INFO: No valid `package-lock.json` found.');
  }

  const yarnLockDeps = {};
  try {
    // Todo: Should use a proper parser, but https://www.npmjs.com/package/parse-yarn-lock
    //  seems to be for older verions only.
    const yarnContents = readFileSync(join(cwd, 'yarn.lock'), 'utf8');
    // eslint-disable-next-line unicorn/no-unsafe-regex -- Disable for now
    const yarnPattern = /^"?(?<dep>@?[^"@\n\d]*).*?:\n {2}version "(?<version>[^"\n]*)"(?:\n {2}resolved (?<resolved>[^\n]*))?\n {2}integrity (?<integrity>[^\n]*)\n/gum;
    let match;
    while ((match = yarnPattern.exec(yarnContents)) !== null) {
      const {groups: {dep, version, integrity}} = match;
      yarnLockDeps[dep] = {
        version,
        integrity
      };
    }
    // eslint-disable-next-line no-console -- CLI
    console.info('INFO: Found `yarn.lock`');
  } catch (err) {
    // eslint-disable-next-line no-console -- CLI
    console.info('INFO: No valid `yarn.lock` found.');
  }

  // eslint-disable-next-line no-console -- CLI
  console.log('\n');

  /**
  * @typedef {PlainObject} VersionInfo
  * @property {"dependency"|"devDependency"} dependencyType
  * @property {boolean} updatingVersion Whether to update the URL (for
  * "URL" `versionSourceType`)
  */

  /**
   * @param {string} name
   * @param {string} version
   * @param {"URL"|"`package-lock.json`"|"`yarn.lock`"|
   * "`node_modules` `package.json`"} versionSourceType
   * @throws {Error}
   * @returns {VersionInfo}
   */
  function checkVersions (name, version, versionSourceType) {
    let updatingVersion = false;
    const {
      dependencyType,
      range,
      ltr,
      gtr,
      satisfied
    } = checkDependency(name, version);

    if (!dependencyType) {
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
        `INFO: The ${versionSourceType}'s version (${version}) is satisfied ` +
        `by the ${dependencyType} "${name}"'s current '\`package.json\` ` +
        `range, "${range}". Continuing...`
      );
    } else if (ltr) {
      // Todo: Give CLI option to update `package-lock.json`
      const info =
        `The ${versionSourceType}'s version (${version}) is less ` +
        `than the ${dependencyType} "${name}"'s current '\`package.json\` ` +
        `range, "${range}".`;
      if (![
        'URL',
        '`node_modules` `package.json`'
      ].includes(versionSourceType)) {
        throw new Error(
          `${info}. Please update your ${versionSourceType} (e.g., as with ` +
            `\`npm install\`).`
        );
      }
      // Todo: We'd ideally have an option to update to the max version
      //   in the range ourselves (or update the range to the max
      //   available on npm); see `.idea/notes.js`
      // + ' Please point the URL to at least a minimum supported version.';
      // eslint-disable-next-line no-console -- CLI
      console.warn(
        `WARNING: ${info} Checking \`node_modules\` for a valid installed ` +
        `version to update the URL...`
      );
      updatingVersion = true;
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
        `The ${versionSourceType}'s version (${version}) is greater than ` +
        `the ${dependencyType} "${name}"'s current '\`package.json\` ` +
        `range, "${range}". ` +
        'Please either update your `package.json` range to support the ' +
        ` higher ${versionSourceType} version (or downgrade your version ` +
        `in the ${versionSourceType}).`;
      throw new Error(
        errorMessage
      );
    } else {
      throw new Error(
        'Unexpected error: Not greater or less than range, nor satisfied. ' +
        `Comparing package ${name} in \`package.json\` to the version ` +
        `(${version}) found in the ${versionSourceType}.`
      );
    }
    return {
      updatingVersion,
      dependencyType
    };
  }

  /**
   * @interface UpdateStrategy
  */
  /**
   * @todo Complete
   * @function UpdateStrategy#update
   * @returns {void}
   */

  /**
  * @typedef {PlainObject} SrcIntegrityObject
  * @property {string} src
  * @property {string} integrity
  * @property {"script"|"link"} type
  */

  /**
   * @param {SrcIntegrityObject} info
   * @param {UpdateStrategy} strategy
   * @returns {Promise<void>}
   */
  async function updateResources (info, strategy) {
    const {src, integrity} = info;
    /**
     * @param {string} name
     * @param {string} version
     * @param {"dependency"|"devDependency"} dependencyType
     * @param {string} lockVersion
     * @param {boolean} dev
     * @returns {boolean}
     */
    const compareLockToPackage = (
      name, version,
      dependencyType, lockVersion, dev
    ) => {
      let updateVersionLock = false;
      if (dev !== undefined) {
        if (dev && dependencyType !== 'devDependency') {
          throw new Error(
            `Your lock file treats "${name}" as a ` +
            `devDependency while your \`package.json\` treats it otherwise.`
          );
        } else if (!dev && dependencyType !== 'dependency') {
          throw new Error(
            `Your lock file treats "${name}" as a ` +
            `(non-dev) dependency while your \`package.json\` treats it ` +
            `as a dev dependency.`
          );
        }
      }

      if (lockVersion === version) {
        // eslint-disable-next-line no-console -- CLI
        console.log(
          `INFO: Dependency ${name} in your lock file already ` +
          `matches URL version (${version}).`
        );
      } else {
        const gt = semver.gt(lockVersion, version);
        if (gt) {
          // eslint-disable-next-line no-console -- CLI
          console.warn(
            `WARNING: The lock file version ${lockVersion} ` +
            `is greater for package "${name}" than the URL version ` +
            `${version}. Checking \`node_modules\` for a valid installed ` +
            `version to update the URL...`
            // `(or downgrade the \`package-lock.json\` version).`
          );
          updateVersionLock = lockVersion;
        } else {
          const lt = semver.lt(lockVersion, version);
          if (lt) {
            throw new Error(
              `The lock file version ${lockVersion} is ` +
              `less for package "${name}" than the URL version ` +
              `${version}. Please update your lock file (or ` +
              `downgrade the version in your URL)...`
              // `(or downgrade the \`package-lock.json\` version).`
            );
          }
          throw new Error(
            'Unexpected error: Not greater or less than version, nor ' +
            `satisfied. Comparing version of package ${name} in ` +
            `lock file (${lockVersion}) to the version ` +
            `(${version}) found in the URL.`
          );
        }
      }

      return updateVersionLock;
    };

    for (const [i, cdnBasePath] of cdnBasePaths.entries()) {
      // https://unpkg.com/leaflet@1.4.0/dist/leaflet.css
      const match = src.match(cdnBasePath);
      if (!match) {
        continue;
      }
      const {groups: {
        name, version // , path
      }} = match;

      let updatingVersion = false;
      if (version) {
        const {
          dependencyType, updatingVersion: updVers
        } = checkVersions(name, version, 'URL');
        updatingVersion = updVers;

        const npmLockDeps = packageLockJSON && packageLockJSON.dependencies;
        const npmLockDep = npmLockDeps && npmLockDeps[name];

        let updateVersionLock;
        if (npmLockDep) {
          const {version: lockVersion, dev} = npmLockDep;
          updateVersionLock = compareLockToPackage(
            name, version, dependencyType, lockVersion, dev
          );
          checkVersions(name, lockVersion, '`package-lock.json`');
        } else {
          const yarnLockDep = yarnLockDeps && yarnLockDeps[name];
          if (yarnLockDep) {
            const {version: lockVersion} = npmLockDep;
            updateVersionLock = compareLockToPackage(
              name, version, dependencyType, lockVersion
            );
            checkVersions(name, lockVersion, '`yarn.lock`');
          }
        }

        updatingVersion = updateVersionLock || updatingVersion;
      }

      let nmVersion;
      try {
        ({version: nmVersion} = getLocalJSON(
          join(cwd, 'node_modules', name, 'package.json')
        ));
        // eslint-disable-next-line no-console -- CLI
        console.info(`INFO: Found valid \`package.json\` for "${name}".`);
      } catch (err) {
        // eslint-disable-next-line no-console -- CLI
        console.warn(`WARNING: No valid \`package.json\` found for "${name}".`);
      }

      if (nmVersion) {
        checkVersions(name, nmVersion, '`node_modules` `package.json`');

        // Can be `true` if should update URL based on URL being lower than
        //  `package.json` range; but we don't currently allow overriding the
        //  `package-lock.json` version
        if (updatingVersion === true) {
          updatingVersion = nmVersion;
        }
      }

      if (typeof updatingVersion !== 'string') {
        // eslint-disable-next-line no-console -- CLI
        console.log('\n');
        if (!forceIntegrityChecks) {
          break;
        }
      }
      const nodeModulesReplacement = nodeModulesReplacements[i];
      const nmPath = src.replace(cdnBasePath, nodeModulesReplacement);
      // console.log(`Path: ${path}`);
      console.log(
        'nodeModulesReplacements',
        nmPath
      );

      if (existsSync(nmPath)) {
        // Todo: Make configurable
        let algorithm = integrity.match(/sha\d{3}/u);
        algorithm = algorithm && algorithm[0];

        if (htmlPermittedAlgorithms.has(algorithm)) {
          const hash = await getHash(algorithm, nmPath);
          console.log(
            nmPath,
            '\n',
            integrity.slice(0, 6),
            '\n',
            integrity.slice(7),
            '\n',
            hash
          );
        }
      }

      const cdnBasePathReplacement = cdnBasePathReplacements[i];
      const newSrc = src.replace(
        cdnBasePath,
        // Todo: Replace by suitable version
        cdnBasePathReplacement.replace(/(?!\\)\$<version>/u, updatingVersion)
      );
      strategy.update(info, newSrc);

      // eslint-disable-next-line no-console -- CLI
      console.log('\n');

      break;
    }
  }

  if (fileContentsArr.length) {
    const fileContentObjectsArr = await Promise.all(
      fileContentsArr.map(async ({file, contents, extension}) => {
        const {objects, doc} = await getObjects(contents);
        return {file, objects, doc, extension};
      })
    );

    const proms = [];
    for (const {objects, doc, file, extension} of fileContentObjectsArr) {
      const strategy = getStrategyForExtension(extension);
      for (const object of objects) {
        await updateResources(object, strategy);
      }
      if (!dryRun) {
        proms.push(strategy.save(doc, file));
      }
    }
    await Promise.all(proms);
    // // eslint-disable-next-line no-console -- CLI
    // console.log('fileContentsArr', fileContentsArr);
  }
}

exports.updateCDNURLs = updateCDNURLs;
