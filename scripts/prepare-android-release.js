#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function readRequiredFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    fail(`Unable to read ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function writeFile(filePath, value) {
  fs.writeFileSync(filePath, value);
}

function incrementPatchVersion(version) {
  const parts = String(version || '')
    .trim()
    .split('.')
    .map(part => Number(part));

  if (parts.length === 0 || parts.some(part => !Number.isInteger(part) || part < 0)) {
    fail(`Current versionName is not a valid numeric version: ${version}`);
  }

  while (parts.length < 3) {
    parts.push(0);
  }

  parts[parts.length - 1] += 1;
  return parts.join('.');
}

function extractAndroidVersions(gradleText) {
  const versionCodeMatch = gradleText.match(/trackedVersionCode\s*=\s*(\d+)/);
  const versionNameMatch = gradleText.match(/trackedVersionName\s*=\s*"([^"]+)"/);

  if (!versionCodeMatch || !versionNameMatch) {
    fail('Could not find versionCode/versionName in android/app/build.gradle');
  }

  return {
    versionCode: Number(versionCodeMatch[1]),
    versionName: versionNameMatch[1],
  };
}

function parseArgs(argv, currentVersionName, currentVersionCode) {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(
      'Usage: node scripts/prepare-android-release.js [version-name] [--version-code <number>]\n',
    );
    process.exit(0);
  }

  const options = {
    versionName: '',
    versionCode: currentVersionCode + 1,
  };

  let index = 0;
  if (argv[0] && !argv[0].startsWith('--')) {
    options.versionName = String(argv[0]).trim();
    index = 1;
  } else {
    options.versionName = incrementPatchVersion(currentVersionName);
  }

  for (; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--version-code') {
      index += 1;
      options.versionCode = Number(argv[index]);
      continue;
    }
    fail(`Unknown argument: ${arg}`);
  }

  if (!options.versionName) {
    fail('versionName cannot be empty');
  }

  if (!Number.isInteger(options.versionCode) || options.versionCode <= currentVersionCode) {
    fail(`versionCode must be an integer greater than ${currentVersionCode}`);
  }

  return options;
}

function replaceVersionInGradle(gradleText, versionName, versionCode) {
  return gradleText
    .replace(/trackedVersionCode\s*=\s*\d+/, `trackedVersionCode = ${versionCode}`)
    .replace(/trackedVersionName\s*=\s*"[^"]+"/, `trackedVersionName = "${versionName}"`);
}

function replaceAppCurrentVersion(constantsText, versionName) {
  if (!/APP_CURRENT_VERSION/.test(constantsText)) {
    fail('Could not find APP_CURRENT_VERSION in src/app/constants.ts');
  }
  return constantsText.replace(
    /export const APP_CURRENT_VERSION = '[^']+';/,
    `export const APP_CURRENT_VERSION = '${versionName}';`,
  );
}

const repoRoot = path.resolve(__dirname, '..');
const gradlePath = path.join(repoRoot, 'android', 'app', 'build.gradle');
const constantsPath = path.join(repoRoot, 'src', 'app', 'constants.ts');

const gradleText = readRequiredFile(gradlePath);
const constantsText = readRequiredFile(constantsPath);
const currentVersions = extractAndroidVersions(gradleText);
const nextVersions = parseArgs(process.argv.slice(2), currentVersions.versionName, currentVersions.versionCode);

writeFile(gradlePath, replaceVersionInGradle(gradleText, nextVersions.versionName, nextVersions.versionCode));
writeFile(constantsPath, replaceAppCurrentVersion(constantsText, nextVersions.versionName));

process.stdout.write(`Updated Android release version\n`);
process.stdout.write(`versionCode: ${currentVersions.versionCode} -> ${nextVersions.versionCode}\n`);
process.stdout.write(`versionName: ${currentVersions.versionName} -> ${nextVersions.versionName}\n`);
