#!/usr/bin/env bun

/**
 * Script to anonymize an Nx package for testing purposes.
 *
 * Usage: bun tools/scripts/anonymize-package.js <package-path>
 * Example: bun tools/scripts/anonymize-package.js packages/calculators/income-tax
 *
 * This script:
 * - Renames the package directory to an arbitrary name
 * - Removes implementation code (keeps only exports/stubs)
 * - Deletes unused implementation files
 * - Removes empty directories
 * - Replaces test code with assert(true)
 * - Anonymizes test file names
 * - Anonymizes test names and descriptions
 * - Updates references in project.json, package.json, and tsconfig files
 */

const fs = require('fs');
const path = require('path');

// Generate an arbitrary name for the package
function generateAnonymizedName(originalName) {
  // Create a hash-like name based on the original name
  const hash = originalName.split('').reduce((acc, char) => {
    return (acc << 5) - acc + char.charCodeAt(0);
  }, 0);
  const absHash = Math.abs(hash);
  return `package-${absHash.toString(36)}`;
}

// Generate an arbitrary test file name
function generateTestFileName(originalName, index) {
  const hash = (originalName + index).split('').reduce((acc, char) => {
    return (acc << 5) - acc + char.charCodeAt(0);
  }, 0);
  const absHash = Math.abs(hash);
  return `test-${absHash.toString(36)}.test.ts`;
}

// Generate an arbitrary test name
function generateTestName(index) {
  return `test_${index.toString(36)}`;
}

// Generate an arbitrary folder name
function generateFolderName(originalName, index) {
  const hash = (originalName + index).split('').reduce((acc, char) => {
    return (acc << 5) - acc + char.charCodeAt(0);
  }, 0);
  const absHash = Math.abs(hash);
  return `dir-${absHash.toString(36)}`;
}

// Find all test files recursively
function findTestFiles(dir, testFiles = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and dist directories
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        findTestFiles(fullPath, testFiles);
      }
    } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      testFiles.push(fullPath);
    }
  }

  return testFiles;
}

// Find all source files (non-test TypeScript files)
function findSourceFiles(dir, sourceFiles = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules, dist, and test directories
      if (
        entry.name !== 'node_modules' &&
        entry.name !== 'dist' &&
        entry.name !== 'test'
      ) {
        findSourceFiles(fullPath, sourceFiles);
      }
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      entry.name !== 'vitest.config.ts'
    ) {
      sourceFiles.push(fullPath);
    }
  }

  return sourceFiles;
}

// Replace test file content with assert(true)
function anonymizeTestFile(filePath, testIndex) {
  const content = `import { assert } from 'vitest';

describe('${generateTestName(testIndex)}', () => {
  it('${generateTestName(testIndex + 1000)}', () => {
    assert(true);
  });
});
`;
  fs.writeFileSync(filePath, content, 'utf8');
}

// Remove implementation code from source files, keeping only exports
function anonymizeSourceFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Extract exports (export statements)
  const exportLines = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith('export ') ||
      trimmed.startsWith('export type ') ||
      trimmed.startsWith('export interface ') ||
      trimmed.startsWith('export enum ')
    ) {
      exportLines.push(line);
    }
  }

  // If no exports found, create a minimal stub
  if (exportLines.length === 0) {
    content = `// Anonymized file
export {};
`;
  } else {
    // Keep only export statements, add a comment
    content = `// Anonymized file - implementation removed
${exportLines.join('\n')}
`;
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

// Update package.json
function updatePackageJson(packageJsonPath, newPackageName) {
  if (!fs.existsSync(packageJsonPath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (packageJson.name) {
    packageJson.name = `@anonymized/${newPackageName}`;
  }
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf8',
  );
}

// Update project.json
function updateProjectJson(projectJsonPath, newPackageName) {
  if (!fs.existsSync(projectJsonPath)) {
    return;
  }

  const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
  if (projectJson.name) {
    projectJson.name = newPackageName;
  }
  fs.writeFileSync(
    projectJsonPath,
    JSON.stringify(projectJson, null, 2) + '\n',
    'utf8',
  );
}

// Update tsconfig.base.json
function updateTsConfigBase(
  tsConfigPath,
  oldPath,
  newPath,
  oldImportPath,
  newImportPath,
) {
  if (!fs.existsSync(tsConfigPath)) {
    return;
  }

  let content = fs.readFileSync(tsConfigPath, 'utf8');

  // Replace path references
  content = content.replace(
    new RegExp(`"${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'),
    `"${newPath}"`,
  );

  // Replace import path references if they exist
  if (oldImportPath && newImportPath) {
    content = content.replace(
      new RegExp(
        `"${oldImportPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`,
        'g',
      ),
      `"${newImportPath}"`,
    );
  }

  fs.writeFileSync(tsConfigPath, content, 'utf8');
}

// Get import path from package.json
function getImportPath(packageJsonPath) {
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return packageJson.name || null;
}

// Extract imports from a file, returning both direct imports and re-exports
function extractImports(filePath, packageRoot) {
  if (!fs.existsSync(filePath)) {
    return { directImports: [], reExports: [] };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const directImports = [];
  const reExports = [];

  // Match import statements: import ... from '...' (direct imports)
  const importRegex = /import\s+[^{*].*?\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];

    // Skip external packages (starting with @ or not relative)
    if (
      importPath.startsWith('@') ||
      (!importPath.startsWith('.') && !importPath.startsWith('/'))
    ) {
      continue;
    }

    // Resolve relative import to absolute path
    const dir = path.dirname(filePath);
    let resolvedPath;

    if (importPath.endsWith('.ts')) {
      resolvedPath = path.resolve(dir, importPath);
    } else {
      // Try .ts extension
      resolvedPath = path.resolve(dir, importPath + '.ts');
      if (!fs.existsSync(resolvedPath)) {
        // Try index.ts
        resolvedPath = path.resolve(dir, importPath, 'index.ts');
      }
    }

    // Only include if it's within the package
    const normalizedResolved = path.normalize(resolvedPath);
    const normalizedRoot = path.normalize(packageRoot);
    if (
      normalizedResolved.startsWith(normalizedRoot) &&
      fs.existsSync(normalizedResolved)
    ) {
      directImports.push(normalizedResolved);
    }
  }

  // Also check for export ... from '...' (re-exports)
  const exportFromRegex = /export\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = exportFromRegex.exec(content)) !== null) {
    const importPath = match[1];

    if (
      importPath.startsWith('@') ||
      (!importPath.startsWith('.') && !importPath.startsWith('/'))
    ) {
      continue;
    }

    const dir = path.dirname(filePath);
    let resolvedPath;

    if (importPath.endsWith('.ts')) {
      resolvedPath = path.resolve(dir, importPath);
    } else {
      resolvedPath = path.resolve(dir, importPath + '.ts');
      if (!fs.existsSync(resolvedPath)) {
        resolvedPath = path.resolve(dir, importPath, 'index.ts');
      }
    }

    const normalizedResolved = path.normalize(resolvedPath);
    const normalizedRoot = path.normalize(packageRoot);
    if (
      normalizedResolved.startsWith(normalizedRoot) &&
      fs.existsSync(normalizedResolved)
    ) {
      reExports.push(normalizedResolved);
    }
  }

  return { directImports, reExports };
}

// Find all files that are actually used (starting from entry points)
function findUsedFiles(packageRoot) {
  const usedFiles = new Set();
  const directlyImportedFiles = new Set(); // Files that are directly imported (not just re-exported)
  const reExportedFiles = new Set(); // Files that are only re-exported
  const entryPoint = path.join(packageRoot, 'src', 'index.ts');

  if (!fs.existsSync(entryPoint)) {
    return { usedFiles, reExportedFiles };
  }

  const normalizedEntryPoint = path.normalize(entryPoint);
  const toProcess = [normalizedEntryPoint];

  while (toProcess.length > 0) {
    const currentFile = path.normalize(toProcess.shift());

    if (usedFiles.has(currentFile)) {
      continue;
    }

    usedFiles.add(currentFile);

    const content = fs.readFileSync(currentFile, 'utf8');

    // Check for direct imports (not re-exports)
    const directImportRegex = /import\s+[^{*].*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = directImportRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith('.') || importPath.startsWith('/')) {
        const dir = path.dirname(currentFile);
        let resolvedPath;

        if (importPath.endsWith('.ts')) {
          resolvedPath = path.resolve(dir, importPath);
        } else {
          resolvedPath = path.resolve(dir, importPath + '.ts');
          if (!fs.existsSync(resolvedPath)) {
            resolvedPath = path.resolve(dir, importPath, 'index.ts');
          }
        }

        const normalizedResolved = path.normalize(resolvedPath);
        const normalizedRoot = path.normalize(packageRoot);
        if (
          normalizedResolved.startsWith(normalizedRoot) &&
          fs.existsSync(normalizedResolved)
        ) {
          directlyImportedFiles.add(normalizedResolved);
        }
      }
    }

    // Find all imports (including re-exports)
    const { directImports, reExports } = extractImports(
      currentFile,
      packageRoot,
    );

    // Track directly imported files
    for (const importPath of directImports) {
      const normalizedImport = path.normalize(importPath);
      directlyImportedFiles.add(normalizedImport);
      if (!usedFiles.has(normalizedImport)) {
        toProcess.push(normalizedImport);
      }
    }

    // Track re-exported files (they're used but may be deletable)
    for (const importPath of reExports) {
      const normalizedImport = path.normalize(importPath);
      if (!usedFiles.has(normalizedImport)) {
        toProcess.push(normalizedImport);
      }
    }
  }

  // Files that are used but not directly imported are re-exported only
  usedFiles.forEach((file) => {
    if (
      !directlyImportedFiles.has(file) &&
      !file.endsWith('index.ts') &&
      file.endsWith('.ts')
    ) {
      reExportedFiles.add(file);
    }
  });

  return { usedFiles, reExportedFiles };
}

// Delete a file
function deleteFile(filePath) {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    console.warn(`  Warning: Could not delete ${filePath}: ${error.message}`);
    return false;
  }
}

// Check if directory is empty
function isDirectoryEmpty(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath);
    return entries.length === 0;
  } catch {
    return false;
  }
}

// Remove empty directories recursively
function removeEmptyDirectories(dirPath, packageRoot) {
  // Don't remove the package root itself
  if (dirPath === packageRoot) {
    return;
  }

  try {
    if (isDirectoryEmpty(dirPath)) {
      fs.rmdirSync(dirPath);
      console.log(
        `  Removed empty directory: ${path.relative(packageRoot, dirPath)}`,
      );

      // Try to remove parent directory if it becomes empty
      const parentDir = path.dirname(dirPath);
      if (parentDir !== dirPath && parentDir.startsWith(packageRoot)) {
        removeEmptyDirectories(parentDir, packageRoot);
      }
    }
  } catch (error) {
    // Directory might not be empty or might have been removed already
  }
}

// Rename directories to anonymized names
function anonymizeDirectories(packageRoot, dirMap = new Map(), index = 0) {
  const entries = fs.readdirSync(packageRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    // Skip certain directories
    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === '.git' ||
      entry.name === 'test'
    ) {
      continue;
    }

    const fullPath = path.join(packageRoot, entry.name);

    // Recursively process subdirectories first
    anonymizeDirectories(fullPath, dirMap, index);

    // Generate new name
    const newName = generateFolderName(entry.name, index++);
    const newPath = path.join(packageRoot, newName);

    if (entry.name !== newName) {
      // Store mapping for path updates
      dirMap.set(fullPath, newPath);

      // Rename the directory
      fs.renameSync(fullPath, newPath);
      console.log(
        `  Renamed directory: ${path.relative(packageRoot, fullPath)} -> ${path.relative(packageRoot, newPath)}`,
      );
    }
  }

  return dirMap;
}

// Update file paths in export statements after directory renaming
function updateExportPaths(filePath, dirMap) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Update export ... from paths
  const exportFromRegex = /export\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  content = content.replace(exportFromRegex, (match, importPath) => {
    // Only process relative paths
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return match;
    }

    const dir = path.dirname(filePath);
    let resolvedPath;

    if (importPath.endsWith('.ts')) {
      resolvedPath = path.resolve(dir, importPath);
    } else {
      resolvedPath = path.resolve(dir, importPath + '.ts');
      if (!fs.existsSync(resolvedPath)) {
        resolvedPath = path.resolve(dir, importPath, 'index.ts');
      }
    }

    // Check if any parent directory was renamed
    for (const [oldDir, newDir] of dirMap.entries()) {
      if (resolvedPath.startsWith(oldDir)) {
        const relativePath = path.relative(oldDir, resolvedPath);
        const newResolvedPath = path.join(newDir, relativePath);
        const newRelativePath = path
          .relative(dir, newResolvedPath)
          .replace(/\\/g, '/');

        // Reconstruct the import path
        let newImportPath;
        if (importPath.endsWith('.ts')) {
          newImportPath = newRelativePath;
        } else if (importPath.endsWith('/index') || importPath.endsWith('/')) {
          newImportPath = newRelativePath
            .replace(/\/index\.ts$/, '')
            .replace(/\.ts$/, '');
        } else {
          newImportPath = newRelativePath.replace(/\.ts$/, '');
        }

        // Ensure it starts with ./
        if (!newImportPath.startsWith('.')) {
          newImportPath = './' + newImportPath;
        }

        modified = true;
        return match.replace(importPath, newImportPath);
      }
    }

    return match;
  });

  // Update import ... from paths
  const importFromRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  content = content.replace(importFromRegex, (match, importPath) => {
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return match;
    }

    const dir = path.dirname(filePath);
    let resolvedPath;

    if (importPath.endsWith('.ts')) {
      resolvedPath = path.resolve(dir, importPath);
    } else {
      resolvedPath = path.resolve(dir, importPath + '.ts');
      if (!fs.existsSync(resolvedPath)) {
        resolvedPath = path.resolve(dir, importPath, 'index.ts');
      }
    }

    for (const [oldDir, newDir] of dirMap.entries()) {
      if (resolvedPath.startsWith(oldDir)) {
        const relativePath = path.relative(oldDir, resolvedPath);
        const newResolvedPath = path.join(newDir, relativePath);
        const newRelativePath = path
          .relative(dir, newResolvedPath)
          .replace(/\\/g, '/');

        let newImportPath;
        if (importPath.endsWith('.ts')) {
          newImportPath = newRelativePath;
        } else if (importPath.endsWith('/index') || importPath.endsWith('/')) {
          newImportPath = newRelativePath
            .replace(/\/index\.ts$/, '')
            .replace(/\.ts$/, '');
        } else {
          newImportPath = newRelativePath.replace(/\.ts$/, '');
        }

        if (!newImportPath.startsWith('.')) {
          newImportPath = './' + newImportPath;
        }

        modified = true;
        return match.replace(importPath, newImportPath);
      }
    }

    return match;
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

// Main function
function main() {
  const packagePath = process.argv[2];

  if (!packagePath) {
    console.error(
      'Usage: bun tools/scripts/anonymize-package.js <package-path>',
    );
    console.error(
      'Example: bun tools/scripts/anonymize-package.js packages/calculators/income-tax',
    );
    process.exit(1);
  }

  const absolutePackagePath = path.resolve(packagePath);

  if (!fs.existsSync(absolutePackagePath)) {
    console.error(`Error: Package path does not exist: ${absolutePackagePath}`);
    process.exit(1);
  }

  if (!fs.statSync(absolutePackagePath).isDirectory()) {
    console.error(
      `Error: Package path is not a directory: ${absolutePackagePath}`,
    );
    process.exit(1);
  }

  const packageName = path.basename(absolutePackagePath);
  const newPackageName = generateAnonymizedName(packageName);
  const packageDir = path.dirname(absolutePackagePath);
  const newPackagePath = path.join(packageDir, newPackageName);

  console.log(`Anonymizing package: ${packageName} -> ${newPackageName}`);
  console.log(`Path: ${absolutePackagePath} -> ${newPackagePath}`);

  // Get import path before renaming
  const packageJsonPath = path.join(absolutePackagePath, 'package.json');
  const oldImportPath = getImportPath(packageJsonPath);
  const newImportPath = oldImportPath ? `@anonymized/${newPackageName}` : null;

  // Find all test files
  console.log('Finding test files...');
  const testFiles = findTestFiles(absolutePackagePath);
  console.log(`Found ${testFiles.length} test files`);

  // Anonymize test files
  console.log('Anonymizing test files...');
  testFiles.forEach((testFile, index) => {
    anonymizeTestFile(testFile, index);

    // Rename test file
    const dir = path.dirname(testFile);
    const newTestFileName = generateTestFileName(
      path.basename(testFile),
      index,
    );
    const newTestFilePath = path.join(dir, newTestFileName);

    if (testFile !== newTestFilePath) {
      fs.renameSync(testFile, newTestFilePath);
      console.log(
        `  Renamed: ${path.relative(absolutePackagePath, testFile)} -> ${path.relative(absolutePackagePath, newTestFilePath)}`,
      );
    }
  });

  // Find all source files
  console.log('Finding source files...');
  const sourceFiles = findSourceFiles(absolutePackagePath);
  console.log(`Found ${sourceFiles.length} source files`);

  // Delete test/ directories (cucumber tests)
  console.log('Deleting test/ directories...');
  function deleteTestDirectories(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === 'test') {
          console.log(
            `  Deleting test directory: ${path.relative(absolutePackagePath, fullPath)}`,
          );
          fs.rmSync(fullPath, { recursive: true, force: true });
        } else if (
          entry.name !== 'node_modules' &&
          entry.name !== 'dist' &&
          entry.name !== '.git'
        ) {
          deleteTestDirectories(fullPath);
        }
      }
    }
  }

  deleteTestDirectories(absolutePackagePath);

  // Delete all non-test TypeScript files
  console.log('Deleting all non-test TypeScript files...');
  let deletedCount = 0;
  sourceFiles.forEach((sourceFile) => {
    // Skip test files
    if (sourceFile.endsWith('.test.ts') || sourceFile.endsWith('.spec.ts')) {
      return;
    }

    // Skip vitest.config.ts (must be preserved)
    if (path.basename(sourceFile) === 'vitest.config.ts') {
      return;
    }

    // Skip if file was already deleted (e.g., in test/ directory)
    if (!fs.existsSync(sourceFile)) {
      return;
    }

    console.log(
      `  Deleting: ${path.relative(absolutePackagePath, sourceFile)}`,
    );
    if (deleteFile(sourceFile)) {
      deletedCount++;
      // Try to remove parent directory if it becomes empty
      const parentDir = path.dirname(sourceFile);
      removeEmptyDirectories(parentDir, absolutePackagePath);
    }
  });
  console.log(`Deleted ${deletedCount} implementation files`);

  // Ensure vitest.config.ts exists (needed for vitest to work with globals)
  console.log('Ensuring vitest.config.ts exists...');
  const vitestConfigPath = path.join(absolutePackagePath, 'vitest.config.ts');
  if (!fs.existsSync(vitestConfigPath)) {
    // Calculate relative path to vitest.base.ts from package root
    const workspaceRoot = process.cwd();
    const relativePath = path
      .relative(absolutePackagePath, path.join(workspaceRoot, 'vitest.base.ts'))
      .replace(/\\/g, '/');
    const vitestConfigContent = `import { createVitestConfig } from '${relativePath}';

export default createVitestConfig();
`;
    fs.writeFileSync(vitestConfigPath, vitestConfigContent, 'utf8');
    console.log(`  Created: vitest.config.ts`);
  }

  // Anonymize directory names
  console.log('Anonymizing directory names...');
  const srcDirPath = path.join(absolutePackagePath, 'src');
  const dirMap = anonymizeDirectories(srcDirPath);

  // Update all file paths after directory renaming
  console.log('Updating file paths after directory renaming...');
  function updateAllFilePaths(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (
          entry.name !== 'node_modules' &&
          entry.name !== 'dist' &&
          entry.name !== '.git' &&
          entry.name !== 'test'
        ) {
          updateAllFilePaths(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        updateExportPaths(fullPath, dirMap);
      }
    }
  }

  if (fs.existsSync(srcDirPath)) {
    updateAllFilePaths(srcDirPath);
  }

  // Final cleanup: remove any remaining empty directories
  console.log('Cleaning up empty directories...');
  function cleanupEmptyDirs(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip certain directories
        if (
          entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name === '.git'
        ) {
          continue;
        }

        if (entry.isDirectory()) {
          cleanupEmptyDirs(fullPath);
        }
      }

      // After processing children, check if this directory is now empty
      if (dir !== absolutePackagePath && isDirectoryEmpty(dir)) {
        removeEmptyDirectories(dir, absolutePackagePath);
      }
    } catch (error) {
      // Directory might have been removed or doesn't exist
    }
  }

  cleanupEmptyDirs(absolutePackagePath);

  // Update package.json
  console.log('Updating package.json...');
  updatePackageJson(packageJsonPath, newPackageName);

  // Update project.json
  console.log('Updating project.json...');
  const projectJsonPath = path.join(absolutePackagePath, 'project.json');
  updateProjectJson(projectJsonPath, newPackageName);

  // Rename the package directory
  console.log('Renaming package directory...');
  fs.renameSync(absolutePackagePath, newPackagePath);

  // Update tsconfig.base.json
  console.log('Updating tsconfig.base.json...');
  const workspaceRoot = process.cwd();
  const tsConfigBasePath = path.join(workspaceRoot, 'tsconfig.base.json');
  const oldPath = absolutePackagePath
    .replace(workspaceRoot + path.sep, '')
    .replace(/\\/g, '/');
  const newPath = newPackagePath
    .replace(workspaceRoot + path.sep, '')
    .replace(/\\/g, '/');

  updateTsConfigBase(
    tsConfigBasePath,
    oldPath,
    newPath,
    oldImportPath,
    newImportPath,
  );

  // Update tsconfig.api.json if it exists
  console.log('Updating tsconfig.api.json...');
  const tsConfigApiPath = path.join(workspaceRoot, 'tsconfig.api.json');
  if (fs.existsSync(tsConfigApiPath)) {
    // For api.json, paths point to dist, so adjust accordingly
    const oldDistPath = oldPath.replace('/src/index.ts', '/dist/src/index.ts');
    const newDistPath = newPath.replace('/src/index.ts', '/dist/src/index.ts');
    updateTsConfigBase(
      tsConfigApiPath,
      oldDistPath,
      newDistPath,
      oldImportPath,
      newImportPath,
    );
  }

  console.log('Anonymization complete!');
  console.log(`Package renamed from ${packageName} to ${newPackageName}`);
}

main();
