module.exports = {
  ...require('../.eslintrc.js'),
  plugins: [...require('../.eslintrc.js').plugins, 'jest'],
};
