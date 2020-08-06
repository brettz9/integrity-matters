'use strict';

const {
  readFile: readFileCallback,
  writeFile: writeFileCallback,
  readFileSync,
  existsSync
} = require('fs');

const crypto = require('crypto');
const {resolve: pathResolve, join} = require('path');
const {promisify} = require('util');

const cheerio = require('cheerio');
const semver = require('semver');
// const prompts = require('prompts');
const globby = require('globby');
const fetch = require('node-fetch');

// todo[engine:node@>=12]: remove polyfill
const flat = require('array.prototype.flat');

flat.shim();

const {basePathToRegex, hasOwn} = require('./common.js');
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
const pathVersionString = '(?<dist>/dist)?(?<path>[^ \'"]*)';

const defaultCdnNames = [
  'unpkg',
  'node_modules',
  'jquery',
  'jsdelivr',
  'bootstrap'
];

const defaultPackagesToCdns = {
  jquery: 'jquery',
  bootstrap: 'bootstrap'
};

const defaultCdnBasePaths = [
  'https://unpkg.com/(?<name>[^@]*)@' + semverVersionString +
    pathVersionString,
  '(?<prefix>[./]*)node_modules/(?<name>(?:@[^/]*/)?[^/]*)' +
    pathVersionString,
  'https://code.jquery.com/(?<name>[^-]*?)-' + semverVersionString +
    pathVersionString,
  'https://cdn.jsdelivr.net/npm/(?<name>(?:@[^/]*/)?[^@]*?)@' + semverVersionString +
    pathVersionString,
  'https://stackpath.bootstrapcdn.com/(?<name>[^/]*)/' + semverVersionString +
    pathVersionString
].map((url) => {
  return basePathToRegex(url);
});

const defaultNodeModulesReplacements = [
  'node_modules/$<name>$<dist>$<path>',
  '$<prefix>node_modules/$<name>$<dist>$<path>',
  'node_modules/$<name>/dist/jquery$<dist>$<path>',
  'node_modules/$<name>$<dist>$<path>',
  'node_modules/$<name>/dist$<path>'
];

const defaultCdnBasePathReplacements = [
  'https://unpkg.com/$<name>@$<version>$<dist>$<path>',
  'https://unpkg.com/$<name>@$<version>$<dist>$<path>',
  'https://code.jquery.com/$<name>-$<version>$<dist>$<path>',
  'https://cdn.jsdelivr.net/npm/$<name>@$<version>$<dist>$<path>',
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

    const scripts = Object.entries(
      this.doc.script || {}
    ).map(([pkg, info]) => {
      const {
        integrity, local, remote, crossorigin,
        fallback,
        cdn, algorithms,
        global: glbl
      } = info;
      return {
        type: 'script',
        crossorigin,
        fallback,
        cdn,
        algorithms,
        glbl: glbl
          ? {
            link: glbl
          }
          : undefined,
        src: remote || local,
        integrity,
        elem: info
      };
    });
    const links = Object.entries(
      this.doc.link || {}
    ).map(([pkg, info]) => {
      const {
        integrity, local, remote, crossorigin, fallback, cdn,
        algorithms,
        global: glbl
      } = info;
      return {
        type: 'link',
        crossorigin,
        fallback,
        cdn,
        algorithms,
        glbl: glbl
          ? {
            link: glbl
          }
          : undefined,
        src: remote || local,
        integrity,
        elem: info
      };
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
    newSrc, newIntegrity, addCrossorigin, noLocalIntegrity, fallback, local,
    localPath, globalCheck
  }) {
    // Unlike HTML, we don't depend on `fallback` to set this value
    elem.local = localPath;

    // As both forms are available in JSON, we aren't allowing for
    //  overwriting `remote` with the local path (when `local` is in use);
    //  users of the JSON can simply opt to use the `local` property value
    //  if they want local
    if (newSrc && !local) {
      elem.remote = newSrc;
    }
    if (addCrossorigin !== undefined && hasOwn(elem, 'integrity')) {
      if (addCrossorigin) {
        elem.crossorigin = addCrossorigin;
      }
    }

    if (newIntegrity) {
      elem.integrity = newIntegrity;
    }

    if (fallback) {
      elem.fallback = fallback;
    }
    if (globalCheck && globalCheck[type]) {
      elem.global = globalCheck[type];
    }
  }

  /**
   * @type {UpdateStrategy#save}
   */
  async save (file, {jsonSpace}) {
    const serialized = JSON.stringify(
      this.doc, null, jsonSpace === undefined ? 2 : jsonSpace
    );
    await writeFile(file, serialized + '\n');
  }
}

/**
 * For updating HTML files.
 */
class HTMLStrategy {
  /**
   * @type {UpdateStrategy#getObjects}
   */
  async getObjects (contents, domHandlerOptions, htmlparser2Options) {
    this.doc = await handleDOM(
      contents, domHandlerOptions, htmlparser2Options
    );
    const $ = cheerio.load(this.doc);

    const scripts = $('script[src]').toArray().map((elem) => {
      const {
        attribs: {
          src, integrity,
          'data-im-algorithms': algorithms,
          'data-im-cdn': cdn,
          'data-im-global': glbl
        }
      } = elem;

      return {
        type: 'script', elem: $(elem),
        src, integrity,
        algorithms: algorithms
          ? algorithms.split(/\s+/u)
          : undefined,
        cdn,
        glbl: glbl
          ? {
            script: glbl
          }
          : undefined,
        // Boolean
        fallback: glbl !== undefined
      };
    });

    const links = $('link[rel=stylesheet][href]').toArray().map((elem) => {
      const {
        attribs: {
          href: src,
          integrity,
          'data-im-algorithms': algorithms,
          'data-im-cdn': cdn,
          'data-im-global': glbl
        }
      } = elem;

      return {
        type: 'link', elem: $(elem),
        src, integrity,
        algorithms: algorithms
          ? algorithms.split(/\s+/u)
          : undefined,
        cdn,
        glbl: glbl
          ? {
            link: glbl
          }
          : undefined,
        // Boolean
        fallback: glbl !== undefined
      };
    });

    return [...scripts, ...links];
  }

  /* eslint-disable class-methods-use-this -- Might use `this` later
    for config */
  /**
   * For `elem`, see {@link CheerioElement}.
   * @type {UpdateStrategy#update}
   */
  update ({type, elem}, {
    /* eslint-enable class-methods-use-this -- Might use `this` later
      for config */
    newSrc, newIntegrity, addCrossorigin, noLocalIntegrity,
    fallback, localPath, local, globalCheck
  }) {
    elem.removeAttr('data-im-cdn');
    elem.removeAttr('data-im-global');
    elem.removeAttr('data-im-algorithms');
    if (type === 'link') {
      elem.attr('href', newSrc);
    } else {
      elem.attr('src', newSrc);
    }
    if (addCrossorigin !== undefined && elem.is('[integrity]')) {
      if (addCrossorigin) {
        elem.attr('crossorigin', addCrossorigin);
      } else {
        elem.removeAttr('crossorigin');
      }
    }
    if (newIntegrity && (!local || !noLocalIntegrity)) {
      elem.attr('integrity', newIntegrity);
    } else {
      elem.removeAttr('integrity');
    }
    if (fallback && localPath) {
      const syncElement = type === 'link'
        ? `<link rel="stylesheet" href="${localPath}" />`
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
  async save (file, {disclaimer, dropModules}) {
    if (disclaimer) {
      const $ = cheerio.load(this.doc);
      $('*').first().before(
        `<!--${disclaimer.replace(/--/gu, '&hyphen;-')}-->`,
        '\n'
      );
    }
    if (dropModules) {
      const $ = cheerio.load(this.doc);
      $('script[type="module"]').removeAttr('type').attr('defer', 'defer');
      const nomoduleScripts = $('script[nomodule]');
      nomoduleScripts.each((i, nomoduleScript) => {
        const {previousSibling} = $(nomoduleScript)[0];
        if (previousSibling.nodeValue.match(/^\s+$/u)) {
          $(previousSibling).remove();
        }
      });
      nomoduleScripts.remove();
    }
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
  const logs = [];

  /**
   * @callback Logger
   * @param {"log"|"info"|"warn"|"error"} method
   * @param {string} message
   * @returns {void}
   */

  /**
   * @type {Logger}
   */
  function addMainLog (method, message) {
    logs.push({method, message});
  }
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
    cdnName: cdnNames = defaultCdnNames,
    packagesToCdns = defaultPackagesToCdns,
    cdnBasePathReplacements = defaultCdnBasePathReplacements,
    local,
    fallback,
    globalCheck,
    nodeModulesReplacements = defaultNodeModulesReplacements,
    noGlobs,
    forceIntegrityChecks,
    addCrossorigin,
    noLocalIntegrity,
    ignoreURLFetches,
    urlIntegrityCheck,
    algorithm: userAlgorithms = [],
    dryRun,
    domHandlerOptions,
    htmlparser2Options,
    jsonSpace,
    dropModules,
    disclaimer,
    // cli,
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
    ? noGlobs || outputPaths
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
      if (!range) {
        return {};
      }
      const satisfied = semver.satisfies(versionToCheck, range);
      const gtr = semver.gtr(versionToCheck, range);
      const ltr = semver.ltr(versionToCheck, range);
      return {
        dependencyType,
        range,
        satisfied,
        gtr,
        ltr
      };
    };
    addMainLog('info', 'INFO: Found `package.json`');
  // If we remove `package.json` to test, will either occur before
  //  script and cause error due to binary depending on it, or will
  //  be a race condition to delete it before code reaches it
  // istanbul ignore next
  } catch (e) {
    // istanbul ignore next
    throw new Error('Unable to retrieve `package.json`');
  }

  let packageLockJSON;
  try {
    packageLockJSON = getLocalJSON(
      join(cwd, 'package-lock.json')
    );
    addMainLog('info', 'INFO: Found `package-lock.json`');
  } catch (err) {
    addMainLog('info', 'INFO: No valid `package-lock.json` found.');
  }

  let yarnLockDeps;
  try {
    // Todo: Should use a proper parser, but
    // https://www.npmjs.com/package/parse-yarn-lock
    //  seems to be for older verions only.
    const yarnContents = readFileSync(join(cwd, 'yarn.lock'), 'utf8');
    if (packageLockJSON) { // yarn.lock exists due to no errors
      addMainLog(
        'warn',
        'WARNING: Found `yarn.lock`; ignoring due to detected ' +
          '`package-lock.json`'
      );
    } else {
      yarnLockDeps = {};
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
      addMainLog('info', 'INFO: Found `yarn.lock`.');
    }
  } catch (err) {
    if (!packageLockJSON) {
      addMainLog('info', 'INFO: No valid `yarn.lock` found.');
    }
  }

  addMainLog('log', '\n');

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
   * @param {Logger} addLog
   * @throws {Error}
   * @returns {VersionInfo}
   */
  function checkVersions (name, version, versionSourceType, addLog) {
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
      // Handle differently later if `cli` is true?
      // Todo: Add prompt to optionally install?
      // await prompts();
      throw new Error(errorMessage);
    }

    if (satisfied) {
      addLog(
        'info',
        `INFO: The ${versionSourceType}'s version (${version}) is satisfied ` +
        `by the ${dependencyType} "${name}"'s current \`package.json\` ` +
        `range, "${range}". Continuing...`
      );
    } else if (ltr) {
      // Todo: Give CLI option to update `package-lock.json`
      const info =
        `The ${versionSourceType}'s version (${version}) is less ` +
        `than the ${dependencyType} "${name}"'s current \`package.json\` ` +
        `range, "${range}".`;

      // `compareLockToPackage` will throw earlier for the lock files, so
      //   this is only here as an extra guard
      // istanbul ignore if
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
      addLog(
        'warn',
        `WARNING: ${info} Checking \`node_modules\` for a valid installed ` +
        `version to update the URL...`
      );
      updatingVersion = true;
    } else { // gtr
      // // eslint-disable-next-line no-await-in-loop -- Prompt should be
      //     blocking
      /*
      await prompts({
        type: 'text',
        name: 'newVersion',
        message: ''
      });
      */

      // istanbul ignore if -- `semver` will hopefully never get here
      if (!gtr) {
        throw new Error(
          'Unexpected error: Not greater or less than range, nor satisfied. ' +
          `Comparing package ${name} in \`package.json\` to the version ` +
          `(${version}) found in the ${versionSourceType}.`
        );
      }

      const errorMessage =
        `The ${versionSourceType}'s version (${version}) is greater than ` +
        `the ${dependencyType} "${name}"'s current \`package.json\` ` +
        `range, "${range}". ` +
        'Please either update your `package.json` range to support the ' +
        ` higher ${versionSourceType} version (or downgrade your version ` +
        `in the ${versionSourceType}).`;
      throw new Error(
        errorMessage
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
   * @param {PlainObject} cfg
   * @param {number|string} [cfg.jsonSpace] For JSON only
   * @param {string} [cfg.disclaimer] For HTML only
   * @param {boolean} [cfg.dropModules] For HTML only
   * @returns {Promise<void>}
   */

  /**
   * @external DomHandlerOptions
   * @see https://github.com/fb55/DomHandler
   */
  /**
   * @external Htmlparser2Options
   * @see https://github.com/fb55/htmlparser2/wiki/Parser-options
   */
  /**
   * @function UpdateStrategy#getObjects
   * @param {string} contents
   * @param {external:DomHandlerOptions} [domHandlerOptions] For HtML only
   * @param {external:Htmlparser2Options} [htmlparser2Options] For HTML only
   * @returns {Promise<SrcIntegrityObject[]>}
   */

  /**
   * @external CheerioElement
   * @see https://www.npmjs.com/package/cheerio
   */
  /**
   * May hold other strategy-specific meta-data properties as well.
   * @typedef {PlainObject} SrcIntegrityObject
   * @property {string} src
   * @property {string} integrity
   * @property {"script"|"link"} type
   */

  /**
   * @param {SrcIntegrityObject} info
   * @param {UpdateStrategy} strategy
   * @param {Logger} addLog
   * @throws {Error}
   * @returns {Promise<void>}
   */
  async function updateResources (info, strategy, addLog) {
    const {
      src, integrity,
      crossorigin: strategyCrossorigin,
      fallback: strategyFallback,
      glbl,
      algorithms: strategyAlgorithms = [],
      cdn: strategyCdn
    } = info;

    const userOrInlineAlgorithms = [
      ...new Set([...userAlgorithms, ...strategyAlgorithms])
    ];

    /**
     * @param {string} name
     * @param {string} version
     * @param {"dependency"|"devDependency"} dependencyType
     * @param {string} lockVersion
     * @returns {boolean}
     */
    const compareLockToPackage = (
      name, version,
      dependencyType, lockVersion
    ) => {
      let updateVersionLock = false;

      if (lockVersion === version) {
        addLog(
          'info',
          `INFO: Dependency ${name} in your lock file already ` +
          `matches URL version (${version}).`
        );
      } else {
        const gt = semver.gt(lockVersion, version);

        if (gt) {
          addLog(
            'warn',
            `WARNING: The lock file version ${lockVersion} ` +
            `is greater for package "${name}" than the URL version ` +
            `${version}. Checking \`node_modules\` for a valid installed ` +
            `version to update the URL...`
            // `(or downgrade the \`package-lock.json\` version).`
          );
          updateVersionLock = lockVersion;
        } else {
          const lt = semver.lt(lockVersion, version);
          // istanbul ignore if -- semver shouldn't have another state
          if (!lt) {
            throw new Error(
              'Unexpected error: Not greater or less than version, nor ' +
              `satisfied. Comparing version of package ${name} in ` +
              `lock file (${lockVersion}) to the version ` +
              `(${version}) found in the URL.`
            );
          }
          throw new Error(
            `The lock file version ${lockVersion} is ` +
            `less for package "${name}" than the URL version ` +
            `${version}. Please update your lock file (or ` +
            `downgrade the version in your URL)...`
            // `(or downgrade the \`package-lock.json\` version).`
          );
        }
      }

      return updateVersionLock;
    };

    for (const [i, cdnBasePath] of cdnBasePaths.entries()) {
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
        } = checkVersions(name, version, 'URL', addLog);
        updatingVersion = updVers;

        const npmLockDeps = packageLockJSON && packageLockJSON.dependencies;
        const npmLockDep = npmLockDeps && npmLockDeps[name];

        let updateVersionLock;
        if (npmLockDep) {
          const {version: lockVersion} = npmLockDep;
          updateVersionLock = compareLockToPackage(
            name, version, dependencyType, lockVersion
          );
          checkVersions(name, lockVersion, '`package-lock.json`', addLog);
        } else if (yarnLockDeps) {
          const yarnLockDep = yarnLockDeps[name];
          if (yarnLockDep) {
            const {version: lockVersion} = yarnLockDep;
            updateVersionLock = compareLockToPackage(
              name, version, dependencyType, lockVersion
            );
            checkVersions(name, lockVersion, '`yarn.lock`', addLog);
          }
        }
        updatingVersion = updateVersionLock || updatingVersion;
      } else {
        updatingVersion = true;
      }

      let nmVersion;
      try {
        ({version: nmVersion} = getLocalJSON(
          join(cwd, 'node_modules', name, 'package.json')
        ));
        addLog('info', `INFO: Found valid \`package.json\` for "${name}".`);
      // istanbul ignore next -- Would need to downgrade to get coverage
      } catch (err) {
        // istanbul ignore next -- Would need to downgrade to get coverage
        throw new Error(
          `No valid \`package.json\` found for "${name}".`
        );
      }

      checkVersions(name, nmVersion, '`node_modules` `package.json`', addLog);

      // Can be `true` if should update URL based on URL being lower than
      //  `package.json` range; but we don't currently allow overriding the
      //  `package-lock.json` version
      // Testing this would require a local install which reverted
      //   the version (without updating the package-lock)
      // istanbul ignore if
      if (updatingVersion === true) {
        updatingVersion = nmVersion;
      }

      let avoidVersionSetting = false;
      if (typeof updatingVersion !== 'string') {
        addLog('log', '\n');
        if (!forceIntegrityChecks) {
          break;
        }
        avoidVersionSetting = true;
      }

      const nodeModulesReplacement = nodeModulesReplacements[i] ||
        nodeModulesReplacements[0];

      const relativeNmPath = src.replace(cdnBasePath, nodeModulesReplacement);
      const nmPath = relativeNmPath.replace(/^[./]*/u, '');
      if (!existsSync(nmPath)) {
        throw new Error(
          `The local path ${nmPath} could not be found.`
        );
      }
      const integrityHashes = integrity ? integrity.split(/\s+/u) : [];
      if (userOrInlineAlgorithms.length) {
        // Only add missing algorithms
        integrityHashes.push(...userOrInlineAlgorithms.map((algorithm) => {
          const alreadyHasHash = integrityHashes.find((integrityHash) => {
            return integrityHash.startsWith(`${algorithm}-`);
          });
          if (alreadyHasHash) {
            return null;
          }
          return `${algorithm}-`;
        }).filter((algorithm) => {
          return algorithm;
        }));
      }

      const localHashLogs = [];
      /**
       * @param {Integer} idx
       * @param {"log"|"info"|"warn"|"error"} method
       * @param {string} message
       * @returns {void}
       */
      const addHashLog = (idx, method, message) => {
        localHashLogs[idx] = {method, message};
      };

      const algos = new Map();
      /* eslint-disable no-await-in-loop -- Within a deliberately
        serial loop */
      const localHashes = (await Promise.all(
        /* eslint-enable no-await-in-loop -- Within a deliberately
          serial loop */
        integrityHashes.map(async (integrityHash, j) => {
          const hashMatch = integrityHash.match(
            /^(?<algorithm>[^-]*)-(?<base64Hash>.*$)/u
          );
          if (!hashMatch) {
            throw new Error(
              `Bad integrity value, "${integrityHash}"`
            );
          }
          const {groups: {algorithm, base64Hash}} = hashMatch;

          if (!htmlPermittedAlgorithms.has(algorithm)) {
            throw new Error(
              `Unrecognized algorithm: "${algorithm}" (obtained ` +
                `from integrity value, "${integrityHash}")`
            );
          }
          if (userOrInlineAlgorithms.length &&
            !userOrInlineAlgorithms.includes(algorithm)
          ) {
            addHashLog(
              j,
              'warn',
              `WARNING: Algorithm whitelist did not specify ` +
              `detected "${algorithm}", so dropping.`
            );
            return null;
          }
          const localHash = await getHash(algorithm, nmPath);
          if (localHash !== base64Hash) {
            addHashLog(
              j,
              'warn',
              `WARNING: Local hash ${localHash} does not match ` +
                `corresponding hash (index ${j}) within the integrity ` +
                `attribute (${base64Hash}); algorithm: ${algorithm}; ` +
                `file ${nmPath}`
            );
          } else {
            addHashLog(
              j,
              'log',
              `INFO: Local hash matches corresponding hash (index ${j}) ` +
              `within the integrity attribute; algorithm: ${algorithm}; ` +
              `file ${nmPath}.`
            );
          }
          algos.set(algorithm, localHash);
          return `${algorithm}-${localHash}`;
        })
      )).filter((localHash) => {
        // Remove dropped items
        return localHash;
      });

      localHashLogs.forEach(({method, message}) => {
        addLog(method, message);
      });
      const newIntegrity =
        integrity || strategyAlgorithms.length
        ? localHashes.join(' ')
        : null;

      const newSrc = local
        ? relativeNmPath
        : avoidVersionSetting
          ? src
          : src.replace(
            cdnBasePath,
            // Set arguments into `args` so we can obtain arguments safely
            //  from the end in case user adds extra parentheticals
            (mtch, ...args) => {
              const {name} = args.pop();
              const cdnIndex = strategyCdn
                ? cdnNames.indexOf(strategyCdn)
                : hasOwn(packagesToCdns, name)
                  ? cdnNames.indexOf(packagesToCdns[name])
                  : i;
              const cdnBasePathReplacement =
                cdnBasePathReplacements[cdnIndex] || cdnBasePathReplacements[0];
              return mtch.replace(
                cdnBasePath,
                cdnBasePathReplacement.replace(
                  /(?!\\)\$<version>/u, updatingVersion
                )
              );
            }
          );

      if (!local && !ignoreURLFetches) {
        /* eslint-disable no-await-in-loop -- This loop should be
          serial */
        const resp = await fetch(newSrc, {
          method: urlIntegrityCheck ? 'GET' : 'HEAD'
        });
        /* eslint-enable no-await-in-loop -- This loop should be
          serial */
        if (resp.status !== 200) {
          throw new Error(
            `Received status code ${resp.status} response for ${newSrc}.`
          );
        }
        addLog(
          'info',
          `INFO: Received status code ${resp.status} response for ${newSrc}.`
        );
        if (urlIntegrityCheck) {
          /* eslint-disable no-await-in-loop -- Within a deliberately
            serial loop */
          const content = await resp.text();
          /* eslint-enable no-await-in-loop -- Within a deliberately
            serial loop */
          [...algos.entries()].forEach(([algo, hash]) => {
            const urlHash = crypto.createHash(
              algo
            ).update(content).digest('base64');
            // CDN should generally match our local version!
            // istanbul ignore if
            if (urlHash !== hash) {
              throw new Error(
                `Local hash of algoritm ${algo} does not match hash for ` +
                `content from URL "${newSrc}".`
              );
            }
            addLog(
              'info',
              `INFO: Hash of algorithm ${algo} matches content ` +
                `from URL ${newSrc}.`
            );
          });
        }
      }

      strategy.update(
        info, {
          newSrc,
          noLocalIntegrity,
          newIntegrity,
          fallback: fallback || strategyFallback,
          local,
          localPath: relativeNmPath,
          globalCheck: globalChecks[name] || glbl,
          addCrossorigin: !local && (addCrossorigin || strategyCrossorigin)
        }
      );

      addLog('log', '\n');

      break;
    }
  }

  if (!fileContentsArr.length) {
    throw new Error('No matching files specified by `--file` were found.');
  }

  const fileLogs = [];
  await Promise.all(fileContentsArr.map(async (
    {file, contents, extension}, fileIdx
  ) => {
    const strategy = getStrategyForExtension(extension);

    const objects = await strategy.getObjects(
      contents, domHandlerOptions, htmlparser2Options
    );

    const objectLogs = [];
    await Promise.all(objects.map((object, objIdx) => {
      objectLogs[objIdx] = [];
      return updateResources(object, strategy, (method, message) => {
        objectLogs[objIdx].push({method, message});
      });
    }));
    fileLogs[fileIdx] = objectLogs.flat();

    if (!dryRun) {
      const outputFile = (outputPaths && outputPaths[fileIdx]) || file;
      await strategy.save(outputFile, {
        jsonSpace, disclaimer, dropModules
      });
      fileLogs[fileIdx].push({
        method: 'info', message: `INFO: Finished writing to ${outputFile}`
      });
    }
  }));
  logs.push(...fileLogs.flat());

  logs.forEach(({method, message}) => {
    // eslint-disable-next-line no-console -- CLI
    console[method](message);
  });
  // // eslint-disable-next-line no-console -- CLI
  // console.log('fileContentsArr', fileContentsArr);
}

module.exports = integrityMatters;
