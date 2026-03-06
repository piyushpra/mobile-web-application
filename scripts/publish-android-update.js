#!/usr/bin/env node

const crypto = require('crypto');
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
    appId: 'com.mobile',
    channel: 'production',
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
    if (arg === '--app-id') {
      index += 1;
      options.appId = String(argv[index] || '').trim();
      continue;
    }
    if (arg === '--channel') {
      index += 1;
      options.channel = String(argv[index] || '').trim().toLowerCase();
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

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
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
const outputStats = fs.statSync(outputPath);
const checksumSha256 = sha256File(outputPath);
const publishedAt = new Date().toISOString();

const defaultManifest = {
  android: {
    appId: args.appId,
    channel: args.channel,
    latestVersion: args.version,
    minimumSupportedVersion: args.version,
    mandatory: false,
    downloadUrl: `/static/app-updates/${outputFileName}`,
    releaseNotes: '',
    publishedAt,
    checksumSha256,
    fileSizeBytes: outputStats.size,
  },
  ios: {
    appId: '',
    channel: 'production',
    latestVersion: '1.0.0',
    minimumSupportedVersion: '1.0.0',
    mandatory: false,
    downloadUrl: '',
    releaseNotes: '',
    publishedAt: '',
    checksumSha256: '',
    fileSizeBytes: 0,
  },
};

const manifest = readJson(runtimeManifestPath, readJson(defaultManifestPath, defaultManifest));
const existingAndroid = manifest.android || defaultManifest.android;

manifest.android = {
  appId: args.appId,
  channel: args.channel,
  latestVersion: args.version,
  minimumSupportedVersion:
    args.minSupportedVersion || String(existingAndroid.minimumSupportedVersion || args.version).trim() || args.version,
  mandatory: args.mandatory,
  downloadUrl: `/static/app-updates/${outputFileName}`,
  releaseNotes: args.releaseNotes || String(existingAndroid.releaseNotes || '').trim(),
  publishedAt,
  checksumSha256,
  fileSizeBytes: outputStats.size,
};

if (!manifest.ios) {
  manifest.ios = defaultManifest.ios;
}

fs.writeFileSync(runtimeManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

process.stdout.write(`Copied APK to ${outputPath}\n`);
process.stdout.write(`Updated manifest at ${runtimeManifestPath}\n`);
process.stdout.write(`Download URL: ${manifest.android.downloadUrl}\n`);
process.stdout.write(`SHA-256: ${manifest.android.checksumSha256}\n`);
