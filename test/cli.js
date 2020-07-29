'use strict';

const {
  readFile: rf, unlink: ul, writeFile: wf,
  copyFile: copyFileCallback
} = require('fs');
const {promisify} = require('util');
const {join} = require('path');
const {execFile: ef} = require('child_process');
const escStringRegex = require('escape-string-regexp');
const {dependencies: deps, devDependencies} = require('../package.json');
const {dependencies: lockDeps} = require('../package-lock.json');
const {
  version: leafletVersion
} = require('../node_modules/leaflet/package.json');
const {
  version: jqueryVersion
} = require('../node_modules/jquery/package.json');
const {
  version: popperJsVersion
} = require('../node_modules/popper.js/package.json');
const {
  version: bootstrapVersion
} = require('../node_modules/bootstrap/package.json');

const packageLockPath = join(__dirname, '../package-lock.json');
const yarnLockPath = join(__dirname, '../yarn.lock');

const readFile = promisify(rf);
const execFile = promisify(ef);
const unlink = promisify(ul);
const copyFile = promisify(copyFileCallback);
const writeFile = promisify(wf);

// const unlink = promisify(ul);

const binFile = join(__dirname, '../bin/index.js');

const getFixturePath = (path) => {
  return join(__dirname, `fixtures/${path}`);
};

const getResultsPath = (path) => {
  return join(__dirname, `results/${path}`);
};

const outputPath = getResultsPath('cli-results.html');
const updatedHTML = getFixturePath('cli-results.html');
const sampleFilePath = getFixturePath('sample.html');

const badVersionMatchingPath = getFixturePath(
  'result-bad-version-but-matching-hash.html'
);
const sha384AlgorithmsOnlyPath = getFixturePath(
  'sha384-algorithms-only.html'
);
const nodeModulesResult = getFixturePath(
  'result-node-modules.html'
);
const localOnlyPath = getFixturePath(
  'local-only.html'
);
const localOnlyNoIntegrityPath = getFixturePath(
  'local-only-no-integrity.html'
);
const badIntegrityGoodVersionResult = getFixturePath(
  'result-bad-integrity-good-version.html'
);
const fallbackResult = getFixturePath(
  'fallback-result.html'
);
const addCrossoriginPath = getFixturePath(
  'result-addCrossorigin.html'
);

describe('Binary', function () {
  this.timeout(30000);
  it('should log help', async function () {
    const {stdout} = await execFile(binFile, ['-h']);
    expect(stdout).to.contain(
      'integrity [--outputPath path]'
    );
  });
  it('should err without `file` (or help/version) flag', async function () {
    const {stderr} = await execFile(binFile, []);
    expect(stderr).to.contain(
      'No matching files specified by `--file` were found.'
    );
  });

  describe('Executing', function () {
    const unlinker = async () => {
      try {
        return await unlink(outputPath);
      } catch (err) {}
      return undefined;
    };
    before(unlinker);
    after(unlinker);

    [
      ['should execute main CLI'],
      ['should execute main CLI (dry run)', {dryRun: true}],
      ['should execute main CLI with `ignoreURLFetches`', {
        ignoreURLFetches: true
      }],
      ['should execute main CLI in-place on file', {
        inPlaceFile: true
      }]
    ].forEach(([
      testMessage, {dryRun, ignoreURLFetches, inPlaceFile} = {}
    ]) => {
      it(testMessage, async function () {
        if (inPlaceFile) {
          await copyFile(sampleFilePath, outputPath);
        }
        const {stdout, stderr} = await execFile(
          binFile,
          [
            '--file',
            ...(dryRun ? ['--dryRun'] : ''),
            ...(ignoreURLFetches ? ['--ignoreURLFetches'] : ''),
            inPlaceFile ? outputPath : 'test/fixtures/sample.html',
            ...(inPlaceFile ? '' : ['--outputPath', outputPath])
          ],
          {
            timeout: 15000
          }
        );
        // console.log('stderr', stderr);
        // console.log('stdout', stdout);

        expect(stderr).to.match(new RegExp(
          escStringRegex(
            `WARNING: Found \`yarn.lock\`; ignoring due to detected ` +
              '`package-lock.json`\n' +
            `WARNING: The URL's version (1.4.0) is less than the ` +
              `devDependency "leaflet"'s current '\`package.json\` range, ` +
              `"${devDependencies.leaflet}". Checking \`node_modules\` for a ` +
              `valid installed version to update the URL...\n` +
            `WARNING: The lock file version ${lockDeps.leaflet.version} is ` +
              `greater for package "leaflet" than the URL version 1.4.0. ` +
              `Checking \`node_modules\` for a valid installed version to ` +
              `update the URL...\n`
          ) +
          escStringRegex(
            `WARNING: Local hash `
          ) +
          '\\S+' +
          escStringRegex(
            ` does not match corresponding hash (index 0) within the ` +
            `integrity attribute (`
          ) +
          '\\S+' +
          escStringRegex(
            `); algorithm: sha512; file node_modules/leaflet/dist/leaflet.js\n`
          ) +
          escStringRegex(
            `WARNING: The URL's version (1.16.0) is less than the ` +
              `devDependency "popper.js"'s current '\`package.json\` range, ` +
              `"${devDependencies['popper.js']}". Checking \`node_modules\` ` +
              `for a valid installed version to update the URL...\n` +
            `WARNING: The lock file version ${lockDeps['popper.js'].version} ` +
              `is greater for package "popper.js" than the URL version ` +
              `1.16.0. Checking \`node_modules\` for a valid installed ` +
              `version to update the URL...\n`
          ) +
          escStringRegex(
            `WARNING: Local hash `
          ) +
          `\\S+` +
          escStringRegex(
            ` does not match corresponding hash (index 0) within the ` +
            `integrity attribute (`
          ) +
          `\\S+` +
          escStringRegex(
            `); algorithm: sha384; file ` +
              `node_modules/popper.js/dist/umd/popper.min.js\n`
          ) +
          escStringRegex(
            `WARNING: The URL's version (1.4.0) is less than the ` +
              `devDependency "leaflet"'s current '\`package.json\` range, ` +
              `"${devDependencies.leaflet}". Checking \`node_modules\` for a ` +
              `valid installed version to update the URL...\n` +
            `WARNING: The lock file version ${lockDeps.leaflet.version} is ` +
              `greater for package "leaflet" than the URL version 1.4.0. ` +
              `Checking \`node_modules\` for a valid installed version to ` +
              `update the URL...\n`
          ) +
          escStringRegex(
            `WARNING: Local hash `
          ) +
          '\\S+' +
          escStringRegex(
            ` does not match corresponding hash (index 0) within the ` +
            `integrity attribute (`
          ) +
          '\\S+' +
          escStringRegex(
            `); algorithm: sha512; file node_modules/leaflet/dist/leaflet.css\n`
          ),
          'u'
        ));
        expect(stdout).to.match(new RegExp(
          escStringRegex(
            `INFO: Found \`package.json\`\n` +
            `INFO: Found \`package-lock.json\`\n\n\n` +
            // `INFO: No valid \`yarn.lock\` found.\n\n\n` +

            `INFO: The \`package-lock.json\`'s version (` +
              `${lockDeps.leaflet.version}) is satisfied by the ` +
              `devDependency "leaflet"'s current '\`package.json\` range, ` +
              `"${devDependencies.leaflet}". Continuing...\n` +
            `INFO: Found valid \`package.json\` for "leaflet".\n` +
            `INFO: The \`node_modules\` \`package.json\`'s version ` +
              `(${leafletVersion}) is satisfied by the devDependency ` +
              `"leaflet"'s current '\`package.json\` range, ` +
              `"${devDependencies.leaflet}". Continuing...\n` +
            (ignoreURLFetches
              ? '\n\n'
              : `INFO: Received status code 200 response for https://unpkg.com/` +
              `leaflet@${leafletVersion}/dist/leaflet.js.\n\n\n`) +

            `INFO: The URL's version (3.5.1) is satisfied by the ` +
              `devDependency "jquery"'s current '\`package.json\` range, ` +
              `"${devDependencies.jquery}". Continuing...\n` +
            `INFO: Dependency jquery in your lock file already matches URL ` +
              `version (3.5.1).\n` +
            `INFO: The \`package-lock.json\`'s version ` +
              `(${lockDeps.jquery.version}) is satisfied by the ` +
              `devDependency "jquery"'s current '\`package.json\` range, ` +
              `"${devDependencies.jquery}". Continuing...\n` +
            `INFO: Found valid \`package.json\` for "jquery".\n` +
            `INFO: The \`node_modules\` \`package.json\`'s version ` +
              `(${jqueryVersion}) is satisfied by the devDependency ` +
              `"jquery"'s current '\`package.json\` range, ` +
              `"${devDependencies.jquery}". Continuing...\n\n\n` +

            `INFO: The \`package-lock.json\`'s version ` +
              `(${lockDeps['popper.js'].version}) is satisfied by the ` +
              `devDependency "popper.js"'s current '\`package.json\` range, ` +
              `"${devDependencies['popper.js']}". Continuing...\n` +
            `INFO: Found valid \`package.json\` for "popper.js".\n` +
            `INFO: The \`node_modules\` \`package.json\`'s version ` +
              `(${popperJsVersion}) is satisfied by the devDependency ` +
              `"popper.js"'s current '\`package.json\` range, ` +
              `"${devDependencies['popper.js']}". Continuing...\n` +
            (ignoreURLFetches
              ? '\n\n'
              : `INFO: Received status code 200 response for https://cdn.` +
              `jsdelivr.net/npm/popper.js@${popperJsVersion}/dist/umd/` +
              `popper.min.js.\n\n\n`) +

            `INFO: The URL's version (4.5.0) is satisfied by the ` +
              `devDependency "bootstrap"'s current '\`package.json\` range, ` +
              `"${devDependencies.bootstrap}". Continuing...\n` +
            `INFO: Dependency bootstrap in your lock file already matches ` +
              `URL version (4.5.0).\n` +
            `INFO: The \`package-lock.json\`'s version ` +
              `(${lockDeps.bootstrap.version}) is satisfied by the ` +
              `devDependency "bootstrap"'s current '\`package.json\` range, ` +
              `"${devDependencies.bootstrap}". Continuing...\n` +
            `INFO: Found valid \`package.json\` for "bootstrap".\n` +
            `INFO: The \`node_modules\` \`package.json\`'s version ` +
              `(${bootstrapVersion}) is satisfied by the devDependency ` +
              `"bootstrap"'s current '\`package.json\` range, ` +
              `"${devDependencies.bootstrap}". Continuing...\n\n\n` +

            `INFO: The URL's version (4.5.0) is satisfied by the ` +
              `devDependency "bootstrap"'s current '\`package.json\` range, ` +
              `"${devDependencies.bootstrap}". Continuing...\n` +
            `INFO: Dependency bootstrap in your lock file already matches ` +
              `URL version (4.5.0).\n` +
            `INFO: The \`package-lock.json\`'s version ` +
              `(${lockDeps.bootstrap.version}) is satisfied by the ` +
              `devDependency "bootstrap"'s current '\`package.json\` range, ` +
              `"${devDependencies.bootstrap}". Continuing...\n` +
            `INFO: Found valid \`package.json\` for "bootstrap".\n` +
            `INFO: The \`node_modules\` \`package.json\`'s version ` +
              `(${bootstrapVersion}) is satisfied by the devDependency ` +
              `"bootstrap"'s current '\`package.json\` range, ` +
              `"${devDependencies.bootstrap}". Continuing...\n\n\n` +

            `INFO: The \`package-lock.json\`'s version ` +
              `(${lockDeps.leaflet.version}) is satisfied by the ` +
              `devDependency "leaflet"'s current '\`package.json\` range, ` +
              `"${devDependencies.leaflet}". Continuing...\n` +
            `INFO: Found valid \`package.json\` for "leaflet".\n` +
            `INFO: The \`node_modules\` \`package.json\`'s version ` +
              `(${leafletVersion}) is satisfied by the devDependency ` +
              `"leaflet"'s current '\`package.json\` range, ` +
              `"${devDependencies.leaflet}". Continuing...\n` +
            (ignoreURLFetches
              ? '\n\n'
              : `INFO: Received status code 200 response for https://unpkg.com/` +
                `leaflet@${leafletVersion}/dist/leaflet.css.\n\n\n`) +

            (dryRun
              ? ''
              : `INFO: Finished writing to ${outputPath}\n`)
          ),
          'u'
        ));

        if (dryRun) {
          expect(stdout).to.not.contain(
            'INFO: Finished writing to'
          );
        }
        if (ignoreURLFetches) {
          expect(stdout).to.not.contain(
            'Received status code'
          );
        }

        if (!dryRun) {
          const contents = await readFile(outputPath, 'utf8');
          const expected = await readFile(updatedHTML, 'utf8');
          expect(contents).to.equal(expected);
        }
      });
    });

    it(
      'should report if version update already has matching hash',
      async function () {
        const {stdout, stderr} = await execFile(
          binFile,
          [
            '--ignoreURLFetches',
            '--file',
            'test/fixtures/bad-version-but-matching-hash.htm',
            '--outputPath', outputPath
          ],
          {
            timeout: 15000
          }
        );

        // console.log('stdout', stdout);
        // console.log('stderr', stderr);

        expect(stdout).to.contain(
          'Local hash matches corresponding hash (index 0) ' +
          'within the integrity attribute'
        );

        expect(stderr).to.match(new RegExp(
          escStringRegex(
            `WARNING: The URL's version (1.4.0) is less than the ` +
              `devDependency "leaflet"'s current '\`package.json\` range, ` +
              `"${devDependencies.leaflet}". Checking \`node_modules\` for a ` +
              `valid installed version to update the URL...\n` +
            `WARNING: The lock file version ${lockDeps.leaflet.version} is ` +
              `greater for package "leaflet" than the URL version 1.4.0. ` +
              `Checking \`node_modules\` for a valid installed version to ` +
              `update the URL...\n`
          ),
          'u'
        ));

        const contents = await readFile(outputPath, 'utf8');
        const expected = await readFile(badVersionMatchingPath, 'utf8');
        expect(contents).to.equal(expected);
      }
    );

    it(
      'should allow `node_modules` write',
      async function () {
        const {stdout, stderr} = await execFile(
          binFile,
          [
            '--file',
            'test/fixtures/node-modules.html',
            '--outputPath', outputPath
          ],
          {
            timeout: 15000
          }
        );

        // console.log('stdout', stdout);
        // console.log('stderr', stderr);

        expect(stdout).to.contain(
          `INFO: Finished writing to ${outputPath}\n`
        );

        expect(stderr).to.match(new RegExp(
          escStringRegex(
            `WARNING: Local hash `
          ) +
          '\\S+' +
          escStringRegex(
            ` does not match corresponding hash (index 0) within the ` +
            `integrity attribute (simulatingOldIntegrity); algorithm: ` +
            `sha512; file node_modules/leaflet/dist/leaflet.css\n`
          ),
          'u'
        ));

        const contents = await readFile(outputPath, 'utf8');
        const expected = await readFile(nodeModulesResult, 'utf8');
        expect(contents).to.equal(expected);
      }
    );

    it(
      'should allow `local`-only write, dropping crossorigin',
      async function () {
        const {stdout, stderr} = await execFile(
          binFile,
          [
            '--local',
            '--file',
            'test/fixtures/sample.html',
            '--outputPath', outputPath
          ],
          {
            timeout: 15000
          }
        );

        // console.log('stdout', stdout);
        // console.log('stderr', stderr);

        expect(stdout).to.contain(
          `INFO: Finished writing to ${outputPath}\n`
        );

        expect(stderr).to.match(new RegExp(
          escStringRegex(
            `WARNING: The URL's version (1.4.0) is less than the ` +
              `devDependency "leaflet"'s current '\`package.json\` range, ` +
              `"${devDependencies.leaflet}". Checking \`node_modules\` for a ` +
              `valid installed version to update the URL...\n` +
            `WARNING: The lock file version ${lockDeps.leaflet.version} is ` +
              `greater for package "leaflet" than the URL version 1.4.0. ` +
              `Checking \`node_modules\` for a valid installed version to ` +
              `update the URL...\n`
          ),
          'u'
        ));

        const contents = await readFile(outputPath, 'utf8');
        const expected = await readFile(localOnlyPath, 'utf8');
        expect(contents).to.equal(expected);
      }
    );

    it(
      'should allow `local`-only write with `noLocalIntegrity`, ' +
        'dropping crossorigin',
      async function () {
        const {stdout, stderr} = await execFile(
          binFile,
          [
            '--noLocalIntegrity',
            '--local',
            '--file',
            'test/fixtures/sample.html',
            '--outputPath', outputPath
          ],
          {
            timeout: 15000
          }
        );

        // console.log('stdout', stdout);
        // console.log('stderr', stderr);

        expect(stdout).to.contain(
          `INFO: Finished writing to ${outputPath}\n`
        );

        expect(stderr).to.match(new RegExp(
          escStringRegex(
            `WARNING: The URL's version (1.4.0) is less than the ` +
              `devDependency "leaflet"'s current '\`package.json\` range, ` +
              `"${devDependencies.leaflet}". Checking \`node_modules\` for a ` +
              `valid installed version to update the URL...\n` +
            `WARNING: The lock file version ${lockDeps.leaflet.version} is ` +
              `greater for package "leaflet" than the URL version 1.4.0. ` +
              `Checking \`node_modules\` for a valid installed version to ` +
              `update the URL...\n`
          ),
          'u'
        ));

        const contents = await readFile(outputPath, 'utf8');
        const expected = await readFile(localOnlyNoIntegrityPath, 'utf8');
        expect(contents).to.equal(expected);
      }
    );

    it(
      'should work with `addCrossorigin`',
      async function () {
        const {stdout, stderr} = await execFile(
          binFile,
          [
            '--ignoreURLFetches',
            '--addCrossorigin',
            'use-credentials',
            '--file',
            'test/fixtures/sample.html',
            '--outputPath', outputPath
          ],
          {
            timeout: 15000
          }
        );

        // console.log('stdout', stdout);
        // console.log('stderr', stderr);

        expect(stdout).to.contain(
          `INFO: Finished writing to ${outputPath}\n`
        );

        expect(stderr).to.match(new RegExp(
          escStringRegex(
            `WARNING: The URL's version (1.4.0) is less than the ` +
              `devDependency "leaflet"'s current '\`package.json\` range, ` +
              `"${devDependencies.leaflet}". Checking \`node_modules\` for a ` +
              `valid installed version to update the URL...\n` +
            `WARNING: The lock file version ${lockDeps.leaflet.version} is ` +
              `greater for package "leaflet" than the URL version 1.4.0. ` +
              `Checking \`node_modules\` for a valid installed version to ` +
              `update the URL...\n`
          ),
          'u'
        ));

        const contents = await readFile(outputPath, 'utf8');
        const expected = await readFile(addCrossoriginPath, 'utf8');
        expect(contents).to.equal(expected);
      }
    );

    it(
      'should work with `fallback` and `globalCheck`',
      async function () {
        const {stdout, stderr} = await execFile(
          binFile,
          [
            '--ignoreURLFetches',
            '--fallback',
            '--globalCheck',
            'leaflet=script=window.Leaflet',
            '--globalCheck',
            'leaflet=link=window.SomeLeafletCSSCheck',
            '--file',
            'test/fixtures/fallback.html',
            '--outputPath', outputPath
          ],
          {
            timeout: 15000
          }
        );

        // console.log('stdout', stdout);
        // console.log('stderr', stderr);

        expect(stdout).to.contain(
          `INFO: Finished writing to ${outputPath}\n`
        );

        expect(stderr).to.match(new RegExp(
          escStringRegex(
            `WARNING: The URL's version (1.4.0) is less than the ` +
              `devDependency "leaflet"'s current '\`package.json\` range, ` +
              `"${devDependencies.leaflet}". Checking \`node_modules\` for a ` +
              `valid installed version to update the URL...\n` +
            `WARNING: The lock file version ${lockDeps.leaflet.version} is ` +
              `greater for package "leaflet" than the URL version 1.4.0. ` +
              `Checking \`node_modules\` for a valid installed version to ` +
              `update the URL...\n`
          ),
          'u'
        ));

        const contents = await readFile(outputPath, 'utf8');
        const expected = await readFile(fallbackResult, 'utf8');
        expect(contents).to.equal(expected);
      }
    );

    it(
      'should work with `forceIntegrityChecks`',
      async function () {
        const {stdout, stderr} = await execFile(
          binFile,
          [
            '--ignoreURLFetches',
            '--forceIntegrityChecks',
            '--file',
            'test/fixtures/bad-integrity-good-version.html',
            '--outputPath', outputPath
          ],
          {
            timeout: 15000
          }
        );

        // console.log('stdout', stdout);
        // console.log('stderr', stderr);

        expect(stdout).to.contain(
          `INFO: Finished writing to ${outputPath}\n`
        );

        expect(stderr).to.match(new RegExp(
          escStringRegex(
            `WARNING: Local hash `
          ) +
          '\\S+' +
          escStringRegex(
            ` does not match corresponding hash (index 0) within the ` +
            `integrity attribute (badIntegrity); algorithm: sha384; ` +
            `file node_modules/bootstrap/dist/css/bootstrap.min.css\n`
          ),
          'u'
        ));

        const contents = await readFile(outputPath, 'utf8');
        const expected = await readFile(badIntegrityGoodVersionResult, 'utf8');
        expect(contents).to.equal(expected);
      }
    );

    it(
      'should drop unspecified algorithms and add designated if missing',
      async function () {
        const {stdout, stderr} = await execFile(
          binFile,
          [
            '--ignoreURLFetches',
            '--algorithm',
            'sha384',
            '--file',
            'test/fixtures/sample.html',
            '--outputPath', outputPath
          ],
          {
            timeout: 15000
          }
        );

        // console.log('stdout', stdout);
        // console.log('stderr', stderr);

        expect(stdout).to.contain(
          `INFO: Finished writing to ${outputPath}\n`
        );

        expect(stderr).to.match(new RegExp(
          escStringRegex(
            `WARNING: Algorithm whitelist did not specify ` +
            `detected "sha512", so dropping.`
          ),
          'u'
        ));

        const contents = await readFile(outputPath, 'utf8');
        const expected = await readFile(sha384AlgorithmsOnlyPath, 'utf8');
        expect(contents).to.equal(expected);
      }
    );

    it(
      'should err with `cdnBasePathReplacements` and bad status code',
      async function () {
        const {stdout, stderr} = await execFile(
          binFile,
          [
            '--cdnBasePathReplacements',
            'https://example.com/$<name>@$<version>$<path>',
            '--file',
            'test/fixtures/sample.html',
            '--outputPath', outputPath
          ],
          {
            timeout: 15000
          }
        );
        // console.log('stderr', stderr);
        // console.log('stdout', stdout);

        expect(stderr).to.match(new RegExp(
          `Received status code 404 response for (?:` +
            escStringRegex(
              `https://example.com/leaflet@${leafletVersion}` +
              `/dist/leaflet.js`
            ) + '|' +
            escStringRegex(
              `https://example.com/popper.js@${popperJsVersion}` +
              `/dist/umd/popper.min.js`
            ) + '|' +
            escStringRegex(
              `https://example.com/leaflet@${leafletVersion}` +
              `/dist/leaflet.css`
            ) +
          ')\\.',
          'u'
        ));

        expect(stdout).to.not.contain('Finished writing to');
      }
    );

    it(
      'should err with URL using version higher than `package.json` range',
      async function () {
        const {stdout, stderr} = await execFile(
          binFile,
          [
            '--file',
            'test/fixtures/greater-than-range.html',
            '--outputPath', outputPath
          ],
          {
            timeout: 15000
          }
        );
        // console.log('stderr', stderr);
        // console.log('stdout', stdout);

        expect(stderr).to.match(new RegExp(
          escStringRegex(
            `The URL's version (9999999.0.0) is greater than ` +
            `the dependency "domhandler"'s current '\`package.json\` ` +
            `range, "${deps.domhandler}". ` +
            'Please either update your `package.json` range to support the ' +
            ` higher URL version (or downgrade your version ` +
            `in the URL).`
          ),
          'u'
        ));

        expect(stdout).to.not.contain('Finished writing to');
      }
    );
  });

  describe('`yarn.lock` only', function () {
    before(async function () {
      this.packageLockContents = await readFile(packageLockPath, 'utf8');
      await unlink(packageLockPath);
    });
    after(async function () {
      await writeFile(packageLockPath, this.packageLockContents);
    });
    it(
      'should check `yarn.lock` if `package-lock.json` not present',
      async function () {
        const {stdout, stderr} = await execFile(
          binFile,
          [
            '--ignoreURLFetches',
            '--file',
            'test/fixtures/sample.html',
            '--outputPath', outputPath
          ],
          {
            timeout: 15000
          }
        );

        // console.log('stdout', stdout);
        // console.log('stderr', stderr);

        expect(stdout).to.contain('INFO: Found `yarn.lock`.');

        expect(stdout).to.match(new RegExp(
          escStringRegex(
            `INFO: The \`yarn.lock\`'s version ` +
              `(${lockDeps.jquery.version}) is satisfied by the ` +
              `devDependency "jquery"'s current '\`package.json\` range, ` +
              `"${devDependencies.jquery}". Continuing...\n`
          ),
          'u'
        ));

        expect(stderr).to.match(new RegExp(
          escStringRegex(
            `WARNING: The URL's version (1.4.0) is less than the ` +
              `devDependency "leaflet"'s current '\`package.json\` range, ` +
              `"${devDependencies.leaflet}". Checking \`node_modules\` for a ` +
              `valid installed version to update the URL...\n` +
            `WARNING: The lock file version ${lockDeps.leaflet.version} is ` +
              `greater for package "leaflet" than the URL version 1.4.0. ` +
              `Checking \`node_modules\` for a valid installed version to ` +
              `update the URL...\n`
          ),
          'u'
        ));

        const contents = await readFile(outputPath, 'utf8');
        const expected = await readFile(updatedHTML, 'utf8');
        expect(contents).to.equal(expected);
      }
    );
    it(
      'should avoid erring with missing `yarn.lock` item',
      async function () {
        const {stdout, stderr} = await execFile(
          binFile,
          [
            '--file',
            'test/fixtures/not-in-yarn-lock.html',
            '--outputPath', outputPath
          ],
          {
            timeout: 15000
          }
        );
        // console.log('stderr', stderr);
        // console.log('stdout', stdout);

        expect(stderr).to.not.match(new RegExp(
          escStringRegex(
            `The \`yarn.lock\`'s version`
          ),
          'u'
        ));
        expect(stdout).to.not.match(new RegExp(
          escStringRegex(
            `The \`yarn.lock\`'s version`
          ),
          'u'
        ));
        expect(stdout).to.match(new RegExp(
          escStringRegex(
            `INFO: Found \`yarn.lock\`.`
          ),
          'u'
        ));
        expect(stdout).to.match(new RegExp(
          escStringRegex(
            `INFO: Found valid \`package.json\` for "chai".`
          ),
          'u'
        ));

        expect(stdout).to.contain('Finished writing to');
      }
    );
  });

  describe('`package-lock.json` only', function () {
    before(async function () {
      this.yarnLockContents = await readFile(yarnLockPath, 'utf8');
      await unlink(yarnLockPath);
    });
    after(async function () {
      await writeFile(yarnLockPath, this.yarnLockContents);
    });
    it(
      'should not report missing `yarn.lock` if `package-lock.json` found',
      async function () {
        const {stdout, stderr} = await execFile(
          binFile,
          [
            '--ignoreURLFetches',
            '--file',
            'test/fixtures/sample.html',
            '--outputPath', outputPath
          ],
          {
            timeout: 15000
          }
        );

        // console.log('stdout', stdout);
        // console.log('stderr', stderr);

        expect(stdout).to.not.contain('INFO: Found `yarn.lock`.');
        expect(stdout).to.not.contain('INFO: No valid `yarn.lock` found.');

        expect(stdout).to.match(new RegExp(
          escStringRegex(
            `INFO: The \`package-lock.json\`'s version ` +
              `(${lockDeps.jquery.version}) is satisfied by the ` +
              `devDependency "jquery"'s current '\`package.json\` range, ` +
              `"${devDependencies.jquery}". Continuing...\n`
          ),
          'u'
        ));

        expect(stderr).to.match(new RegExp(
          escStringRegex(
            `WARNING: The URL's version (1.4.0) is less than the ` +
              `devDependency "leaflet"'s current '\`package.json\` range, ` +
              `"${devDependencies.leaflet}". Checking \`node_modules\` for a ` +
              `valid installed version to update the URL...\n` +
            `WARNING: The lock file version ${lockDeps.leaflet.version} is ` +
              `greater for package "leaflet" than the URL version 1.4.0. ` +
              `Checking \`node_modules\` for a valid installed version to ` +
              `update the URL...\n`
          ),
          'u'
        ));

        const contents = await readFile(outputPath, 'utf8');
        const expected = await readFile(updatedHTML, 'utf8');
        expect(contents).to.equal(expected);
      }
    );
  });

  describe('No locks', function () {
    before(async function () {
      const [packageLockContents, yarnLockContents] = await Promise.all([
        readFile(packageLockPath, 'utf8'),
        readFile(yarnLockPath, 'utf8')
      ]);
      this.packageLockContents = packageLockContents;
      this.yarnLockContents = yarnLockContents;
      return Promise.all([
        unlink(packageLockPath),
        unlink(yarnLockPath)
      ]);
    });
    after(function () {
      return Promise.all([
        writeFile(packageLockPath, this.packageLockContents),
        writeFile(yarnLockPath, this.yarnLockContents)
      ]);
    });
    it(
      'should report neither `yarn.lock` nor `package-lock.json` when ' +
      'not present',
      async function () {
        const {stdout, stderr} = await execFile(
          binFile,
          [
            '--ignoreURLFetches',
            '--file',
            'test/fixtures/sample.html',
            '--outputPath', outputPath
          ],
          {
            timeout: 15000
          }
        );

        // console.log('stdout', stdout);
        // console.log('stderr', stderr);

        expect(stdout).to.not.contain('INFO: Found `yarn.lock`.');
        expect(stdout).to.match(new RegExp(
          escStringRegex(
            `INFO: No valid \`package-lock.json\` found.\n` +
            `INFO: No valid \`yarn.lock\` found.\n`
          ),
          'u'
        ));

        expect(stderr).to.match(new RegExp(
          escStringRegex(
            `WARNING: The URL's version (1.4.0) is less than the ` +
              `devDependency "leaflet"'s current '\`package.json\` range, ` +
              `"${devDependencies.leaflet}". Checking \`node_modules\` for ` +
              `a valid installed version to update the URL...\n`
          ),
          'u'
        ));

        expect(stderr).to.not.match(new RegExp(
          escStringRegex(
            `WARNING: The lock file version ${lockDeps.leaflet.version} is ` +
              `greater for package "leaflet" than the URL version 1.4.0. ` +
              `Checking \`node_modules\` for a valid installed version to ` +
              `update the URL...\n`
          ),
          'u'
        ));

        const contents = await readFile(outputPath, 'utf8');
        const expected = await readFile(updatedHTML, 'utf8');
        expect(contents).to.equal(expected);
      }
    );
  });

  it(
    'should err with bad `nodeModulesReplacements` and `local`',
    async function () {
      const {stdout, stderr} = await execFile(
        binFile,
        [
          '--nodeModulesReplacements',
          'node_modules/bad-path/$<name>$<path>',
          '--local',
          '--file',
          'test/fixtures/sample.html',
          '--outputPath', outputPath
        ],
        {
          timeout: 15000
        }
      );
      // console.log('stderr', stderr);
      // console.log('stdout', stdout);

      expect(stderr).to.match(new RegExp(
        escStringRegex(
          `The local path node_modules/bad-path/`
        ) +
        '(?:' +
          escStringRegex('leaflet/dist/leaflet.js') +
          '|' +
          escStringRegex(`popper.js/dist/umd/popper.min.js`) +
          '|' +
          escStringRegex(`leaflet/dist/leaflet.css`) +
        ')' +
        ` could not be found`,
        'u'
      ));

      expect(stdout).to.not.contain('Finished writing to');
    }
  );

  it(
    'should err with unrecognized algorithm',
    async function () {
      const {stdout, stderr} = await execFile(
        binFile,
        [
          '--file',
          'test/fixtures/bad-algorithm.html',
          '--outputPath', outputPath
        ],
        {
          timeout: 15000
        }
      );
      // console.log('stderr', stderr);
      // console.log('stdout', stdout);

      expect(stderr).to.match(new RegExp(
        escStringRegex(
          `Unrecognized algorithm: "shaBadAlgorithm" (obtained ` +
            `from integrity value, "shaBadAlgorithm-xwE/` +
              'Az9zrjBIphAcBb3F6JVqxf46+CDLwfLMHloNu6KEQCA' +
              'Wi6HcDUbeOfBIptF7tcCzusKFjFw2yuvEpDL9wQ==")'
        ),
        'u'
      ));

      expect(stdout).to.not.contain('Finished writing to');
    }
  );

  it(
    'should err with bad `integrity` attribute value',
    async function () {
      const {stdout, stderr} = await execFile(
        binFile,
        [
          '--file',
          'test/fixtures/bad-integrity.html',
          '--outputPath', outputPath
        ],
        {
          timeout: 15000
        }
      );
      // console.log('stderr', stderr);
      // console.log('stdout', stdout);

      expect(stderr).to.match(new RegExp(
        escStringRegex(
          `Bad integrity value, "badIntegrity"`
        ),
        'u'
      ));

      expect(stdout).to.not.contain('Finished writing to');
    }
  );

  it(
    'should err with missing `package.json`',
    async function () {
      const {stdout, stderr} = await execFile(
        binFile,
        [
          '--file',
          'test/fixtures/not-in-package-json.html',
          '--outputPath', outputPath
        ],
        {
          timeout: 15000
        }
      );
      // console.log('stderr', stderr);
      // console.log('stdout', stdout);

      expect(stderr).to.match(new RegExp(
        escStringRegex(
          `Package "react" is not found in \`package.json\`.`
        ),
        'u'
      ));

      expect(stdout).to.not.contain('Finished writing to');
    }
  );
});
