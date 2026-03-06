const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const CONFIG_DIR = path.join(ROOT_DIR, 'config');
const SHARED_ENV_PATH = path.join(ROOT_DIR, '.env');

function parseEnvFile(text) {
  const entries = {};
  const lines = String(text || '').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    const hasMatchingQuotes =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));

    if (hasMatchingQuotes) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
}

function applyEnvEntries(entries, lockedKeys, override = false) {
  for (const [key, value] of Object.entries(entries)) {
    if (lockedKeys.has(key)) {
      continue;
    }
    if (!override && process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = value;
  }
}

function loadEnvFile(filePath, lockedKeys, override = false) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const entries = parseEnvFile(raw);
  applyEnvEntries(entries, lockedKeys, override);
  return true;
}

function normalizeAppEnv(value) {
  const raw = String(value || '').trim().toLowerCase();
  return raw === 'production' ? 'production' : 'local';
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

const lockedEnvKeys = new Set(Object.keys(process.env));
const loadedFiles = [];

if (loadEnvFile(SHARED_ENV_PATH, lockedEnvKeys, false)) {
  loadedFiles.push(SHARED_ENV_PATH);
}

const appEnv = normalizeAppEnv(process.env.APP_ENV || process.env.NODE_ENV);
const envFilePath = path.join(CONFIG_DIR, `${appEnv}.env`);

if (loadEnvFile(envFilePath, lockedEnvKeys, true)) {
  loadedFiles.push(envFilePath);
}

const config = {
  appEnv,
  appName: String(process.env.APP_NAME || 'Mobile Application').trim() || 'Mobile Application',
  rootDir: ROOT_DIR,
  configDir: CONFIG_DIR,
  loadedFiles,
  port: parseNumber(process.env.PORT, 4000),
  sessionTtlMs: parseNumber(process.env.SESSION_TTL_MS, 1000 * 60 * 60 * 24 * 365 * 10),
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseNumber(process.env.MYSQL_PORT, 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'apple',
    database: process.env.MYSQL_DATABASE || 'mobile_app_db',
    poolSize: parseNumber(process.env.MYSQL_POOL_SIZE, 10),
  },
  uploads: {
    maxItemUploadCount: parseNumber(process.env.MAX_ITEM_UPLOAD_COUNT, 5),
    maxItemUploadBytes: parseNumber(process.env.MAX_ITEM_UPLOAD_BYTES, 5 * 1024 * 1024),
  },
  auth: {
    publicBaseUrl: String(process.env.AUTH_PUBLIC_BASE_URL || process.env.APP_PUBLIC_URL || '').trim(),
    resetTokenTtlMs: parseNumber(process.env.AUTH_RESET_TOKEN_TTL_MS, 15 * 60 * 1000),
    resetRequestCooldownMs: parseNumber(process.env.AUTH_RESET_REQUEST_COOLDOWN_MS, 60 * 1000),
  },
  mail: {
    host: String(process.env.SMTP_HOST || '').trim(),
    port: parseNumber(process.env.SMTP_PORT, 587),
    secure: parseBool(process.env.SMTP_SECURE, false),
    user: String(process.env.SMTP_USER || '').trim(),
    password: String(process.env.SMTP_PASSWORD || ''),
    from: String(process.env.SMTP_FROM || '').trim(),
  },
  appUpdateManifestCacheMs: parseNumber(process.env.APP_UPDATE_MANIFEST_CACHE_MS, 15 * 1000),
};

module.exports = {
  CONFIG_DIR,
  ROOT_DIR,
  config,
};
