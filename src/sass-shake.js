const fs = require('fs');
const util = require('util');
const recursive = require('recursive-readdir');
const path = require('path');
const table = require('table').table;

const fileExtension = '.scss';

const sassFile = (filename) => `${filename}${fileExtension}`;

const sassPartial = (filename) => `_${sassFile(filename)}`;

const possibleFilenames = (filename) => [filename, sassFile(filename), sassPartial(filename)];

const unique = (array) => array.sort().filter((el, i, arr) => arr.indexOf(el) === i);

const findEntryPoints = (path) => fs.readdirSync(path)
  .filter((filename) => filename.includes('.scss'));

const checkIfExcluded = (file, exclusions) => {
  for (let exclusion of exclusions) {
    const exclusionRegex = new RegExp(exclusion.slice(1, exclusion.length - 1));

    if (exclusionRegex.test(file)) {
      return true;
    }
  }

  return false;
};

const traverseSassImportTree = async function (directory, filename, importList, shouldLog) {
  importList = importList || [];

  try {
    let filePath = path.join(directory, filename);
    let contents = fs.readFileSync(filePath).toString();

    importList.push(path.normalize(filePath));

    let importRegex = new RegExp('@import\\s+((?:,?\\s*["\'].*["\']\\s*)*)[\\s;]', 'gm');
    let match = importRegex.exec(contents);

    while (match !== null) {

      let importPathsString = match[1];
      let importPaths = importPathsString.split(',').map(path => path.replace(/[\s"']/g, ''));

      for (let importPath of importPaths) {

        let pathPartsRegex = new RegExp('(.*)\/([^\/]*)$');
        let pathParts = importPath.match(pathPartsRegex);
        let possibleImportFilenames = possibleFilenames(importPath);
        let importDirectory = directory;

        if (pathParts) {
          importDirectory = path.join(directory, pathParts[1]);
          possibleImportFilenames = possibleFilenames(pathParts[2]);
        }

        for (let filename of possibleImportFilenames) {
          await traverseSassImportTree(importDirectory, filename, importList, shouldLog);
        }
      }

      match = importRegex.exec(contents);
    }
  } catch (e) {
    if (shouldLog) {
      console.log(e);
    }
  }

  return importList;
};

const findUnusedFiles = async function (directory, filesInSassTree, exclusions) {
  let unusedFiles = [];
  let filesInDirectory = await recursive(directory);

  filesInDirectory.forEach((file) => {
    if (!checkIfExcluded(file, exclusions) && file.includes(fileExtension) && !filesInSassTree.includes(file)) {
      unusedFiles.push(file);
    }
  });

  return unusedFiles;
};

const displayEntryPoints = (entryPoints) => {
  console.log('\nTraversing entry points:\n');
  entryPoints.forEach((entryPoint) => console.log(`    ${entryPoint}`));
  console.log('\n');
};

const displayFiles = files => {
  const tableConfig = {
    columns: {
      0: {
        alignment: 'left',
        minWidth: 10
      },
      1: {
        alignment: 'right',
        minWidth: 10
      }
    }
  };

  let totalFileSize = 0;

  const fileData = files.map((file) => {
    let stats = fs.statSync(file);
    let fileSize = stats.size / 1000;
    totalFileSize += fileSize;
    return [file, fileSize];
  });

  let tableData = [['File', 'Size (kb)']];
  tableData = tableData.concat(fileData);

  tableData.push(['Total file size', totalFileSize.toFixed(2)]);

  const output = table(tableData, tableConfig);
  console.log(output);
};

const deleteFiles = files => {
  let deleteCounter = 0;
  for (let file of files) {
    fs.unlinkSync(file);
    deleteCounter++;
  }

  console.log(`Deleted ${deleteCounter} unused files in directory`);
};

const sassShake = async function (options) {
  let {
    path,
    entryPoints,
    exclude,
    verbose: shouldLog,
    deleteFiles: shouldDeleteFiles,
    hideTable: shouldHideTable
  } = options;

  // Entry points
  if (!entryPoints) {
    entryPoints = findEntryPoints(path);
  }

  if (entryPoints.length) {

    displayEntryPoints(entryPoints);

    // Used Sass Files
    let filesInSassTree = [];

    for (let entryPoint of entryPoints) {
      filesInSassTree = [...filesInSassTree, ...(await traverseSassImportTree(path, entryPoint, null, shouldLog))];
    }

    filesInSassTree = unique(filesInSassTree);
    console.log(`Found ${filesInSassTree.length} files in Sass tree\n`);


    // Deletion candidates
    let deletionCandidates = await findUnusedFiles(path, filesInSassTree, exclude);

    if (!shouldHideTable) {
      displayFiles(deletionCandidates);
    }

    console.log(`Found ${deletionCandidates.length} unused files in directory tree ${path}`);


    // Deletion
    if (shouldDeleteFiles) {
      deleteFiles(deletionCandidates);
    }

  } else {
    console.log('No entrypoints found (to explicitly specify them, use the --entryPoints flag)');
  }
};

module.exports = sassShake;
