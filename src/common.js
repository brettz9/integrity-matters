export const basePathToRegex = (cliString) => {
  return new RegExp(cliString, 'vm');
};

export const hasOwn = (obj, prop) => {
  return {}.hasOwnProperty.call(obj, prop);
};
