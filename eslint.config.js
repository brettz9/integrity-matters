import ashNazg from 'eslint-config-ash-nazg';

export default [
  {
    ignores: [
      'coverage',
      '.idea'
    ]
  },
  ...ashNazg(['sauron', 'node']).map((cfg) => {
    return {
      ...cfg,
      languageOptions: {
        ...cfg.languageOptions,
        globals: {
          ...cfg.languageOptions?.globals,
          expect: 'readonly'
        }
      }
    };
  }),
  {
    files: ['*.md/*.js'],
    rules: {
      'n/no-missing-require': ['error', {
        allowModules: ['integrity-matters']
      }],
      'no-unused-vars': ['error', {
        // varsIgnorePattern: 'value'
      }],
      strict: 0
    }
  },
  {
    files: ['test/fixtures/**'],
    rules: {
      'chai-friendly/no-unused-expressions': 'off',
      'import/unambiguous': 'off'
    }
  },
  ...ashNazg(['sauron', 'browser']).map((cfg) => {
    return {
      ...cfg,
      files: ['test/fixtures/**']
    };
  }),
  {
    rules: {
      // Todo: Use current jsdoc equivalent
      'jsdoc/check-examples': 0
    }
  }
];
