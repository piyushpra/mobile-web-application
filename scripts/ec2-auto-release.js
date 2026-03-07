#!/usr/bin/env node

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    fail(`Command failed: ${command} ${args.join(' ')}`);
  }
}

function runCapture(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function isTruthyEnv(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function readGitCommandConfigFlag(configKey) {
  const count = Number(process.env.GIT_CONFIG_COUNT || 0);
  if (Number.isInteger(count) && count > 0) {
    for (let index = 0; index < count; index += 1) {
      const key = String(process.env[`GIT_CONFIG_KEY_${index}`] || '').trim();
      if (key === configKey) {
        return isTruthyEnv(process.env[`GIT_CONFIG_VALUE_${index}`]);
      }
    }
  }

  try {
    return isTruthyEnv(runCapture('git', ['config', '--bool', '--get', configKey], { cwd: repoRoot }));
  } catch {
    return false;
  }
}

function incrementPatchVersion(version) {
  const parts = String(version || '')
    .trim()
    .split('.')
    .map(part => Number(part));
  if (parts.length === 0 || parts.some(part => !Number.isInteger(part) || part < 0)) {
    fail(`Invalid version string: ${version}`);
  }
  while (parts.length < 3) {
    parts.push(0);
  }
  parts[parts.length - 1] += 1;
  return parts.join('.');
}

function extractTrackedAndroidVersion(gradleText) {
  const versionCodeMatch = gradleText.match(/trackedVersionCode\s*=\s*(\d+)/);
  const versionNameMatch = gradleText.match(/trackedVersionName\s*=\s*"([^"]+)"/);

  const versionCode = Number(versionCodeMatch?.[1] || 1);
  const versionName = String(versionNameMatch?.[1] || '').trim();

  if (!versionName) {
    fail('Could not determine tracked Android versionName from android/app/build.gradle');
  }

  return { versionCode, versionName };
}

function ensureAndroidLocalProperties(repoRoot, sdkDir) {
  if (!fs.existsSync(sdkDir)) {
    fail(`Android SDK directory not found: ${sdkDir}`);
  }
  const localPropertiesPath = path.join(repoRoot, 'android', 'local.properties');
  fs.writeFileSync(localPropertiesPath, `sdk.dir=${sdkDir}\n`);
}

function getChangedFiles(repoRoot) {
  if (process.env.AUTO_RELEASE_CHANGED_FILES) {
    return String(process.env.AUTO_RELEASE_CHANGED_FILES)
      .split('\n')
      .map(value => value.trim())
      .filter(Boolean);
  }

  try {
    const origHead = runCapture('git', ['rev-parse', '-q', '--verify', 'ORIG_HEAD'], { cwd: repoRoot });
    if (!origHead) {
      return [];
    }
    return runCapture('git', ['diff', '--name-only', `${origHead}..HEAD`], { cwd: repoRoot })
      .split('\n')
      .map(value => value.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isReleaseRelevantChange(filePath) {
  return /^(android\/|src\/|server\/|scripts\/|package\.json$|package-lock\.json$|yarn\.lock$)/.test(filePath);
}

const repoRoot = path.resolve(__dirname, '..');
const skipMarkerPath = path.join(repoRoot, '.git', 'skip-auto-release');
const skipByGitPullFlag = readGitCommandConfigFlag('autoRelease.skipBuild');
const generatedRoot = path.join(repoRoot, 'server', 'data', 'generated');
const releaseStatePath = path.join(generatedRoot, 'android_release_state.json');
const runtimeManifestPath = path.join(generatedRoot, 'app_update_manifest.json');
const gradlePath = path.join(repoRoot, 'android', 'app', 'build.gradle');
const trackedGradleText = fs.readFileSync(gradlePath, 'utf8');
const trackedVersion = extractTrackedAndroidVersion(trackedGradleText);
const priorState = readJson(releaseStatePath, {});
const priorManifest = readJson(runtimeManifestPath, {});
const changedFiles = getChangedFiles(repoRoot);

if (skipByGitPullFlag || isTruthyEnv(process.env.SKIP_AUTO_RELEASE) || fs.existsSync(skipMarkerPath)) {
  process.stdout.write('Skipping auto-release: SKIP_AUTO_RELEASE is enabled.\n');
  process.exit(0);
}

if (changedFiles.length > 0 && !changedFiles.some(isReleaseRelevantChange)) {
  process.stdout.write('Skipping auto-release: no release-relevant changes detected.\n');
  process.exit(0);
}

const baseVersionName =
  String(priorState.versionName || priorManifest?.android?.latestVersion || trackedVersion.versionName).trim() ||
  trackedVersion.versionName;
const baseVersionCode = Number(priorState.versionCode || trackedVersion.versionCode);
const nextVersionName = process.env.AUTO_RELEASE_VERSION_NAME || incrementPatchVersion(baseVersionName);
const nextVersionCode = process.env.AUTO_RELEASE_VERSION_CODE
  ? Number(process.env.AUTO_RELEASE_VERSION_CODE)
  : baseVersionCode + 1;

if (!Number.isInteger(nextVersionCode) || nextVersionCode <= baseVersionCode) {
  fail(`AUTO_RELEASE_VERSION_CODE must be greater than ${baseVersionCode}`);
}

const sdkDir = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || '/home/ubuntu/Android/Sdk';
ensureAndroidLocalProperties(repoRoot, sdkDir);

if (!fs.existsSync(path.join(repoRoot, 'node_modules')) || changedFiles.some(filePath => /^(package\.json|package-lock\.json|yarn\.lock)$/.test(filePath))) {
  run('npm', ['ci'], { cwd: repoRoot, env: process.env });
}

const commitSha = runCapture('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoRoot });
const commitSubject = runCapture('git', ['log', '-1', '--pretty=%s'], { cwd: repoRoot });
const releaseNotes = process.env.AUTO_RELEASE_NOTES || `${commitSubject} (${commitSha})`;

run('./android/gradlew', [
  '-p',
  'android',
  'assembleRelease',
  `-PVERSION_CODE_OVERRIDE=${nextVersionCode}`,
  `-PVERSION_NAME_OVERRIDE=${nextVersionName}`,
], {
  cwd: repoRoot,
  env: {
    ...process.env,
    ANDROID_HOME: sdkDir,
    ANDROID_SDK_ROOT: sdkDir,
  },
});

run('node', [
  'scripts/publish-android-update.js',
  'android/app/build/outputs/apk/release/app-release.apk',
  nextVersionName,
  '--notes',
  releaseNotes,
], {
  cwd: repoRoot,
  env: process.env,
});

fs.mkdirSync(generatedRoot, { recursive: true });
fs.writeFileSync(
  releaseStatePath,
  `${JSON.stringify({
    versionCode: nextVersionCode,
    versionName: nextVersionName,
    releasedAt: new Date().toISOString(),
    commitSha,
    commitSubject,
    changedFiles,
  }, null, 2)}\n`,
);

const pm2AppName = process.env.PM2_APP_NAME || 'mobile-api';
run('pm2', ['restart', pm2AppName, '--update-env'], {
  cwd: repoRoot,
  env: {
    ...process.env,
    APP_ENV: process.env.APP_ENV || 'production',
  },
});

process.stdout.write(`Auto release complete: ${nextVersionName} (${nextVersionCode})\n`);
