#!/usr/bin/env node

import {join} from 'node:path';
import {cliBasics} from 'command-line-basics';
import integrityMatters from '../src/index.js';

const optionDefinitions = await cliBasics(
  join(import.meta.dirname, '/../src/optionDefinitions.js'),
  {
    packageJsonPath: join(import.meta.dirname, '/../package.json')
  }
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
