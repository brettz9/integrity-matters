#!/usr/bin/env node
'use strict';

const {join} = require('path');

const {cliBasics} = require('command-line-basics');
const {updateCDNURLs} = require('../src/index.js');

const optionDefinitions = cliBasics(
  join(__dirname, '../src/optionDefinitions.js')
);

if (!optionDefinitions) { // cliBasics handled
  process.exit();
}

(async () => {
try {
  await updateCDNURLs({
    ...optionDefinitions,
    cli: true
  });
} catch (err) {
  // eslint-disable-next-line no-console -- Report error to user
  console.error(err);
  process.exit();
}
})();
