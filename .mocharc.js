export default {
  reporter: 'mocha-multi-reporters',
  'reporter-option': [
    'configFile=mocha-multi-reporters.json'
  ],
  require: [
    'chai/register-expect.js'
  ]
};
