#!/usr/bin/env node

const program = require('commander');
const sassShake = require('../src/sass-shake.js');

const list = (val) => val.split(',');

program
  .version('1.0.0')
  .option('-p, --path <path>', 'Path to shake, current working directory by default')
  .option('-f, --entryPoints <entryPoints>', 'Sass entry point files', list)
  .option('-e, --exclude <exclusions>', 'An array of regexp pattern strings that are matched against files to exclude them from the unused files list', list)
  .option('-v, --verbose', 'Show all errors')
  .option('-d, --deleteFiles', 'Delete the unused files')
  .option('-t, --hideTable', 'Hide the unused files table')
  .parse(process.argv);

const options = {
  ...program,
  path: program.path || process.cwd()
};

sassShake(options);
