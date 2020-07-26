'use strict';

const {
  readFile: rf, unlink: ul,
  copyFile: copyFileCallback
} = require('fs');
const {promisify} = require('util');
const {join} = require('path');
const {execFile: ef} = require('child_process');
const escStringRegex = require('escape-string-regexp');
const {devDependencies} = require('../package.json');
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

const readFile = promisify(rf);
const execFile = promisify(ef);
const unlink = promisify(ul);
const copyFile = promisify(copyFileCallback);

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
const localOnlyPath = getFixturePath(
  'local-only.html'
);

const badIntegrityGoodVersionResult = getFixturePath(
  'result-bad-integrity-good-version.html'
);

describe('Binary', function () {
  this.timeout(20000);
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
            `INFO: Found \`package-lock.json\`\n` +
            `INFO: No valid \`yarn.lock\` found.\n\n\n` +

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
              ? '\n\n\n'
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
              ? '\n\n\n'
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
              ? '\n\n\n'
              : `INFO: Received status code 200 response for https://unpkg.com/` +
                `leaflet@${leafletVersion}/dist/leaflet.css.\n\n\n`) +

            dryRun
              ? ''
              : `INFO: Finished writing to ${outputPath}\n`
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

        const contents = await readFile(outputPath, 'utf8');
        const expected = await readFile(updatedHTML, 'utf8');
        expect(contents).to.equal(expected);
      });
    });

    it(
      'should report if version update already has matching hash',
      async function () {
        const {stdout, stderr} = await execFile(
          binFile,
          [
            '--file',
            'test/fixtures/bad-version-but-matching-hash.html',
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
      'should work with `forceIntegrityChecks`',
      async function () {
        const {stdout, stderr} = await execFile(
          binFile,
          [
            '--forceIntegrityChecks',
            '--file',
            'test/fixtures/bad-integrity-good-version.html',
            '--outputPath', outputPath
          ],
          {
            timeout: 15000
          }
        );

        console.log('stdout', stdout);
        console.log('stderr', stderr);

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
});
