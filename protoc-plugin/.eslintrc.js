const parent = require('../.eslintrc.js');

module.exports = {
  ...parent,
  plugins: [...parent.plugins, 'jest'],
};
