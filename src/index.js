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
const fetch = require('node-fetch');

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

const defaultCdnBasePathReplacements = [
  'https://unpkg.com/$<name>@$<version>$<path>',
  'https://unpkg.com/$<name>@$<version>$<path>',
  'https://code.jquery.com/$<name>-$<version>$<path>',
  'https://cdn.jsdelivr.net/npm/$<name>@$<version>$<path>',
  'https://stackpath.bootstrapcdn.com/$<name>/$<version>$<path>'
];

/**
 * For updating JSON files.
 */
class JSONStrategy {
  /**
   * @type {UpdateStrategy#getObjects}
   */
  getObjects (contents) {
    this.doc = JSON.parse(contents);

    const scripts = Object.entries(this.doc.script).map(([pkg, info]) => {
      const {
        integrity, local, remote // , noLocalIntegrity, glbl
      } = info;
      return {type: 'script', src: remote || local, integrity, elem: info};
    });
    const links = Object.entries(this.doc.link).map(([pkg, info]) => {
      const {
        integrity, local, remote // , noLocalIntegrity, glbl
      } = info;
      return {type: 'link', src: remote || local, integrity, elem: info};
    });

    return [...scripts, ...links];
  }

  /* eslint-disable class-methods-use-this -- Might use `this` later
    for config */
  /**
  * @type {UpdateStrategy#update}
  */
  update ({type, elem}, {
    /* eslint-enable class-methods-use-this -- Might use `this` later
      for config */
    newSrc, newIntegrity, addCrossorigin, localPath, globalCheck
  }) {
    // Todo:
  }

  /**
   * @type {UpdateStrategy#save}
   */
  async save (file) {
    const serialized = JSON.stringify(this.doc, null, 2);
    await writeFile(file, serialized);
  }
}

/**
 * For updating HTML files.
 */
class HTMLStrategy {
  /**
   * @type {UpdateStrategy#getObjects}
   */
  async getObjects (contents) {
    this.doc = await handleDOM(contents);
    const $ = cheerio.load(this.doc);

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

    return [...scripts, ...links];
  }

  /* eslint-disable class-methods-use-this -- Might use `this` later
    for config */
  /**
  * @type {UpdateStrategy#update}
  */
  update ({type, elem}, {
    /* eslint-enable class-methods-use-this -- Might use `this` later
      for config */
    newSrc, newIntegrity, addCrossorigin, localPath, globalCheck
  }) {
    if (type === 'link') {
      elem.attr('href', newSrc);
    } else {
      elem.attr('src', newSrc);
    }
    if (newIntegrity) {
      elem.attr('integrity', newIntegrity);
    }
    if (addCrossorigin !== undefined && elem.is('[integrity]')) {
      elem.attr('crossorigin', addCrossorigin);
    }
    if (localPath) {
      const syncElement = type === 'link'
        ? `<link href="${localPath}" />`
        : `<script src="${localPath}">\\u003C/script>`;

      elem.after(
        '\n',
        `<script>
          'use strict';
          ${globalCheck && globalCheck[type]} || document.write(
            '${syncElement}'
          );
        </script>`
      );
    }
  }

  /**
   * @type {UpdateStrategy#save}
   */
  async save (file) {
    const serialized = cheerio.html(this.doc);
    await writeFile(file, serialized);
  }
}

/**
 * @param {string} extension
 * @returns {UpdateStrategy}
 */
function getStrategyForExtension (extension) {
  switch (extension) {
  case '.json':
    return new JSONStrategy();
  case '.htm': case '.html': default:
    return new HTMLStrategy();
  }
}

/**
 * @param {IntegrityMattersOptions} options
 * @throws {Error}
 * @returns {void}
 */
async function integrityMatters (options) {
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
        ).integrityMatters,
        ...options
      };

  const {
    file: fileArray,
    outputPath: outputPaths,
    cdnBasePath: cdnBasePaths = defaultCdnBasePaths,
    cdnBasePathReplacements = defaultCdnBasePathReplacements,
    local,
    fallback,
    globalCheck,
    nodeModulesReplacements = defaultNodeModulesReplacements,
    noGlobs,
    forceIntegrityChecks,
    addCrossorigin,
    ignoreURLFetches,
    dryRun,
    cli,
    cwd = process.cwd()
  } = opts;

  const globalChecks = Array.isArray(globalCheck)
    ? globalCheck.reduce((obj, keyValue) => {
      const [key, type, value] = keyValue.split('=');
      if (!obj[key]) {
        obj[key] = {};
      }
      obj[key][type] = value;
      return obj;
    }, {})
    : globalCheck || {};

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
    // Todo: Should use a proper parser, but
    // https://www.npmjs.com/package/parse-yarn-lock
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
      // // eslint-disable-next-line no-await-in-loop -- Prompt should be
      //     blocking
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
  * @typedef {PlainObject} UpdateInfo
  * @property {string} newSrc
  * @property {string} [newIntegrity]
  * @property {string} [addCrossorigin]
  * @property {string} [localPath]
  */

  /**
   * @interface UpdateStrategy
  */
  /**
   * @function UpdateStrategy#update
   * @param {SrcIntegrityObject} info
   * @param {UpdateInfo} updateInfo
   * @returns {void}
   */
  /**
   * @function UpdateStrategy#save
   * @param {string} file Path
   * @returns {Promise<void>}
   */
  /**
   * @function UpdateStrategy#getObjects
   * @param {string} contents
   * @returns {Promise<SrcIntegrityObject[]>}
   */

  /**
   * @external CheerioElement
   * @see https://www.npmjs.com/package/cheerio
   */
  /**
  * @typedef {PlainObject} SrcIntegrityObject
  * @property {string} src
  * @property {string} integrity
  * @property {"script"|"link"} type
  * @property {CheerioElement} elem
  */

  /**
   * @param {SrcIntegrityObject} info
   * @param {UpdateStrategy} strategy
   * @throws {Error}
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
      // console.log(`Path: ${path}`);

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
        console.warn(
          `WARNING: No valid \`package.json\` found for "${name}".`
        );
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

      let newIntegrity;
      if (existsSync(nmPath)) {
        // Todo: Allow user to force integrity
        const integrityHashes = integrity.split(/\s+/u);

        /* eslint-disable no-await-in-loop -- This loop should be
          serial */
        const localHashes = await Promise.all(
          /* eslint-enable no-await-in-loop -- This loop should be
            serial */
          integrityHashes.map(async (integrityHash, j) => {
            const hashMatch = integrityHash.match(
              /^(?<algorithm>sha\d{3})-(?<base64Hash>.*$)/u
            );
            if (!hashMatch) {
              return integrityHash;
            }
            const {groups: {algorithm, base64Hash}} = hashMatch;

            if (!htmlPermittedAlgorithms.has(algorithm)) {
              throw new Error(
                `Unrecognized algorithm: "${algorithm}" (obtained ` +
                  `from integrity value, "${integrityHash}")`
              );
            }
            const localHash = await getHash(algorithm, nmPath);
            if (localHash !== base64Hash) {
              // eslint-disable-next-line no-console -- CLI
              console.warn(
                `WARNING: Local hash ${localHash} does not match ` +
                  `corresponding hash (index ${j}) within the integrity ` +
                  `attribute (${base64Hash}); algorithm: ${algorithm}; ` +
                  `file ${nmPath}`
              );
            } else {
              // eslint-disable-next-line no-console -- CLI
              console.log(
                `INFO: Local hash matches corresponding hash (index ${j}) ` +
                `within the integrity attribute; algorithm: ${algorithm}; ` +
                `file ${nmPath}.`
              );
            }
            return `${algorithm}-${localHash}`;
          })
        );
        newIntegrity = localHashes.join(' ');
      }

      const cdnBasePathReplacement = cdnBasePathReplacements[i];
      const newSrc = local
        ? nmPath
        : src.replace(
          cdnBasePath,
          cdnBasePathReplacement.replace(/(?!\\)\$<version>/u, updatingVersion)
        );

      if (!local && !ignoreURLFetches) {
        /* eslint-disable no-await-in-loop -- This loop should be
          serial */
        const resp = await fetch(newSrc, {method: 'HEAD'});
        /* eslint-enable no-await-in-loop -- This loop should be
          serial */
        if (resp.status !== 200) {
          // eslint-disable-next-line no-console -- CLI
          console.error(
            `ERROR: Received status code ${resp.status} response for ${newSrc}.`
          );
          break;
        }
        // eslint-disable-next-line no-console -- CLI
        console.log(
          `INFO: Received status code ${resp.status} response for ${newSrc}.`
        );
      }

      strategy.update(
        info, {
          newSrc,
          newIntegrity,
          localPath: fallback && nmPath,
          globalCheck: globalChecks[name],
          addCrossorigin: !local && addCrossorigin
        }
      );

      // eslint-disable-next-line no-console -- CLI
      console.log('\n');

      break;
    }
  }

  if (fileContentsArr.length) {
    await Promise.all(fileContentsArr.map(async (
      {file, contents, extension}, i
    ) => {
      const strategy = getStrategyForExtension(extension);

      const objects = await strategy.getObjects(contents);
      await Promise.all(objects.map((object) => {
        return updateResources(object, strategy);
      }));
      if (!dryRun) {
        strategy.save((noGlobs && outputPaths && outputPaths[i]) || file);
      }
    }));
    // // eslint-disable-next-line no-console -- CLI
    // console.log('fileContentsArr', fileContentsArr);
  }
}

module.exports = integrityMatters;
