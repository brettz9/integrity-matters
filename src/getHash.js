import {createReadStream} from 'fs';
import crypto from 'crypto';

/**
 * @param {"sha256"|"sha384"|"sha512"} algorithm
 * @param {string} path
 * @returns {Promise<string>}
*/
function getHash (algorithm, path) {
  const hash = crypto.createHash(algorithm);
  // eslint-disable-next-line promise/avoid-new -- Has no promise API
  return new Promise((resolve, reject) => {
    hash.on('readable', () => {
      const data = hash.read();
      if (data) {
        resolve(
          data.toString('base64')
        );
      }
    });
    const input = createReadStream(path);
    input.pipe(hash);
  });
}

export default getHash;
