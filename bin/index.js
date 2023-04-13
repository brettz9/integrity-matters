#!/usr/bin/env node

import {join, dirname} from 'path';
import {fileURLToPath} from 'url';

import {cliBasics} from 'command-line-basics';
import integrityMatters from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const optionDefinitions = await cliBasics(
  join(__dirname, '../src/optionDefinitions.js')
);

if (!optionDefinitions) { // cliBasics handled
  process.exit();
}

try {
  await integrityMatters({
    ...optionDefinitions,
    cli: true
  });
} catch (err) {
  // eslint-disable-next-line no-console -- Report error to user
  console.error(err);
  process.exit();
}
