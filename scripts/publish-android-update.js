#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function parseArgs(argv) {
  if (argv.length < 2) {
    fail(
      'Usage: node scripts/publish-android-update.js <apk-path> <version> [--min-supported <version>] [--mandatory] [--notes <text>]',
    );
  }

  const options = {
    apkPath: argv[0],
    version: argv[1],
    minSupportedVersion: '',
    mandatory: false,
    releaseNotes: '',
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--mandatory') {
      options.mandatory = true;
      continue;
    }
    if (arg === '--min-supported') {
      index += 1;
      options.minSupportedVersion = String(argv[index] || '').trim();
      continue;
    }
    if (arg === '--notes') {
      index += 1;
      options.releaseNotes = String(argv[index] || '').trim();
      continue;
    }
    fail(`Unknown argument: ${arg}`);
  }

  if (!options.version) {
    fail('Version is required.');
  }

  return options;
}

const repoRoot = path.resolve(__dirname, '..');
const updatesDir = path.join(repoRoot, 'server', 'data', 'generated', 'app-updates');
const runtimeManifestPath = path.join(repoRoot, 'server', 'data', 'generated', 'app_update_manifest.json');
const defaultManifestPath = path.join(repoRoot, 'server', 'data', 'app_update_manifest.json');
const args = parseArgs(process.argv.slice(2));
const sourceApkPath = path.resolve(process.cwd(), args.apkPath);

if (!fs.existsSync(sourceApkPath)) {
  fail(`APK not found: ${sourceApkPath}`);
}

if (path.extname(sourceApkPath).toLowerCase() !== '.apk') {
  fail(`Expected an .apk file, got: ${sourceApkPath}`);
}

fs.mkdirSync(updatesDir, { recursive: true });

const outputFileName = `mobile-${args.version}.apk`;
const outputPath = path.join(updatesDir, outputFileName);
fs.copyFileSync(sourceApkPath, outputPath);

const defaultManifest = {
  android: {
    latestVersion: args.version,
    minimumSupportedVersion: args.version,
    mandatory: false,
    downloadUrl: `/static/app-updates/${outputFileName}`,
    releaseNotes: '',
  },
  ios: {
    latestVersion: '1.0.0',
    minimumSupportedVersion: '1.0.0',
    mandatory: false,
    downloadUrl: '',
    releaseNotes: '',
  },
};

const manifest = readJson(runtimeManifestPath, readJson(defaultManifestPath, defaultManifest));
const existingAndroid = manifest.android || defaultManifest.android;

manifest.android = {
  latestVersion: args.version,
  minimumSupportedVersion:
    args.minSupportedVersion || String(existingAndroid.minimumSupportedVersion || args.version).trim() || args.version,
  mandatory: args.mandatory,
  downloadUrl: `/static/app-updates/${outputFileName}`,
  releaseNotes: args.releaseNotes || String(existingAndroid.releaseNotes || '').trim(),
};

if (!manifest.ios) {
  manifest.ios = defaultManifest.ios;
}

fs.writeFileSync(runtimeManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

process.stdout.write(`Copied APK to ${outputPath}\n`);
process.stdout.write(`Updated manifest at ${runtimeManifestPath}\n`);
process.stdout.write(`Download URL: ${manifest.android.downloadUrl}\n`);
