const fs = require('fs');

const strykerTmpDir = './.stryker-tmp';
const srcPrettier = '../.prettierrc.js';
const destPrettier = `${strykerTmpDir}/.prettierrc.js`;

if (!fs.existsSync(strykerTmpDir)) {
  fs.mkdirSync(strykerTmpDir);
}
if (!fs.existsSync(destPrettier)) {
  fs.copyFileSync(srcPrettier, destPrettier);
}
