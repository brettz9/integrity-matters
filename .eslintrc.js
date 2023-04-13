'use strict';

module.exports = {
  extends: [
    'ash-nazg/sauron-node-overrides'
  ],
  env: {
    browser: false
  },
  parserOptions: {
    ecmaVersion: 2022
  },
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly'
  },
  overrides: [{
    files: ['test/**'],
    env: {
      mocha: true
    },
    globals: {
      expect: true
    },
    rules: {
      // Browser only
      'compat/compat': 0,
      'import/no-commonjs': 0,
      'no-console': 0,
      'n/exports-style': 0
    }
  }, {
    files: ['*.md/*.js'],
    globals: {
    },
    rules: {
      'n/no-missing-require': ['error', {
        allowModules: ['integrity-matters']
      }],
      'no-unused-vars': ['error', {
        // varsIgnorePattern: 'value'
      }],
      strict: 0
    }
  }],
  rules: {
    'import/no-commonjs': 0,

    // Browser only
    'compat/compat': 0,

    // Reenabled by plugin:node/recommended-script
    'n/no-process-exit': 0,

    'n/exports-style': 0,

    // Reenable when ESLint 8 support
    'jsdoc/check-examples': 0
  }
};
