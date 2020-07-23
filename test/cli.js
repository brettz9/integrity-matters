'use strict';

// const {readFile: rf, unlink: ul} = require('fs');
const {promisify} = require('util');
const {join} = require('path');
const {execFile: ef} = require('child_process');

// const readFile = promisify(rf);

const execFile = promisify(ef);

// const unlink = promisify(ul);

const binFile = join(__dirname, '../bin/index.js');

/*
const getFixturePath = (path) => {
  return join(__dirname, `fixtures/${path}`);
};
const getResultsPath = (path) => {
  return join(__dirname, `results/${path}`);
};
*/

describe('Binary', function () {
  this.timeout(8000);
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
});
