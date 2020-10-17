const parent = require('../.eslintrc.js');

module.exports = {
  ...parent,
  plugins: [...parent.plugins, 'jest'],
  parserOptions: {
    project: './tsconfig.eslint.json'
  },
};
