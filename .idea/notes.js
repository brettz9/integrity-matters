// Parses, but semver doesn't have a utility for `maxRange`, e.g., getting
//  7.x out of `6.x || 7.x` (as could be used to update to the latest
//  for the user)
const Range = require('semver/classes/range');
// Todo: Make configurable
const rangeOptions = {
  loose: false,
  includePrerelease: false
};
console.log('semverParse', new Range('>=5 || 7.2.x', rangeOptions).set);
