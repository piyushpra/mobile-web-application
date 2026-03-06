const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const { config } = require('./config');

const PORT = config.port;
const SESSION_TTL_MS = config.sessionTtlMs;
const MYSQL_HOST = config.mysql.host;
const MYSQL_PORT = config.mysql.port;
const MYSQL_USER = config.mysql.user;
const MYSQL_PASSWORD = config.mysql.password;
const MYSQL_DATABASE = config.mysql.database;
const STATIC_URL_PREFIX = '/static/';
const STATIC_ROOT = path.join(__dirname, 'data', 'generated');
const ITEM_UPLOAD_DIR = path.join(STATIC_ROOT, 'product-images', 'items');
const MAX_ITEM_UPLOAD_COUNT = config.uploads.maxItemUploadCount;
const MAX_ITEM_UPLOAD_BYTES = config.uploads.maxItemUploadBytes;
const APP_UPDATE_MANIFEST_PATH = path.join(__dirname, 'data', 'app_update_manifest.json');
const APP_UPDATE_RUNTIME_MANIFEST_PATH = path.join(STATIC_ROOT, 'app_update_manifest.json');
const APP_UPDATE_MANIFEST_CACHE_MS = config.appUpdateManifestCacheMs;

const mysqlPool = mysql.createPool({
  host: MYSQL_HOST,
  port: MYSQL_PORT,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: config.mysql.poolSize,
  queueLimit: 0,
});

const DEFAULT_USERS = [
  { id: 'u_admin', username: 'admin', password: 'admin123', role: 'admin', name: 'Admin User' },
  { id: 'u_manager', username: 'manager', password: 'manager123', role: 'manager', name: 'Inventory Manager' },
  { id: 'u_staff', username: 'staff', password: 'staff123', role: 'staff', name: 'Warehouse Staff' },
];

const DEFAULT_LOCATION_SUGGESTIONS = [
  { id: 'loc_nd_cp_110001', label: 'Connaught Place, New Delhi, India', area: 'Connaught Place', city: 'New Delhi', state: 'Delhi', country: 'India', pincode: '110001' },
  { id: 'loc_nd_dwarka_110075', label: 'Dwarka, New Delhi, India', area: 'Dwarka', city: 'New Delhi', state: 'Delhi', country: 'India', pincode: '110075' },
  { id: 'loc_nd_saket_110017', label: 'Saket, New Delhi, India', area: 'Saket', city: 'New Delhi', state: 'Delhi', country: 'India', pincode: '110017' },
  { id: 'loc_noida_201301', label: 'Sector 18, Noida, India', area: 'Sector 18', city: 'Noida', state: 'Uttar Pradesh', country: 'India', pincode: '201301' },
  { id: 'loc_ghaziabad_201001', label: 'Raj Nagar, Ghaziabad, India', area: 'Raj Nagar', city: 'Ghaziabad', state: 'Uttar Pradesh', country: 'India', pincode: '201001' },
  { id: 'loc_gurgaon_122001', label: 'Sector 29, Gurugram, India', area: 'Sector 29', city: 'Gurugram', state: 'Haryana', country: 'India', pincode: '122001' },
  { id: 'loc_mum_cst_400001', label: 'Fort, Mumbai, India', area: 'Fort', city: 'Mumbai', state: 'Maharashtra', country: 'India', pincode: '400001' },
  { id: 'loc_mum_andheri_400058', label: 'Andheri West, Mumbai, India', area: 'Andheri West', city: 'Mumbai', state: 'Maharashtra', country: 'India', pincode: '400058' },
  { id: 'loc_mum_bandra_400050', label: 'Bandra West, Mumbai, India', area: 'Bandra West', city: 'Mumbai', state: 'Maharashtra', country: 'India', pincode: '400050' },
  { id: 'loc_pune_shivaji_411005', label: 'Shivajinagar, Pune, India', area: 'Shivajinagar', city: 'Pune', state: 'Maharashtra', country: 'India', pincode: '411005' },
  { id: 'loc_pune_hinj_411057', label: 'Hinjawadi, Pune, India', area: 'Hinjawadi', city: 'Pune', state: 'Maharashtra', country: 'India', pincode: '411057' },
  { id: 'loc_nagpur_440001', label: 'Sitabuldi, Nagpur, India', area: 'Sitabuldi', city: 'Nagpur', state: 'Maharashtra', country: 'India', pincode: '440001' },
  { id: 'loc_blr_mg_560001', label: 'MG Road, Bengaluru, India', area: 'MG Road', city: 'Bengaluru', state: 'Karnataka', country: 'India', pincode: '560001' },
  { id: 'loc_blr_white_560066', label: 'Whitefield, Bengaluru, India', area: 'Whitefield', city: 'Bengaluru', state: 'Karnataka', country: 'India', pincode: '560066' },
  { id: 'loc_blr_indira_560038', label: 'Indiranagar, Bengaluru, India', area: 'Indiranagar', city: 'Bengaluru', state: 'Karnataka', country: 'India', pincode: '560038' },
  { id: 'loc_hyd_banj_500034', label: 'Banjara Hills, Hyderabad, India', area: 'Banjara Hills', city: 'Hyderabad', state: 'Telangana', country: 'India', pincode: '500034' },
  { id: 'loc_hyd_gach_500032', label: 'Gachibowli, Hyderabad, India', area: 'Gachibowli', city: 'Hyderabad', state: 'Telangana', country: 'India', pincode: '500032' },
  { id: 'loc_che_tnagar_600017', label: 'T Nagar, Chennai, India', area: 'T Nagar', city: 'Chennai', state: 'Tamil Nadu', country: 'India', pincode: '600017' },
  { id: 'loc_che_adyar_600020', label: 'Adyar, Chennai, India', area: 'Adyar', city: 'Chennai', state: 'Tamil Nadu', country: 'India', pincode: '600020' },
  { id: 'loc_kol_park_700016', label: 'Park Street, Kolkata, India', area: 'Park Street', city: 'Kolkata', state: 'West Bengal', country: 'India', pincode: '700016' },
  { id: 'loc_kol_salt_700091', label: 'Salt Lake, Kolkata, India', area: 'Salt Lake', city: 'Kolkata', state: 'West Bengal', country: 'India', pincode: '700091' },
  { id: 'loc_jaipur_302001', label: 'MI Road, Jaipur, India', area: 'MI Road', city: 'Jaipur', state: 'Rajasthan', country: 'India', pincode: '302001' },
  { id: 'loc_lko_226001', label: 'Hazratganj, Lucknow, India', area: 'Hazratganj', city: 'Lucknow', state: 'Uttar Pradesh', country: 'India', pincode: '226001' },
  { id: 'loc_bhopal_462001', label: 'MP Nagar, Bhopal, India', area: 'MP Nagar', city: 'Bhopal', state: 'Madhya Pradesh', country: 'India', pincode: '462001' },
  { id: 'loc_ahm_380001', label: 'Ellisbridge, Ahmedabad, India', area: 'Ellisbridge', city: 'Ahmedabad', state: 'Gujarat', country: 'India', pincode: '380001' },
];

const sessions = new Map();
let appUpdateManifestCache = null;
let appUpdateManifestLoadedAt = 0;

let writeQueue = Promise.resolve();

const defaultDb = {
  items: [],
  stockMovements: [],
  purchaseOrders: [],
  salesOrders: [],
  suppliers: [],
  customers: [],
  bills: [],
  invoices: [],
  users: DEFAULT_USERS,
  locationProfiles: [],
  locationSuggestions: DEFAULT_LOCATION_SUGGESTIONS,
  counters: { po: 1, so: 1, bill: 1, inv: 1 },
};

function parseNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp2(num) {
  return Math.round(num * 100) / 100;
}

function compareAppVersions(left, right) {
  const leftParts = String(left || '')
    .trim()
    .split('.')
    .map(part => parseNumber(part, 0));
  const rightParts = String(right || '')
    .trim()
    .split('.')
    .map(part => parseNumber(part, 0));
  const maxLen = Math.max(leftParts.length, rightParts.length, 1);
  for (let i = 0; i < maxLen; i += 1) {
    const a = leftParts[i] ?? 0;
    const b = rightParts[i] ?? 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

function getDefaultAppUpdateManifest() {
  return {
    android: {
      latestVersion: '1.0.0',
      minimumSupportedVersion: '1.0.0',
      mandatory: false,
      downloadUrl: '',
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
}

function normalizeAppUpdateEntry(entry, fallbackVersion = '1.0.0') {
  const fallback = String(fallbackVersion || '1.0.0').trim() || '1.0.0';
  const latestVersion = String(entry?.latestVersion || fallback).trim() || fallback;
  const minimumSupportedVersion = String(entry?.minimumSupportedVersion || latestVersion).trim() || latestVersion;
  return {
    latestVersion,
    minimumSupportedVersion,
    mandatory: Boolean(entry?.mandatory),
    downloadUrl: String(entry?.downloadUrl || '').trim(),
    releaseNotes: String(entry?.releaseNotes || '').trim(),
  };
}

async function readAppUpdateManifest() {
  const now = Date.now();
  if (appUpdateManifestCache && now - appUpdateManifestLoadedAt < APP_UPDATE_MANIFEST_CACHE_MS) {
    return appUpdateManifestCache;
  }

  const fallbackManifest = getDefaultAppUpdateManifest();
  for (const manifestPath of [APP_UPDATE_RUNTIME_MANIFEST_PATH, APP_UPDATE_MANIFEST_PATH]) {
    try {
      const raw = await fs.promises.readFile(manifestPath, 'utf8');
      const parsed = JSON.parse(raw);
      const manifest = {
        android: normalizeAppUpdateEntry(parsed?.android, fallbackManifest.android.latestVersion),
        ios: normalizeAppUpdateEntry(parsed?.ios, fallbackManifest.ios.latestVersion),
      };
      appUpdateManifestCache = manifest;
      appUpdateManifestLoadedAt = now;
      return manifest;
    } catch {
      // Try the next manifest source.
    }
  }

  appUpdateManifestCache = fallbackManifest;
  appUpdateManifestLoadedAt = now;
  return fallbackManifest;
}

function computeStatus(qty, reorderPoint = 8) {
  const threshold = parseNumber(reorderPoint, 8);
  if (qty <= Math.max(2, Math.floor(threshold / 2))) {
    return 'Critical';
  }
  if (qty <= threshold) {
    return 'Low Stock';
  }
  return 'In Stock';
}

const AH_OPTIONS = ['110Ah', '120Ah', '150Ah', '200Ah', '220Ah'];
const ITEM_TAGS = ['bestseller', 'premium'];

function normalizeCapacityAh(value) {
  const raw = String(value || '').trim();
  return AH_OPTIONS.includes(raw) ? raw : '150Ah';
}

function normalizeItemTags(tags) {
  let source = [];
  if (Array.isArray(tags)) {
    source = tags;
  } else if (typeof tags === 'string') {
    const raw = tags.trim();
    if (!raw) {
      source = [];
    } else if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const parsed = JSON.parse(raw);
        source = Array.isArray(parsed) ? parsed : [];
      } catch {
        source = raw.split(',');
      }
    } else {
      source = raw.split(',');
    }
  }

  return Array.from(new Set(source.map(tag => String(tag || '').trim().toLowerCase()).filter(tag => ITEM_TAGS.includes(tag))));
}

function toProductTagsDbValue(tags) {
  const normalized = normalizeItemTags(tags);
  return normalized.length > 0 ? normalized.join(',') : null;
}

function normalizeBrand(value) {
  const brand = String(value || '').trim();
  if (!brand) {
    return '';
  }
  if (brand.toLowerCase() === 'general') {
    return '';
  }
  return brand;
}

function normalizeCategory(value) {
  const category = String(value || '').trim();
  if (!category) {
    return 'Misc';
  }
  if (category.toLowerCase() === 'general') {
    return 'Misc';
  }
  return category;
}

function normalizeItem(item) {
  const qty = parseNumber(item.qty, 0);
  const reorderPoint = parseNumber(item.reorderPoint, 8);
  const purchasePrice = parseNumber(item.purchasePrice, 0);
  const sellingPrice = parseNumber(item.sellingPrice, 0);
  const taxRate = parseNumber(item.taxRate, 0);
  const id = String(item.id || `inv_${crypto.randomUUID().slice(0, 8)}`);

  return {
    id,
    itemType: item.itemType || 'Goods',
    name: item.name || 'Unnamed Item',
    model: item.model || item.sku || `MODEL-${id.slice(-4).toUpperCase()}`,
    capacityAh: normalizeCapacityAh(item.capacityAh || item.capacity_ah),
    sku: item.sku || `HSN-SAC-${id.toUpperCase()}`,
    category: normalizeCategory(item.category),
    unit: item.unit || 'pcs',
    brand: normalizeBrand(item.brand),
    tags: normalizeItemTags(item.tags),
    description: item.description || '',
    images:
      Array.isArray(item.images) && item.images.length > 0
        ? item.images
        : [
            'https://dummyimage.com/900x600/1f2937/f9fafb.png&text=Product+Image+1',
            'https://dummyimage.com/900x600/334155/f9fafb.png&text=Product+Image+2',
            'https://dummyimage.com/900x600/0f766e/f9fafb.png&text=Product+Image+3',
          ],
    hsnCode: item.hsnCode || '',
    location: item.location || 'Unassigned',
    qty,
    reorderPoint,
    purchasePrice,
    sellingPrice,
    taxRate,
    status: computeStatus(qty, reorderPoint),
    updatedAt: item.updatedAt || new Date().toISOString(),
  };
}

function normalizeParty(party, type) {
  const idPrefix = type === 'supplier' ? 'sup' : 'cus';
  return {
    id: String(party.id || `${idPrefix}_${crypto.randomUUID().slice(0, 8)}`),
    name: String(party.name || '').trim() || `${type} name`,
    company: String(party.company || '').trim(),
    email: String(party.email || '').trim(),
    phone: String(party.phone || '').trim(),
    gstin: String(party.gstin || '').trim(),
    billingAddress: String(party.billingAddress || '').trim(),
    shippingAddress: String(party.shippingAddress || '').trim(),
    createdAt: party.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeUser(user) {
  const role = ['admin', 'manager', 'staff'].includes(user.role) ? user.role : 'staff';
  return {
    id: String(user.id || `u_${crypto.randomUUID().slice(0, 8)}`),
    username: String(user.username || '').trim(),
    password: String(user.password || '').trim(),
    role,
    name: String(user.name || user.username || 'User').trim(),
  };
}

function normalizeLocation(input) {
  const area = String(input.area || '').trim();
  const city = String(input.city || '').trim();
  const state = String(input.state || '').trim();
  const country = String(input.country || 'India').trim();
  const pincode = String(input.pincode || '').trim();
  const label = String(input.label || [area, city, state, country].filter(Boolean).join(', ')).trim();
  return {
    id: String(input.id || `loc_${crypto.randomUUID().slice(0, 8)}`),
    label: label || 'Unknown Location',
    area,
    city,
    state,
    country,
    pincode,
    lat: Number.isFinite(Number(input.lat)) ? Number(input.lat) : null,
    lng: Number.isFinite(Number(input.lng)) ? Number(input.lng) : null,
    source: String(input.source || 'manual').trim(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeLocationProfile(profile) {
  const currentLocation = profile.currentLocation ? normalizeLocation(profile.currentLocation) : null;
  const savedLocations = Array.isArray(profile.savedLocations) ? profile.savedLocations.map(normalizeLocation) : [];
  const recentLocations = Array.isArray(profile.recentLocations) ? profile.recentLocations.map(normalizeLocation) : [];
  return {
    id: String(profile.id || `lp_${crypto.randomUUID().slice(0, 8)}`),
    userId: profile.userId ? String(profile.userId) : null,
    guestId: profile.guestId ? String(profile.guestId) : null,
    currentLocation,
    savedLocations,
    recentLocations,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeDb(db) {
  const safe = {
    ...defaultDb,
    ...(db || {}),
  };

  const baseSuggestions = DEFAULT_LOCATION_SUGGESTIONS.map(normalizeLocation);
  const existingSuggestions = Array.isArray(safe.locationSuggestions)
    ? safe.locationSuggestions.map(normalizeLocation)
    : [];
  const mergedSuggestions = [...existingSuggestions];
  for (const seed of baseSuggestions) {
    const exists = mergedSuggestions.some(item => {
      if (item.id === seed.id) return true;
      const p1 = String(item.pincode || '').trim();
      const p2 = String(seed.pincode || '').trim();
      return p1 && p2 && p1 === p2 && String(item.city || '').toLowerCase() === String(seed.city || '').toLowerCase();
    });
    if (!exists) {
      mergedSuggestions.push(seed);
    }
  }

  return {
    ...safe,
    items: Array.isArray(safe.items) ? safe.items.map(normalizeItem) : [],
    stockMovements: Array.isArray(safe.stockMovements) ? safe.stockMovements : [],
    purchaseOrders: Array.isArray(safe.purchaseOrders) ? safe.purchaseOrders : [],
    salesOrders: Array.isArray(safe.salesOrders) ? safe.salesOrders : [],
    suppliers: Array.isArray(safe.suppliers) ? safe.suppliers.map(s => normalizeParty(s, 'supplier')) : [],
    customers: Array.isArray(safe.customers) ? safe.customers.map(c => normalizeParty(c, 'customer')) : [],
    bills: Array.isArray(safe.bills) ? safe.bills : [],
    invoices: Array.isArray(safe.invoices) ? safe.invoices : [],
    users: Array.isArray(safe.users)
      ? safe.users.map(normalizeUser).filter(u => u.username && u.password)
      : DEFAULT_USERS,
    locationProfiles: Array.isArray(safe.locationProfiles)
      ? safe.locationProfiles.map(normalizeLocationProfile)
      : [],
    locationSuggestions: mergedSuggestions,
    counters: {
      po: parseNumber(safe.counters && safe.counters.po, 1),
      so: parseNumber(safe.counters && safe.counters.so, 1),
      bill: parseNumber(safe.counters && safe.counters.bill, 1),
      inv: parseNumber(safe.counters && safe.counters.inv, 1),
    },
  };
}

let mysqlBootstrapped = false;
let mysqlBootstrapPromise = null;

function createHttpError(statusCode, message) {
  const err = new Error(message || 'Request failed');
  err.statusCode = statusCode;
  return err;
}

function toErrorResponse(error) {
  const status = Number(error?.statusCode || error?.status || 0);
  if (status >= 400 && status < 600) {
    return {
      status,
      message: String(error?.message || 'Request failed'),
      isServerError: status >= 500,
    };
  }

  const code = String(error?.code || '').toUpperCase();
  if (code === 'ER_DUP_ENTRY') {
    return { status: 409, message: 'Duplicate value already exists', isServerError: false };
  }
  if (code === 'ER_NO_REFERENCED_ROW_2') {
    return { status: 400, message: 'Invalid reference selected', isServerError: false };
  }
  if (code === 'ER_ROW_IS_REFERENCED_2') {
    return { status: 409, message: 'Record is in use and cannot be deleted', isServerError: false };
  }
  if (
    code === 'ER_TRUNCATED_WRONG_VALUE' ||
    code === 'ER_WRONG_VALUE_FOR_TYPE' ||
    code === 'ER_DATA_TOO_LONG' ||
    code === 'ER_BAD_NULL_ERROR'
  ) {
    return { status: 400, message: 'Invalid input values', isServerError: false };
  }

  const message = String(error?.message || '');
  if (message.toLowerCase().includes('invalid json')) {
    return { status: 400, message: 'Invalid JSON body', isServerError: false };
  }

  return { status: 500, message: 'Server error. Please try again.', isServerError: true };
}

function toIso(value) {
  if (!value) return '';
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toISOString();
}

function toMysqlDateTime(value) {
  if (!value) return null;
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function toMysqlDate(value) {
  if (!value) return null;
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function toYmd(value) {
  if (!value) return '';
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toISOString().slice(0, 10);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function uniqueById(locations) {
  const seen = new Set();
  const out = [];
  for (const loc of locations) {
    if (!loc || !loc.id) continue;
    if (seen.has(loc.id)) continue;
    seen.add(loc.id);
    out.push(loc);
  }
  return out;
}

async function ensureDb() {
  if (mysqlBootstrapped) {
    return;
  }

  if (mysqlBootstrapPromise) {
    await mysqlBootstrapPromise;
    return;
  }

  mysqlBootstrapPromise = (async () => {
    const conn = await mysqlPool.getConnection();
    try {
      await conn.query('SELECT 1');

      const requiredTables = [
        'users',
        'products',
        'product_images',
        'stock_movements',
        'suppliers',
        'customers',
        'purchase_orders',
        'purchase_order_lines',
        'sales_orders',
        'sales_order_lines',
        'bills',
        'bill_lines',
        'invoices',
        'invoice_lines',
        'document_counters',
        'locations',
        'location_profiles',
        'location_saved',
        'location_recent',
        'location_suggestions',
      ];

      const [tableRows] = await conn.query(
        'SELECT table_name FROM information_schema.tables WHERE table_schema = ?',
        [MYSQL_DATABASE],
      );
      const tableSet = new Set(tableRows.map(row => row.TABLE_NAME || row.table_name));
      const missingTables = requiredTables.filter(table => !tableSet.has(table));

      if (missingTables.length > 0) {
        throw new Error(
          `MySQL schema is missing tables: ${missingTables.join(', ')}. Import server/db/bootstrap_mysql_phpmyadmin.sql in phpMyAdmin and retry.`,
        );
      }

      const [capacityColumnRows] = await conn.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = ?
           AND table_name = 'products'
           AND column_name = 'capacity_ah'`,
        [MYSQL_DATABASE],
      );
      if (!Array.isArray(capacityColumnRows) || capacityColumnRows.length === 0) {
        await conn.query(
          `ALTER TABLE products
           ADD COLUMN capacity_ah VARCHAR(20) NULL AFTER model`,
        );
      }

      const [tagsColumnRows] = await conn.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = ?
           AND table_name = 'products'
           AND column_name = 'tags'`,
        [MYSQL_DATABASE],
      );
      if (!Array.isArray(tagsColumnRows) || tagsColumnRows.length === 0) {
        await conn.query(
          `ALTER TABLE products
           ADD COLUMN tags VARCHAR(255) NULL AFTER brand`,
        );
      }

      await conn.query(
        `CREATE TABLE IF NOT EXISTS customer_feedback (
          id VARCHAR(64) NOT NULL,
          user_id VARCHAR(64) NULL,
          guest_id VARCHAR(60) NULL,
          order_id VARCHAR(64) NULL,
          order_item_id VARCHAR(64) NULL,
          product_id VARCHAR(64) NULL,
          rating TINYINT NOT NULL,
          message TEXT NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_customer_feedback_user_created (user_id, created_at),
          KEY idx_customer_feedback_guest_created (guest_id, created_at),
          KEY idx_customer_feedback_order_created (order_id, created_at),
          KEY idx_customer_feedback_order_item (order_item_id),
          CONSTRAINT fk_customer_feedback_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE SET NULL
            ON UPDATE CASCADE,
          CONSTRAINT fk_customer_feedback_order
            FOREIGN KEY (order_id) REFERENCES customer_orders(id)
            ON DELETE SET NULL
            ON UPDATE CASCADE,
          CONSTRAINT fk_customer_feedback_order_item
            FOREIGN KEY (order_item_id) REFERENCES customer_order_items(id)
            ON DELETE SET NULL
            ON UPDATE CASCADE,
          CONSTRAINT fk_customer_feedback_product
            FOREIGN KEY (product_id) REFERENCES products(id)
            ON DELETE SET NULL
            ON UPDATE CASCADE,
          CONSTRAINT chk_customer_feedback_rating CHECK (rating BETWEEN 1 AND 5)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );

      const [feedbackColumnRows] = await conn.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = ?
           AND table_name = 'customer_feedback'`,
        [MYSQL_DATABASE],
      );
      const feedbackColumnSet = new Set(
        (Array.isArray(feedbackColumnRows) ? feedbackColumnRows : []).map(row => row.COLUMN_NAME || row.column_name),
      );
      if (!feedbackColumnSet.has('order_id')) {
        await conn.query(
          `ALTER TABLE customer_feedback
           ADD COLUMN order_id VARCHAR(64) NULL AFTER guest_id`,
        );
      }
      if (!feedbackColumnSet.has('order_item_id')) {
        await conn.query(
          `ALTER TABLE customer_feedback
           ADD COLUMN order_item_id VARCHAR(64) NULL AFTER order_id`,
        );
      }
      if (!feedbackColumnSet.has('product_id')) {
        await conn.query(
          `ALTER TABLE customer_feedback
           ADD COLUMN product_id VARCHAR(64) NULL AFTER order_item_id`,
        );
      }

      const [feedbackIndexRows] = await conn.query(
        `SELECT index_name
         FROM information_schema.statistics
         WHERE table_schema = ?
           AND table_name = 'customer_feedback'`,
        [MYSQL_DATABASE],
      );
      const feedbackIndexSet = new Set(
        (Array.isArray(feedbackIndexRows) ? feedbackIndexRows : []).map(row => row.INDEX_NAME || row.index_name),
      );
      if (!feedbackIndexSet.has('idx_customer_feedback_order_created')) {
        await conn.query(
          `ALTER TABLE customer_feedback
           ADD KEY idx_customer_feedback_order_created (order_id, created_at)`,
        );
      }
      if (!feedbackIndexSet.has('idx_customer_feedback_order_item')) {
        await conn.query(
          `ALTER TABLE customer_feedback
           ADD KEY idx_customer_feedback_order_item (order_item_id)`,
        );
      }

      const [feedbackConstraintRows] = await conn.query(
        `SELECT constraint_name
         FROM information_schema.table_constraints
         WHERE table_schema = ?
           AND table_name = 'customer_feedback'`,
        [MYSQL_DATABASE],
      );
      const feedbackConstraintSet = new Set(
        (Array.isArray(feedbackConstraintRows) ? feedbackConstraintRows : []).map(
          row => row.CONSTRAINT_NAME || row.constraint_name,
        ),
      );
      if (!feedbackConstraintSet.has('fk_customer_feedback_order')) {
        await conn.query(
          `ALTER TABLE customer_feedback
           ADD CONSTRAINT fk_customer_feedback_order
           FOREIGN KEY (order_id) REFERENCES customer_orders(id)
           ON DELETE SET NULL
           ON UPDATE CASCADE`,
        );
      }
      if (!feedbackConstraintSet.has('fk_customer_feedback_order_item')) {
        await conn.query(
          `ALTER TABLE customer_feedback
           ADD CONSTRAINT fk_customer_feedback_order_item
           FOREIGN KEY (order_item_id) REFERENCES customer_order_items(id)
           ON DELETE SET NULL
           ON UPDATE CASCADE`,
        );
      }
      if (!feedbackConstraintSet.has('fk_customer_feedback_product')) {
        await conn.query(
          `ALTER TABLE customer_feedback
           ADD CONSTRAINT fk_customer_feedback_product
           FOREIGN KEY (product_id) REFERENCES products(id)
           ON DELETE SET NULL
           ON UPDATE CASCADE`,
        );
      }

      await conn.query(
        `CREATE TABLE IF NOT EXISTS user_sessions (
          id VARCHAR(64) NOT NULL,
          user_id VARCHAR(64) NOT NULL,
          token_hash VARCHAR(255) NOT NULL,
          expires_at DATETIME NOT NULL,
          revoked_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_user_sessions_token_hash (token_hash),
          KEY idx_user_sessions_user_expires (user_id, expires_at),
          CONSTRAINT fk_user_sessions_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );

      await conn.query(
        `CREATE TABLE IF NOT EXISTS user_preferences (
          user_id VARCHAR(64) NOT NULL,
          dark_mode TINYINT(1) NOT NULL DEFAULT 0,
          language ENUM('English', 'Hindi') NOT NULL DEFAULT 'English',
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id),
          CONSTRAINT fk_user_preferences_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );

      await conn.query(
        `CREATE TABLE IF NOT EXISTS user_dark_mode_settings (
          user_id VARCHAR(64) NOT NULL,
          dark_mode TINYINT(1) NOT NULL DEFAULT 0,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id),
          CONSTRAINT fk_user_dark_mode_settings_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );

      await conn.query(
        `INSERT IGNORE INTO user_dark_mode_settings (user_id, dark_mode)
         SELECT user_id, dark_mode
         FROM user_preferences`,
      );

      await conn.query(
        `CREATE TABLE IF NOT EXISTS notification_preferences (
          user_id VARCHAR(64) NOT NULL,
          order_updates TINYINT(1) NOT NULL DEFAULT 1,
          promotions TINYINT(1) NOT NULL DEFAULT 1,
          warranty_alerts TINYINT(1) NOT NULL DEFAULT 1,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id),
          CONSTRAINT fk_notification_preferences_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );

      await conn.query(
        `CREATE TABLE IF NOT EXISTS wishlists (
          user_id VARCHAR(64) NOT NULL,
          product_id VARCHAR(64) NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, product_id),
          CONSTRAINT fk_wishlists_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE,
          CONSTRAINT fk_wishlists_product
            FOREIGN KEY (product_id) REFERENCES products(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );

      await conn.query(
        `CREATE TABLE IF NOT EXISTS carts (
          id VARCHAR(64) NOT NULL,
          user_id VARCHAR(64) NULL,
          guest_id VARCHAR(60) NULL,
          status ENUM('ACTIVE', 'CHECKED_OUT', 'ABANDONED') NOT NULL DEFAULT 'ACTIVE',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_carts_user_status (user_id, status),
          KEY idx_carts_guest_status (guest_id, status),
          CONSTRAINT fk_carts_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE SET NULL
            ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );

      await conn.query(
        `CREATE TABLE IF NOT EXISTS cart_items (
          id VARCHAR(64) NOT NULL,
          cart_id VARCHAR(64) NOT NULL,
          product_id VARCHAR(64) NOT NULL,
          capacity VARCHAR(20) NOT NULL DEFAULT '150Ah',
          unit_price DECIMAL(12,2) NOT NULL,
          qty INT NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_cart_items_variant (cart_id, product_id, capacity),
          KEY idx_cart_items_cart_id (cart_id),
          KEY idx_cart_items_product_id (product_id),
          CONSTRAINT fk_cart_items_cart
            FOREIGN KEY (cart_id) REFERENCES carts(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE,
          CONSTRAINT fk_cart_items_product
            FOREIGN KEY (product_id) REFERENCES products(id)
            ON DELETE RESTRICT
            ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );

      await conn.query(
        `CREATE TABLE IF NOT EXISTS customer_orders (
          id VARCHAR(64) NOT NULL,
          order_number VARCHAR(30) NOT NULL,
          user_id VARCHAR(64) NULL,
          guest_id VARCHAR(60) NULL,
          location_id VARCHAR(64) NULL,
          status ENUM('Processing', 'Delivered', 'Cancelled') NOT NULL DEFAULT 'Processing',
          subtotal DECIMAL(14,2) NOT NULL DEFAULT 0.00,
          discount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
          delivery_fee DECIMAL(14,2) NOT NULL DEFAULT 0.00,
          total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
          placed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_customer_orders_order_number (order_number),
          KEY idx_customer_orders_user_placed (user_id, placed_at),
          KEY idx_customer_orders_guest_placed (guest_id, placed_at),
          KEY idx_customer_orders_location (location_id),
          CONSTRAINT fk_customer_orders_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE SET NULL
            ON UPDATE CASCADE,
          CONSTRAINT fk_customer_orders_location
            FOREIGN KEY (location_id) REFERENCES locations(id)
            ON DELETE SET NULL
            ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );

      await conn.query(
        `CREATE TABLE IF NOT EXISTS customer_order_items (
          id VARCHAR(64) NOT NULL,
          order_id VARCHAR(64) NOT NULL,
          product_id VARCHAR(64) NULL,
          product_name VARCHAR(200) NOT NULL,
          model VARCHAR(120) NULL,
          capacity VARCHAR(20) NULL,
          unit_price DECIMAL(12,2) NOT NULL,
          qty INT NOT NULL,
          PRIMARY KEY (id),
          KEY idx_customer_order_items_order (order_id),
          KEY idx_customer_order_items_product (product_id),
          CONSTRAINT fk_customer_order_items_order
            FOREIGN KEY (order_id) REFERENCES customer_orders(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE,
          CONSTRAINT fk_customer_order_items_product
            FOREIGN KEY (product_id) REFERENCES products(id)
            ON DELETE SET NULL
            ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );

      await conn.query(
        `CREATE TABLE IF NOT EXISTS payment_methods (
          id VARCHAR(64) NOT NULL,
          user_id VARCHAR(64) NOT NULL,
          method_type ENUM('COD', 'UPI', 'CARD', 'NETBANKING') NOT NULL,
          label VARCHAR(80) NOT NULL,
          detail VARCHAR(160) NULL,
          is_default TINYINT(1) NOT NULL DEFAULT 0,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_payment_methods_user (user_id),
          CONSTRAINT fk_payment_methods_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );

      await conn.query(
        `CREATE TABLE IF NOT EXISTS installation_requests (
          id VARCHAR(64) NOT NULL,
          user_id VARCHAR(64) NOT NULL,
          order_id VARCHAR(64) NULL,
          status ENUM('Pending', 'Scheduled', 'Resolved') NOT NULL DEFAULT 'Pending',
          note TEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_installation_requests_user_created (user_id, created_at),
          KEY idx_installation_requests_order (order_id),
          CONSTRAINT fk_installation_requests_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE,
          CONSTRAINT fk_installation_requests_order
            FOREIGN KEY (order_id) REFERENCES customer_orders(id)
            ON DELETE SET NULL
            ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );

      await conn.query(
        `CREATE TABLE IF NOT EXISTS warranty_claims (
          id VARCHAR(64) NOT NULL,
          user_id VARCHAR(64) NOT NULL,
          order_id VARCHAR(64) NULL,
          product_id VARCHAR(64) NULL,
          status ENUM('Submitted', 'Approved', 'Rejected') NOT NULL DEFAULT 'Submitted',
          note TEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_warranty_claims_user_created (user_id, created_at),
          KEY idx_warranty_claims_order (order_id),
          KEY idx_warranty_claims_product (product_id),
          CONSTRAINT fk_warranty_claims_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE,
          CONSTRAINT fk_warranty_claims_order
            FOREIGN KEY (order_id) REFERENCES customer_orders(id)
            ON DELETE SET NULL
            ON UPDATE CASCADE,
          CONSTRAINT fk_warranty_claims_product
            FOREIGN KEY (product_id) REFERENCES products(id)
            ON DELETE SET NULL
            ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );

      const [skuIndexRows] = await conn.query(
        `SELECT index_name, non_unique
         FROM information_schema.statistics
         WHERE table_schema = ?
           AND table_name = 'products'
           AND column_name = 'sku'
           AND index_name <> 'PRIMARY'`,
        [MYSQL_DATABASE],
      );
      const uniqueSkuIndexes = (Array.isArray(skuIndexRows) ? skuIndexRows : []).filter(row => {
        const nonUnique = Number(row.NON_UNIQUE ?? row.non_unique ?? 1);
        return nonUnique === 0;
      });
      for (const row of uniqueSkuIndexes) {
        const indexName = String(row.INDEX_NAME || row.index_name || '').trim();
        if (!indexName) {
          continue;
        }
        const escapedIndexName = indexName.replace(/`/g, '``');
        await conn.query(`ALTER TABLE products DROP INDEX \`${escapedIndexName}\``);
      }

      await conn.query(
        `INSERT IGNORE INTO document_counters (counter_key, next_value)
         VALUES ('PO', 1), ('SO', 1), ('BILL', 1), ('INV', 1)`,
      );

      for (const u of DEFAULT_USERS) {
        await conn.query(
          `INSERT IGNORE INTO users (id, username, password_hash, role, full_name, is_active)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [u.id, u.username, u.password, u.role, u.name],
        );
      }

      let rank = DEFAULT_LOCATION_SUGGESTIONS.length;
      for (const raw of DEFAULT_LOCATION_SUGGESTIONS) {
        const loc = normalizeLocation(raw);
        await conn.query(
          `INSERT INTO locations
            (id, label, area, city, state, country, pincode, lat, lng, source, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             label = VALUES(label),
             area = VALUES(area),
             city = VALUES(city),
             state = VALUES(state),
             country = VALUES(country),
             pincode = VALUES(pincode),
             lat = VALUES(lat),
             lng = VALUES(lng),
             source = VALUES(source),
             updated_at = VALUES(updated_at)`,
          [
            loc.id,
            loc.label,
            loc.area || null,
            loc.city || null,
            loc.state || null,
            loc.country || 'India',
            loc.pincode || null,
            Number.isFinite(Number(loc.lat)) ? Number(loc.lat) : null,
            Number.isFinite(Number(loc.lng)) ? Number(loc.lng) : null,
            loc.source || 'manual',
            toMysqlDateTime(loc.updatedAt),
          ],
        );
        await conn.query(
          `INSERT IGNORE INTO location_suggestions (id, location_id, rank_score)
           VALUES (?, ?, ?)`,
          [`ls_${loc.id}`, loc.id, rank],
        );
        rank -= 1;
      }

      try {
        await conn.query(
          `DELETE FROM products
           WHERE LOWER(TRIM(COALESCE(category, ''))) = 'general'`,
        );
      } catch (error) {
        if (error && (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED')) {
          await conn.query(
            `UPDATE products
             SET category = 'Misc'
             WHERE LOWER(TRIM(COALESCE(category, ''))) = 'general'`,
          );
        } else {
          throw error;
        }
      }

      await conn.query(
        `UPDATE products
         SET brand = ''
         WHERE LOWER(TRIM(COALESCE(brand, ''))) = 'general'`,
      );

      mysqlBootstrapped = true;
    } finally {
      conn.release();
    }
  })();

  try {
    await mysqlBootstrapPromise;
  } finally {
    mysqlBootstrapPromise = null;
  }
}

async function readDb() {
  await ensureDb();

  const [
    productRows,
    imageRows,
    movementRows,
    supplierRows,
    customerRows,
    userRows,
    poRows,
    poLineRows,
    soRows,
    soLineRows,
    billRows,
    billLineRows,
    invoiceRows,
    invoiceLineRows,
    counterRows,
    locationRows,
    profileRows,
    savedRows,
    recentRows,
    suggestionRows,
  ] = await Promise.all([
    mysqlPool.query(
      `SELECT id, item_type, name, model, capacity_ah, sku, category, unit, brand, tags, description, hsn_code,
              location, qty_on_hand, reorder_point, purchase_price, selling_price, tax_rate, updated_at
       FROM products
       ORDER BY updated_at DESC`,
    ),
    mysqlPool.query(
      `SELECT id, product_id, image_url, sort_order
       FROM product_images
       ORDER BY product_id, sort_order`,
    ),
    mysqlPool.query(
      `SELECT id, product_id, movement_type, delta_qty, reason, reference_no, balance_after, created_at
       FROM stock_movements
       ORDER BY created_at DESC`,
    ),
    mysqlPool.query(
      `SELECT id, name, company, email, phone, gstin, billing_address, shipping_address, created_at, updated_at
       FROM suppliers
       ORDER BY updated_at DESC`,
    ),
    mysqlPool.query(
      `SELECT id, name, company, email, phone, gstin, billing_address, shipping_address, created_at, updated_at
       FROM customers
       ORDER BY updated_at DESC`,
    ),
    mysqlPool.query(
      `SELECT id, username, password_hash, role, full_name
       FROM users
       ORDER BY username ASC`,
    ),
    mysqlPool.query(
      `SELECT id, po_number, vendor_name, expected_date, status, total, created_at, received_at
       FROM purchase_orders
       ORDER BY created_at DESC`,
    ),
    mysqlPool.query(
      `SELECT pol.purchase_order_id,
              pol.product_id AS item_id,
              COALESCE(p.name, 'Unknown Item') AS item_name,
              COALESCE(p.sku, '') AS sku,
              COALESCE(p.unit, 'pcs') AS unit,
              pol.qty,
              pol.unit_cost,
              pol.line_total
       FROM purchase_order_lines pol
       LEFT JOIN products p ON p.id = pol.product_id
       ORDER BY pol.purchase_order_id`,
    ),
    mysqlPool.query(
      `SELECT id, so_number, customer_name, status, total, created_at, fulfilled_at
       FROM sales_orders
       ORDER BY created_at DESC`,
    ),
    mysqlPool.query(
      `SELECT sol.sales_order_id,
              sol.product_id AS item_id,
              COALESCE(p.name, 'Unknown Item') AS item_name,
              COALESCE(p.sku, '') AS sku,
              COALESCE(p.unit, 'pcs') AS unit,
              sol.qty,
              sol.unit_price,
              sol.line_total
       FROM sales_order_lines sol
       LEFT JOIN products p ON p.id = sol.product_id
       ORDER BY sol.sales_order_id`,
    ),
    mysqlPool.query(
      `SELECT b.id, b.bill_number, b.supplier_id, b.status, b.due_date, b.total, b.created_at, b.paid_at,
              COALESCE(s.name, '') AS supplier_name
       FROM bills b
       LEFT JOIN suppliers s ON s.id = b.supplier_id
       ORDER BY b.created_at DESC`,
    ),
    mysqlPool.query(
      `SELECT bl.bill_id,
              bl.product_id AS item_id,
              COALESCE(p.name, 'Unknown Item') AS item_name,
              COALESCE(p.sku, '') AS sku,
              COALESCE(p.unit, 'pcs') AS unit,
              bl.qty,
              bl.unit_cost,
              bl.line_total
       FROM bill_lines bl
       LEFT JOIN products p ON p.id = bl.product_id
       ORDER BY bl.bill_id`,
    ),
    mysqlPool.query(
      `SELECT i.id, i.invoice_number, i.customer_id, i.status, i.due_date, i.total, i.created_at, i.paid_at,
              COALESCE(c.name, '') AS customer_name
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       ORDER BY i.created_at DESC`,
    ),
    mysqlPool.query(
      `SELECT il.invoice_id,
              il.product_id AS item_id,
              COALESCE(p.name, 'Unknown Item') AS item_name,
              COALESCE(p.sku, '') AS sku,
              COALESCE(p.unit, 'pcs') AS unit,
              il.qty,
              il.unit_price,
              il.line_total
       FROM invoice_lines il
       LEFT JOIN products p ON p.id = il.product_id
       ORDER BY il.invoice_id`,
    ),
    mysqlPool.query(
      `SELECT counter_key, next_value
       FROM document_counters`,
    ),
    mysqlPool.query(
      `SELECT id, label, area, city, state, country, pincode, lat, lng, source, updated_at
       FROM locations`,
    ),
    mysqlPool.query(
      `SELECT id, user_id, guest_id, current_location_id, updated_at
       FROM location_profiles
       ORDER BY updated_at DESC`,
    ),
    mysqlPool.query(
      `SELECT profile_id, location_id, created_at
       FROM location_saved
       ORDER BY created_at DESC`,
    ),
    mysqlPool.query(
      `SELECT profile_id, location_id, seen_at
       FROM location_recent
       ORDER BY seen_at DESC`,
    ),
    mysqlPool.query(
      `SELECT location_id
       FROM location_suggestions
       ORDER BY rank_score DESC, created_at DESC`,
    ),
  ]);

  const productData = productRows[0];
  const imageData = imageRows[0];
  const movementData = movementRows[0];
  const supplierData = supplierRows[0];
  const customerData = customerRows[0];
  const userData = userRows[0];
  const purchaseData = poRows[0];
  const purchaseLineData = poLineRows[0];
  const salesData = soRows[0];
  const salesLineData = soLineRows[0];
  const billData = billRows[0];
  const billLineData = billLineRows[0];
  const invoiceData = invoiceRows[0];
  const invoiceLineData = invoiceLineRows[0];
  const counterData = counterRows[0];
  const locationData = locationRows[0];
  const profileData = profileRows[0];
  const savedData = savedRows[0];
  const recentData = recentRows[0];
  const suggestionData = suggestionRows[0];

  const imagesByProduct = new Map();
  for (const row of imageData) {
    const list = imagesByProduct.get(row.product_id) || [];
    list.push(row.image_url);
    imagesByProduct.set(row.product_id, list);
  }

  const items = productData.map(row =>
    normalizeItem({
      id: row.id,
      itemType: row.item_type,
      name: row.name,
      model: row.model,
      capacityAh: row.capacity_ah,
      sku: row.sku,
      category: row.category,
      unit: row.unit,
      brand: row.brand,
      tags: row.tags,
      description: row.description,
      images: imagesByProduct.get(row.id) || [],
      hsnCode: row.hsn_code,
      location: row.location,
      qty: parseNumber(row.qty_on_hand, 0),
      reorderPoint: parseNumber(row.reorder_point, 0),
      purchasePrice: parseNumber(row.purchase_price, 0),
      sellingPrice: parseNumber(row.selling_price, 0),
      taxRate: parseNumber(row.tax_rate, 0),
      updatedAt: toIso(row.updated_at),
    }),
  );

  const itemById = new Map(items.map(item => [item.id, item]));

  const stockMovements = movementData.map(row => {
    const product = itemById.get(row.product_id);
    return {
      id: row.id,
      itemId: row.product_id,
      itemName: product?.name || 'Unknown Item',
      sku: product?.sku || '',
      type: row.movement_type,
      delta: parseNumber(row.delta_qty, 0),
      reason: row.reason || '',
      reference: row.reference_no || '',
      balanceAfter: parseNumber(row.balance_after, 0),
      createdAt: toIso(row.created_at),
    };
  });

  const suppliers = supplierData.map(row =>
    normalizeParty(
      {
        id: row.id,
        name: row.name,
        company: row.company,
        email: row.email,
        phone: row.phone,
        gstin: row.gstin,
        billingAddress: row.billing_address,
        shippingAddress: row.shipping_address,
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
      },
      'supplier',
    ),
  );

  const customers = customerData.map(row =>
    normalizeParty(
      {
        id: row.id,
        name: row.name,
        company: row.company,
        email: row.email,
        phone: row.phone,
        gstin: row.gstin,
        billingAddress: row.billing_address,
        shippingAddress: row.shipping_address,
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
      },
      'customer',
    ),
  );

  const users = userData.map(row =>
    normalizeUser({
      id: row.id,
      username: row.username,
      password: row.password_hash,
      role: row.role,
      name: row.full_name,
    }),
  );

  const purchaseLinesByOrder = new Map();
  for (const row of purchaseLineData) {
    const lines = purchaseLinesByOrder.get(row.purchase_order_id) || [];
    lines.push({
      itemId: row.item_id,
      itemName: row.item_name,
      sku: row.sku,
      unit: row.unit,
      qty: parseNumber(row.qty, 0),
      unitCost: parseNumber(row.unit_cost, 0),
      lineTotal: parseNumber(row.line_total, 0),
    });
    purchaseLinesByOrder.set(row.purchase_order_id, lines);
  }

  const salesLinesByOrder = new Map();
  for (const row of salesLineData) {
    const lines = salesLinesByOrder.get(row.sales_order_id) || [];
    lines.push({
      itemId: row.item_id,
      itemName: row.item_name,
      sku: row.sku,
      unit: row.unit,
      qty: parseNumber(row.qty, 0),
      unitPrice: parseNumber(row.unit_price, 0),
      lineTotal: parseNumber(row.line_total, 0),
    });
    salesLinesByOrder.set(row.sales_order_id, lines);
  }

  const billLinesByBill = new Map();
  for (const row of billLineData) {
    const lines = billLinesByBill.get(row.bill_id) || [];
    lines.push({
      itemId: row.item_id,
      itemName: row.item_name,
      sku: row.sku,
      unit: row.unit,
      qty: parseNumber(row.qty, 0),
      unitCost: parseNumber(row.unit_cost, 0),
      lineTotal: parseNumber(row.line_total, 0),
    });
    billLinesByBill.set(row.bill_id, lines);
  }

  const invoiceLinesByInvoice = new Map();
  for (const row of invoiceLineData) {
    const lines = invoiceLinesByInvoice.get(row.invoice_id) || [];
    lines.push({
      itemId: row.item_id,
      itemName: row.item_name,
      sku: row.sku,
      unit: row.unit,
      qty: parseNumber(row.qty, 0),
      unitPrice: parseNumber(row.unit_price, 0),
      lineTotal: parseNumber(row.line_total, 0),
    });
    invoiceLinesByInvoice.set(row.invoice_id, lines);
  }

  const purchaseOrders = purchaseData.map(row => ({
    id: row.id,
    poNumber: row.po_number,
    vendor: row.vendor_name,
    expectedDate: toYmd(row.expected_date),
    status: row.status,
    total: parseNumber(row.total, 0),
    createdAt: toIso(row.created_at),
    receivedAt: row.received_at ? toIso(row.received_at) : undefined,
    lines: purchaseLinesByOrder.get(row.id) || [],
  }));

  const salesOrders = salesData.map(row => ({
    id: row.id,
    soNumber: row.so_number,
    customer: row.customer_name,
    status: row.status,
    total: parseNumber(row.total, 0),
    createdAt: toIso(row.created_at),
    fulfilledAt: row.fulfilled_at ? toIso(row.fulfilled_at) : undefined,
    lines: salesLinesByOrder.get(row.id) || [],
  }));

  const bills = billData.map(row => ({
    id: row.id,
    billNumber: row.bill_number,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    status: row.status,
    dueDate: toYmd(row.due_date),
    total: parseNumber(row.total, 0),
    createdAt: toIso(row.created_at),
    paidAt: row.paid_at ? toIso(row.paid_at) : undefined,
    lines: billLinesByBill.get(row.id) || [],
  }));

  const invoices = invoiceData.map(row => ({
    id: row.id,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    status: row.status,
    dueDate: toYmd(row.due_date),
    total: parseNumber(row.total, 0),
    createdAt: toIso(row.created_at),
    paidAt: row.paid_at ? toIso(row.paid_at) : undefined,
    lines: invoiceLinesByInvoice.get(row.id) || [],
  }));

  const counters = { po: 1, so: 1, bill: 1, inv: 1 };
  for (const row of counterData) {
    const key = String(row.counter_key || '').toUpperCase();
    const value = parseNumber(row.next_value, 1);
    if (key === 'PO') counters.po = value;
    if (key === 'SO') counters.so = value;
    if (key === 'BILL') counters.bill = value;
    if (key === 'INV') counters.inv = value;
  }

  const locationById = new Map();
  for (const row of locationData) {
    const location = normalizeLocation({
      id: row.id,
      label: row.label,
      area: row.area,
      city: row.city,
      state: row.state,
      country: row.country,
      pincode: row.pincode,
      lat: row.lat != null ? Number(row.lat) : null,
      lng: row.lng != null ? Number(row.lng) : null,
      source: row.source,
      updatedAt: toIso(row.updated_at),
    });
    locationById.set(location.id, location);
  }

  const savedByProfile = new Map();
  for (const row of savedData) {
    const loc = locationById.get(row.location_id);
    if (!loc) continue;
    const list = savedByProfile.get(row.profile_id) || [];
    list.push(loc);
    savedByProfile.set(row.profile_id, list);
  }

  const recentByProfile = new Map();
  for (const row of recentData) {
    const loc = locationById.get(row.location_id);
    if (!loc) continue;
    const list = recentByProfile.get(row.profile_id) || [];
    list.push(loc);
    recentByProfile.set(row.profile_id, list);
  }

  const locationProfiles = profileData.map(row =>
    normalizeLocationProfile({
      id: row.id,
      userId: row.user_id || null,
      guestId: row.guest_id || null,
      currentLocation: row.current_location_id ? locationById.get(row.current_location_id) || null : null,
      savedLocations: savedByProfile.get(row.id) || [],
      recentLocations: recentByProfile.get(row.id) || [],
      updatedAt: toIso(row.updated_at),
    }),
  );

  const locationSuggestions = suggestionData
    .map(row => locationById.get(row.location_id))
    .filter(Boolean);

  return normalizeDb({
    items,
    stockMovements,
    purchaseOrders,
    salesOrders,
    suppliers,
    customers,
    bills,
    invoices,
    users,
    locationProfiles,
    locationSuggestions,
    counters,
  });
}

function writeDb(db) {
  writeQueue = writeQueue.then(async () => {
    await ensureDb();
    const normalized = normalizeDb(db);
    const conn = await mysqlPool.getConnection();

    try {
      await conn.beginTransaction();
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');

      const clearTables = [
        'location_saved',
        'location_recent',
        'location_suggestions',
        'location_profiles',
        'invoice_lines',
        'invoices',
        'bill_lines',
        'bills',
        'sales_order_lines',
        'sales_orders',
        'purchase_order_lines',
        'purchase_orders',
        'stock_movements',
        'product_images',
        'products',
        'suppliers',
        'customers',
        'document_counters',
        'locations',
      ];

      for (const table of clearTables) {
        await conn.query(`DELETE FROM \`${table}\``);
      }

      await conn.query('SET FOREIGN_KEY_CHECKS = 1');

      const seenUserIds = new Set();
      const uniqueUsers = [];
      for (const u of normalized.users) {
        if (!u?.id || seenUserIds.has(u.id)) continue;
        seenUserIds.add(u.id);
        uniqueUsers.push(u);
      }

      for (const u of uniqueUsers) {
        await conn.query(
          `INSERT INTO users (id, username, password_hash, role, full_name, phone, is_active)
           VALUES (?, ?, ?, ?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE
             username = VALUES(username),
             password_hash = VALUES(password_hash),
             role = VALUES(role),
             full_name = VALUES(full_name),
             phone = VALUES(phone),
             is_active = 1`,
          [u.id, u.username, u.password, u.role, u.name, null],
        );
      }

      for (const supplier of normalized.suppliers) {
        await conn.query(
          `INSERT INTO suppliers
             (id, name, company, email, phone, gstin, billing_address, shipping_address, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [
            supplier.id,
            supplier.name,
            supplier.company || null,
            supplier.email || null,
            supplier.phone || null,
            supplier.gstin || null,
            supplier.billingAddress || null,
            supplier.shippingAddress || null,
            toMysqlDateTime(supplier.createdAt),
            toMysqlDateTime(supplier.updatedAt),
          ],
        );
      }

      for (const customer of normalized.customers) {
        await conn.query(
          `INSERT INTO customers
             (id, name, company, email, phone, gstin, billing_address, shipping_address, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [
            customer.id,
            customer.name,
            customer.company || null,
            customer.email || null,
            customer.phone || null,
            customer.gstin || null,
            customer.billingAddress || null,
            customer.shippingAddress || null,
            toMysqlDateTime(customer.createdAt),
            toMysqlDateTime(customer.updatedAt),
          ],
        );
      }

      for (const item of normalized.items) {
        await conn.query(
          `INSERT INTO products
            (id, item_type, name, model, capacity_ah, sku, category, unit, brand, tags, description, hsn_code, tax_rate, location,
             qty_on_hand, reorder_point, purchase_price, selling_price, is_active, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [
            item.id,
            item.itemType || 'Goods',
            item.name,
            item.model || item.sku,
            normalizeCapacityAh(item.capacityAh),
            item.sku,
            normalizeCategory(item.category),
            item.unit || 'pcs',
            normalizeBrand(item.brand),
            toProductTagsDbValue(item.tags),
            item.description || '',
            item.hsnCode || '',
            parseNumber(item.taxRate, 0),
            item.location || 'Unassigned',
            parseNumber(item.qty, 0),
            parseNumber(item.reorderPoint, 0),
            parseNumber(item.purchasePrice, 0),
            parseNumber(item.sellingPrice, 0),
            toMysqlDateTime(item.updatedAt),
          ],
        );

        const images = Array.isArray(item.images) ? item.images : [];
        for (let i = 0; i < images.length; i += 1) {
          await conn.query(
            `INSERT INTO product_images (id, product_id, image_url, sort_order, is_primary)
             VALUES (?, ?, ?, ?, ?)`,
            [`img_${item.id}_${i + 1}`, item.id, images[i], i + 1, i === 0 ? 1 : 0],
          );
        }
      }

      for (const movement of normalized.stockMovements) {
        await conn.query(
          `INSERT INTO stock_movements
            (id, product_id, movement_type, delta_qty, balance_after, reason, reference_no, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
          [
            movement.id,
            movement.itemId,
            movement.type,
            parseNumber(movement.delta, 0),
            parseNumber(movement.balanceAfter, 0),
            movement.reason || '',
            movement.reference || '',
            toMysqlDateTime(movement.createdAt),
          ],
        );
      }

      for (const po of normalized.purchaseOrders) {
        await conn.query(
          `INSERT INTO purchase_orders
             (id, po_number, vendor_name, expected_date, status, total, created_by, created_at, received_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
          [
            po.id,
            po.poNumber,
            po.vendor || 'Unknown Vendor',
            toMysqlDate(po.expectedDate),
            po.status || 'Open',
            parseNumber(po.total, 0),
            toMysqlDateTime(po.createdAt),
            toMysqlDateTime(po.receivedAt),
          ],
        );

        for (let i = 0; i < (po.lines || []).length; i += 1) {
          const line = po.lines[i];
          if (!line.itemId) continue;
          await conn.query(
            `INSERT INTO purchase_order_lines
              (id, purchase_order_id, product_id, qty, unit_cost)
             VALUES (?, ?, ?, ?, ?)`,
            [
              `pol_${po.id}_${i + 1}`,
              po.id,
              line.itemId,
              parseNumber(line.qty, 0),
              parseNumber(line.unitCost, 0),
            ],
          );
        }
      }

      for (const so of normalized.salesOrders) {
        await conn.query(
          `INSERT INTO sales_orders
             (id, so_number, customer_name, status, total, created_by, created_at, fulfilled_at)
           VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
          [
            so.id,
            so.soNumber,
            so.customer || 'Walk-in Customer',
            so.status || 'Open',
            parseNumber(so.total, 0),
            toMysqlDateTime(so.createdAt),
            toMysqlDateTime(so.fulfilledAt),
          ],
        );

        for (let i = 0; i < (so.lines || []).length; i += 1) {
          const line = so.lines[i];
          if (!line.itemId) continue;
          await conn.query(
            `INSERT INTO sales_order_lines
              (id, sales_order_id, product_id, qty, unit_price)
             VALUES (?, ?, ?, ?, ?)`,
            [
              `sol_${so.id}_${i + 1}`,
              so.id,
              line.itemId,
              parseNumber(line.qty, 0),
              parseNumber(line.unitPrice, 0),
            ],
          );
        }
      }

      for (const bill of normalized.bills) {
        if (!bill.supplierId) continue;
        await conn.query(
          `INSERT INTO bills
             (id, bill_number, supplier_id, status, due_date, total, created_by, created_at, paid_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
          [
            bill.id,
            bill.billNumber,
            bill.supplierId,
            bill.status || 'Open',
            toMysqlDate(bill.dueDate),
            parseNumber(bill.total, 0),
            toMysqlDateTime(bill.createdAt),
            toMysqlDateTime(bill.paidAt),
          ],
        );

        for (let i = 0; i < (bill.lines || []).length; i += 1) {
          const line = bill.lines[i];
          if (!line.itemId) continue;
          await conn.query(
            `INSERT INTO bill_lines
              (id, bill_id, product_id, qty, unit_cost)
             VALUES (?, ?, ?, ?, ?)`,
            [
              `bl_${bill.id}_${i + 1}`,
              bill.id,
              line.itemId,
              parseNumber(line.qty, 0),
              parseNumber(line.unitCost, 0),
            ],
          );
        }
      }

      for (const invoice of normalized.invoices) {
        if (!invoice.customerId) continue;
        await conn.query(
          `INSERT INTO invoices
             (id, invoice_number, customer_id, status, due_date, total, created_by, created_at, paid_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
          [
            invoice.id,
            invoice.invoiceNumber,
            invoice.customerId,
            invoice.status || 'Open',
            toMysqlDate(invoice.dueDate),
            parseNumber(invoice.total, 0),
            toMysqlDateTime(invoice.createdAt),
            toMysqlDateTime(invoice.paidAt),
          ],
        );

        for (let i = 0; i < (invoice.lines || []).length; i += 1) {
          const line = invoice.lines[i];
          if (!line.itemId) continue;
          await conn.query(
            `INSERT INTO invoice_lines
              (id, invoice_id, product_id, qty, unit_price)
             VALUES (?, ?, ?, ?, ?)`,
            [
              `il_${invoice.id}_${i + 1}`,
              invoice.id,
              line.itemId,
              parseNumber(line.qty, 0),
              parseNumber(line.unitPrice, 0),
            ],
          );
        }
      }

      await conn.query(
        `INSERT INTO document_counters (counter_key, next_value)
         VALUES ('PO', ?), ('SO', ?), ('BILL', ?), ('INV', ?)`,
        [
          parseNumber(normalized.counters.po, 1),
          parseNumber(normalized.counters.so, 1),
          parseNumber(normalized.counters.bill, 1),
          parseNumber(normalized.counters.inv, 1),
        ],
      );

      const allLocations = uniqueById([
        ...normalized.locationSuggestions,
        ...normalized.locationProfiles.flatMap(profile => [
          profile.currentLocation,
          ...(profile.savedLocations || []),
          ...(profile.recentLocations || []),
        ]),
      ]);

      for (const raw of allLocations) {
        const loc = normalizeLocation(raw);
        await conn.query(
          `INSERT INTO locations
            (id, label, area, city, state, country, pincode, lat, lng, source, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            loc.id,
            loc.label,
            loc.area || null,
            loc.city || null,
            loc.state || null,
            loc.country || 'India',
            loc.pincode || null,
            Number.isFinite(Number(loc.lat)) ? Number(loc.lat) : null,
            Number.isFinite(Number(loc.lng)) ? Number(loc.lng) : null,
            loc.source || 'manual',
            toMysqlDateTime(loc.updatedAt),
          ],
        );
      }

      const userIdSet = new Set(normalized.users.map(user => user.id));
      for (const profile of normalized.locationProfiles) {
        const hasUser = Boolean(profile.userId && userIdSet.has(profile.userId));
        const userId = hasUser ? profile.userId : null;
        const guestId = !hasUser ? String(profile.guestId || `gst_${profile.id}`) : null;
        const currentLocationId = profile.currentLocation?.id || null;

        await conn.query(
          `INSERT INTO location_profiles
            (id, user_id, guest_id, current_location_id, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [profile.id, userId, guestId, currentLocationId, toMysqlDateTime(profile.updatedAt)],
        );

        for (const savedLoc of profile.savedLocations || []) {
          await conn.query(
            `INSERT INTO location_saved (profile_id, location_id)
             VALUES (?, ?)`,
            [profile.id, savedLoc.id],
          );
        }

        for (const recentLoc of profile.recentLocations || []) {
          await conn.query(
            `INSERT INTO location_recent (id, profile_id, location_id, seen_at)
             VALUES (?, ?, ?, ?)`,
            [
              `lr_${profile.id}_${recentLoc.id}`,
              profile.id,
              recentLoc.id,
              toMysqlDateTime(recentLoc.updatedAt),
            ],
          );
        }
      }

      let rank = normalized.locationSuggestions.length;
      for (const loc of normalized.locationSuggestions) {
        await conn.query(
          `INSERT INTO location_suggestions (id, location_id, rank_score)
           VALUES (?, ?, ?)`,
          [`ls_${loc.id}`, loc.id, rank],
        );
        rank -= 1;
      }

      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  });

  return writeQueue;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

async function parseJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw createHttpError(400, 'Invalid JSON body');
  }
}

function getIdFromPath(pathname, prefix) {
  const safePrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${safePrefix}/([^/]+)$`);
  const match = pathname.match(regex);
  return match ? match[1] : null;
}

function getPathAction(pathname, prefix, action) {
  const safePrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const safeAction = action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${safePrefix}/([^/]+)/${safeAction}$`);
  const match = pathname.match(regex);
  return match ? match[1] : null;
}

function toPublicUser(user) {
  return { id: user.id, username: user.username, role: user.role, name: user.name };
}

async function createSession(user) {
  await ensureDb();
  const token = `tok_${crypto.randomUUID().replace(/-/g, '')}`;
  const expiresAtMs = Date.now() + SESSION_TTL_MS;
  const expiresAt = new Date(expiresAtMs);
  await mysqlPool.query(
    `INSERT INTO user_sessions (id, user_id, token_hash, expires_at, revoked_at)
     VALUES (?, ?, ?, ?, NULL)`,
    [`sess_${crypto.randomUUID().slice(0, 8)}`, user.id, hashToken(token), expiresAt],
  );
  sessions.set(token, {
    userId: user.id,
    role: user.role,
    name: user.name,
    username: user.username,
    expiresAt: expiresAtMs,
  });
  return token;
}

function readToken(req) {
  const raw = req.headers.authorization || '';
  const [scheme, token] = String(raw).split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }
  return token;
}

async function getAuth(req) {
  const token = readToken(req);
  if (!token) {
    return null;
  }
  const cached = sessions.get(token);
  if (cached) {
    if (cached.expiresAt < Date.now()) {
      sessions.delete(token);
    } else {
      return { token, ...cached };
    }
  }

  await ensureDb();
  const [rows] = await mysqlPool.query(
    `SELECT us.user_id, us.expires_at, u.role, u.full_name, u.username
     FROM user_sessions us
     INNER JOIN users u ON u.id = us.user_id
     WHERE us.token_hash = ?
       AND us.revoked_at IS NULL
       AND us.expires_at > CURRENT_TIMESTAMP
       AND u.is_active = 1
     LIMIT 1`,
    [hashToken(token)],
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    return null;
  }
  const expiresAt = new Date(row.expires_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return null;
  }
  const session = {
    userId: row.user_id,
    role: row.role,
    name: row.full_name || row.username || 'User',
    username: row.username || '',
    expiresAt,
  };
  sessions.set(token, session);
  return { token, ...session };
}

async function getLocationOwner(req, searchParams) {
  const auth = await getAuth(req);
  if (auth?.userId) {
    return { userId: auth.userId, guestId: null };
  }
  const guestId = String(searchParams.get('guestId') || '').trim();
  if (guestId) {
    return { userId: null, guestId };
  }
  return null;
}

function findOrCreateLocationProfile(db, owner) {
  const idx = db.locationProfiles.findIndex(profile =>
    owner.userId ? profile.userId === owner.userId : profile.guestId === owner.guestId,
  );
  if (idx >= 0) {
    return { profile: db.locationProfiles[idx], idx };
  }
  const profile = normalizeLocationProfile({
    id: `lp_${crypto.randomUUID().slice(0, 8)}`,
    userId: owner.userId || null,
    guestId: owner.guestId || null,
    currentLocation: {
      city: 'New Delhi',
      state: 'Delhi',
      country: 'India',
      pincode: '110001',
      label: 'New Delhi, India',
      source: 'default',
    },
    savedLocations: [],
    recentLocations: [],
  });
  db.locationProfiles.unshift(profile);
  return { profile, idx: 0 };
}

function mergeLocationUnique(list, location, max = 10) {
  const without = list.filter(item => {
    if (location.id && item.id === location.id) {
      return false;
    }
    if (location.label && item.label.toLowerCase() === location.label.toLowerCase()) {
      return false;
    }
    return true;
  });
  return [location, ...without].slice(0, max);
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

function getContentTypeForAsset(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.apk') return 'application/vnd.android.package-archive';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function getRequestBaseUrl(req) {
  const headers = req && req.headers ? req.headers : {};
  const proto = String(headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const protocol = proto === 'https' ? 'https' : 'http';
  const host = String(headers['x-forwarded-host'] || headers.host || `127.0.0.1:${PORT}`)
    .split(',')[0]
    .trim();
  return `${protocol}://${host}`;
}

function resolveAssetUrl(req, value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith('/')) return raw;
  return `${getRequestBaseUrl(req)}${raw}`;
}

function resolveAssetUrls(req, list) {
  if (!Array.isArray(list)) return [];
  return list.map(value => resolveAssetUrl(req, value)).filter(Boolean);
}

async function serveStaticAsset(req, res, pathname) {
  let decodedPath = '';
  try {
    decodedPath = decodeURIComponent(String(pathname || ''));
  } catch {
    sendError(res, 400, 'Invalid asset path');
    return;
  }

  const relativePath = decodedPath.slice(STATIC_URL_PREFIX.length);
  const absolutePath = path.resolve(STATIC_ROOT, relativePath);
  const safeRoot = `${STATIC_ROOT}${path.sep}`;
  if (!absolutePath.startsWith(safeRoot)) {
    sendError(res, 403, 'Forbidden');
    return;
  }

  try {
    const stats = await fs.promises.stat(absolutePath);
    if (!stats.isFile()) {
      sendError(res, 404, 'Asset not found');
      return;
    }
    const contentType = getContentTypeForAsset(absolutePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(absolutePath).pipe(res);
  } catch {
    sendError(res, 404, 'Asset not found');
  }
}

function sanitizeFilePart(value, fallback = 'item') {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return cleaned || fallback;
}

function extFromMimeType(mimeType, fallback = 'jpg') {
  const map = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  const normalized = String(mimeType || '').trim().toLowerCase();
  if (map[normalized]) return map[normalized];
  return fallback;
}

function normalizeBase64Payload(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const marker = 'base64,';
  if (raw.startsWith('data:') && raw.includes(marker)) {
    return raw.slice(raw.indexOf(marker) + marker.length).replace(/\s+/g, '');
  }
  return raw.replace(/\s+/g, '');
}

async function saveUploadedItemImages(itemId, uploads) {
  if (!Array.isArray(uploads) || uploads.length === 0) return [];
  await fs.promises.mkdir(ITEM_UPLOAD_DIR, { recursive: true });

  const collected = [];
  const limited = uploads.slice(0, MAX_ITEM_UPLOAD_COUNT);

  for (let i = 0; i < limited.length; i += 1) {
    const entry = limited[i];

    if (typeof entry === 'string') {
      const str = entry.trim();
      if (str && (str.startsWith('/static/') || /^https?:\/\//i.test(str))) {
        collected.push(str);
      }
      continue;
    }

    const mimeType = String(entry?.mimeType || '').trim().toLowerCase();
    const base64Payload = normalizeBase64Payload(entry?.base64Data || entry?.base64 || '');
    if (!mimeType.startsWith('image/') || !base64Payload) {
      continue;
    }

    let fileBuffer = null;
    try {
      fileBuffer = Buffer.from(base64Payload, 'base64');
    } catch {
      continue;
    }
    if (!fileBuffer || fileBuffer.length === 0 || fileBuffer.length > MAX_ITEM_UPLOAD_BYTES) {
      continue;
    }

    const ext = extFromMimeType(mimeType);
    const hash = crypto.createHash('sha1').update(fileBuffer).digest('hex').slice(0, 12);
    const baseName = sanitizeFilePart(itemId, 'item');
    const fileName = `${baseName}_${i + 1}_${hash}.${ext}`;
    const targetPath = path.join(ITEM_UPLOAD_DIR, fileName);
    await fs.promises.writeFile(targetPath, fileBuffer);
    collected.push(`/static/product-images/items/${fileName}`);
  }

  return collected;
}

async function getStorefrontOwner(req, searchParams, body = null) {
  const auth = await getAuth(req);
  if (auth?.userId) {
    return { userId: auth.userId, guestId: null };
  }
  const guestId = String(searchParams.get('guestId') || body?.guestId || '').trim();
  if (!guestId) {
    return null;
  }
  return { userId: null, guestId };
}

function buildOwnerCondition(owner) {
  if (owner.userId) {
    return { sql: 'user_id = ? AND guest_id IS NULL', params: [owner.userId] };
  }
  return { sql: 'user_id IS NULL AND guest_id = ?', params: [owner.guestId] };
}

function getFallbackThumbnail() {
  return 'https://dummyimage.com/240x160/e6ece2/1f2937.png&text=Product';
}

function toProfileOrder(row, req = null) {
  return {
    id: row.order_item_id || row.order_number || row.id,
    createdAt: toYmd(row.placed_at || row.created_at),
    itemCount: Math.max(1, parseNumber(row.qty, parseNumber(row.item_count, 1))),
    total: parseNumber(row.total, 0),
    status: row.status || 'Processing',
    productId: row.product_id || null,
    brand: row.brand || '',
    category: row.category || '',
    model: row.model || row.order_item_model || row.product_name || '',
    thumbnail: resolveAssetUrl(req, row.thumbnail || getFallbackThumbnail()),
  };
}

async function ensureUserPreferenceRows(conn, userId) {
  if (!userId) return;
  await conn.query(
    `INSERT IGNORE INTO user_preferences (user_id, dark_mode, language)
     VALUES (?, 0, 'English')`,
    [userId],
  );
  await conn.query(
    `INSERT IGNORE INTO user_dark_mode_settings (user_id, dark_mode)
     VALUES (?, 0)`,
    [userId],
  );
  await conn.query(
    `INSERT IGNORE INTO notification_preferences (user_id, order_updates, promotions, warranty_alerts)
     VALUES (?, 1, 1, 1)`,
    [userId],
  );
}

async function getOrCreateActiveCart(conn, owner) {
  const ownerWhere = buildOwnerCondition(owner);
  const [rows] = await conn.query(
    `SELECT id, user_id, guest_id
     FROM carts
     WHERE ${ownerWhere.sql}
       AND status = 'ACTIVE'
     ORDER BY updated_at DESC
     LIMIT 1`,
    ownerWhere.params,
  );
  if (Array.isArray(rows) && rows[0]) {
    return rows[0];
  }

  const id = `cart_${crypto.randomUUID().slice(0, 8)}`;
  await conn.query(
    `INSERT INTO carts (id, user_id, guest_id, status)
     VALUES (?, ?, ?, 'ACTIVE')`,
    [id, owner.userId || null, owner.guestId || null],
  );
  return { id, user_id: owner.userId || null, guest_id: owner.guestId || null };
}

async function fetchCartItemsByCartId(conn, cartId, req = null) {
  const [rows] = await conn.query(
    `SELECT ci.product_id,
            ci.capacity,
            ci.unit_price,
            ci.qty,
            COALESCE(p.name, 'Product') AS product_name,
            COALESCE(NULLIF(p.model, ''), p.sku, '') AS product_model,
            COALESCE(pi.image_url, '') AS thumbnail
     FROM cart_items ci
     LEFT JOIN products p ON p.id = ci.product_id
     LEFT JOIN product_images pi
       ON pi.product_id = ci.product_id
      AND pi.is_primary = 1
     WHERE ci.cart_id = ?
     ORDER BY ci.created_at ASC`,
    [cartId],
  );
  return (Array.isArray(rows) ? rows : []).map(row => ({
    id: `${row.product_id}_${row.capacity}`.toLowerCase(),
    productId: row.product_id,
    name: row.product_name,
    model: row.product_model,
    capacity: row.capacity,
    thumbnail: resolveAssetUrl(req, row.thumbnail || getFallbackThumbnail()),
    qty: parseNumber(row.qty, 0),
    unitPrice: parseNumber(row.unit_price, 0),
  }));
}

async function fetchOrdersByOwner(conn, owner, req = null) {
  const ownerWhere = buildOwnerCondition(owner);
  const [rows] = await conn.query(
    `SELECT co.id,
            co.order_number,
            co.status,
            co.placed_at,
            co.created_at,
            co.total,
            coi.id AS order_item_id,
            coi.product_id,
            coi.product_name,
            coi.model AS order_item_model,
            coi.qty,
            CASE
              WHEN LOWER(TRIM(COALESCE(p.brand, ''))) = 'general' THEN ''
              ELSE COALESCE(NULLIF(p.brand, ''), '')
            END AS brand,
            CASE
              WHEN LOWER(TRIM(COALESCE(p.category, ''))) = 'general' THEN ''
              ELSE COALESCE(NULLIF(p.category, ''), '')
            END AS category,
            COALESCE(NULLIF(p.model, ''), NULLIF(coi.model, ''), '') AS model,
            COALESCE(pi.image_url, '') AS thumbnail
     FROM customer_orders co
     INNER JOIN customer_order_items coi ON coi.order_id = co.id
     LEFT JOIN products p ON p.id = coi.product_id
     LEFT JOIN product_images pi
       ON pi.product_id = coi.product_id
      AND pi.is_primary = 1
     WHERE ${ownerWhere.sql}
     ORDER BY co.placed_at DESC, co.created_at DESC, co.id DESC, coi.id DESC`,
    ownerWhere.params,
  );
  return (Array.isArray(rows) ? rows : []).map(row => toProfileOrder(row, req));
}

async function fetchWishlistIds(conn, userId) {
  if (!userId) return [];
  const [rows] = await conn.query(
    `SELECT product_id
     FROM wishlists
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId],
  );
  return (Array.isArray(rows) ? rows : []).map(row => row.product_id).filter(Boolean);
}

async function fetchPaymentMethods(conn, userId) {
  if (!userId) return [];
  const [rows] = await conn.query(
    `SELECT id, method_type, label, detail, is_default
     FROM payment_methods
     WHERE user_id = ?
       AND is_active = 1
     ORDER BY is_default DESC, created_at ASC`,
    [userId],
  );
  return (Array.isArray(rows) ? rows : []).map(row => ({
    id: row.id,
    label: row.label || row.method_type || 'Method',
    detail: row.detail || '',
    isDefault: Number(row.is_default || 0) === 1,
  }));
}

async function fetchInstallationRequests(conn, userId) {
  if (!userId) return [];
  const [rows] = await conn.query(
    `SELECT id, status, note, created_at
     FROM installation_requests
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId],
  );
  return (Array.isArray(rows) ? rows : []).map(row => ({
    id: row.id,
    createdAt: toYmd(row.created_at),
    status: row.status || 'Pending',
    note: row.note || '',
  }));
}

async function fetchWarrantyClaims(conn, userId) {
  if (!userId) return [];
  const [rows] = await conn.query(
    `SELECT id, status, note, created_at
     FROM warranty_claims
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId],
  );
  return (Array.isArray(rows) ? rows : []).map(row => ({
    id: row.id,
    createdAt: toYmd(row.created_at),
    status: row.status || 'Submitted',
    note: row.note || '',
  }));
}

async function fetchNotificationPrefs(conn, userId) {
  if (!userId) {
    return { orderUpdates: true, promotions: true, warrantyAlerts: true };
  }
  const [rows] = await conn.query(
    `SELECT order_updates, promotions, warranty_alerts
     FROM notification_preferences
     WHERE user_id = ?
     LIMIT 1`,
    [userId],
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    return { orderUpdates: true, promotions: true, warrantyAlerts: true };
  }
  return {
    orderUpdates: Number(row.order_updates || 0) === 1,
    promotions: Number(row.promotions || 0) === 1,
    warrantyAlerts: Number(row.warranty_alerts || 0) === 1,
  };
}

async function fetchUserProfileAndPrefs(conn, userId) {
  if (!userId) {
    return {
      profile: null,
      preferences: { darkMode: false, language: 'English' },
    };
  }
  const [rows] = await conn.query(
    `SELECT u.full_name,
            u.username,
            u.phone,
            COALESCE(udm.dark_mode, up.dark_mode, 0) AS dark_mode,
            COALESCE(up.language, 'English') AS language
     FROM users u
     LEFT JOIN user_dark_mode_settings udm ON udm.user_id = u.id
     LEFT JOIN user_preferences up ON up.user_id = u.id
     WHERE u.id = ?
     LIMIT 1`,
    [userId],
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  return {
    profile: row
      ? {
          name: row.full_name || '',
          email: row.username || '',
          phone: row.phone || '',
        }
      : null,
    preferences: {
      darkMode: Number(row?.dark_mode || 0) === 1,
      language: row?.language === 'Hindi' ? 'Hindi' : 'English',
    },
  };
}

async function fetchCustomerFeedback(conn, limit = 100) {
  const safeLimit = Math.max(1, Math.min(500, parseNumber(limit, 100)));
  const [rows] = await conn.query(
    `SELECT cf.id,
            cf.user_id,
            cf.guest_id,
            cf.order_id,
            cf.order_item_id,
            cf.product_id,
            cf.rating,
            cf.message,
            cf.created_at,
            COALESCE(NULLIF(u.full_name, ''), u.username, 'Guest User') AS customer_name
     FROM customer_feedback cf
     LEFT JOIN users u ON u.id = cf.user_id
     ORDER BY cf.created_at DESC
     LIMIT ?`,
    [safeLimit],
  );

  return (Array.isArray(rows) ? rows : []).map(row => ({
    id: row.id,
    userId: row.user_id || null,
    guestId: row.guest_id || null,
    orderId: row.order_id || null,
    orderItemId: row.order_item_id || null,
    productId: row.product_id || null,
    customerName: row.customer_name || 'Guest User',
    rating: parseNumber(row.rating, 0),
    message: row.message || '',
    createdAt: toIso(row.created_at),
  }));
}

async function fetchFeedbackOrderItemsByOwner(conn, owner, limit = 100) {
  const safeLimit = Math.max(1, Math.min(500, parseNumber(limit, 100)));
  const ownerWhere = buildOwnerCondition(owner);
  const [rows] = await conn.query(
    `SELECT co.id AS order_id,
            co.order_number,
            co.placed_at,
            coi.id AS order_item_id,
            coi.product_id,
            coi.product_name,
            coi.model,
            coi.capacity
     FROM customer_orders co
     INNER JOIN customer_order_items coi ON coi.order_id = co.id
     WHERE ${ownerWhere.sql}
     ORDER BY co.placed_at DESC, co.created_at DESC, coi.id ASC
     LIMIT ?`,
    [...ownerWhere.params, safeLimit],
  );

  return (Array.isArray(rows) ? rows : []).map(row => ({
    orderId: row.order_id,
    orderNumber: row.order_number || row.order_id,
    placedAt: toIso(row.placed_at),
    orderItemId: row.order_item_id,
    productId: row.product_id || null,
    productName: row.product_name || 'Product',
    model: row.model || '',
    capacity: row.capacity || '',
  }));
}

async function requireAuth(req, res, allowedRoles) {
  const auth = await getAuth(req);
  if (!auth) {
    sendError(res, 401, 'Unauthorized');
    return null;
  }
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(auth.role)) {
    sendError(res, 403, 'Forbidden for your role');
    return null;
  }
  return auth;
}

function inventoryStats(items) {
  return {
    totalSkus: items.length,
    totalUnits: items.reduce((sum, item) => sum + parseNumber(item.qty, 0), 0),
    lowStock: items.filter(item => item.status !== 'In Stock').length,
  };
}

function managementOverview(db) {
  const items = db.items;
  return {
    itemsCount: items.length,
    totalUnits: items.reduce((sum, item) => sum + item.qty, 0),
    lowStockCount: items.filter(item => item.status !== 'In Stock').length,
    inventoryValue: clamp2(items.reduce((sum, item) => sum + item.qty * item.purchasePrice, 0)),
    pendingPurchaseOrders: db.purchaseOrders.filter(po => po.status === 'Open').length,
    pendingSalesOrders: db.salesOrders.filter(so => so.status === 'Open').length,
    movementCount: db.stockMovements.length,
    suppliersCount: db.suppliers.length,
    customersCount: db.customers.length,
    openBills: db.bills.filter(b => b.status === 'Open').length,
    openInvoices: db.invoices.filter(i => i.status === 'Open').length,
  };
}

function appendMovement(db, input) {
  const itemIndex = db.items.findIndex(item => item.id === input.itemId);
  if (itemIndex < 0) {
    throw new Error('Item not found');
  }

  const current = db.items[itemIndex];
  const nextQty = current.qty + parseNumber(input.delta, 0);
  if (nextQty < 0) {
    throw new Error('Insufficient stock for this operation');
  }

  const updated = normalizeItem({
    ...current,
    qty: nextQty,
    updatedAt: new Date().toISOString(),
  });
  db.items[itemIndex] = updated;

  const movement = {
    id: `mov_${crypto.randomUUID().slice(0, 8)}`,
    itemId: updated.id,
    itemName: updated.name,
    sku: updated.sku,
    type: input.type,
    delta: parseNumber(input.delta, 0),
    reason: input.reason || '',
    reference: input.reference || '',
    balanceAfter: updated.qty,
    createdAt: new Date().toISOString(),
  };

  db.stockMovements.unshift(movement);
  return movement;
}

function extractItemSummary(db, itemId) {
  const item = db.items.find(it => it.id === itemId);
  if (!item) {
    return null;
  }
  return {
    itemId: item.id,
    itemName: item.name,
    sku: item.sku,
    unit: item.unit,
  };
}

async function createEntityRoutes({ pathname, req, res, db, collection, typeName, allowedRoles }) {
  if (pathname === `/api/${collection}` && req.method === 'GET') {
    sendJson(res, 200, { [collection]: db[collection] });
    return true;
  }

  if (pathname === `/api/${collection}` && req.method === 'POST') {
    if (!allowedRoles.includes('open')) {
      const auth = await requireAuth(req, res, allowedRoles);
      if (!auth) {
        return true;
      }
    }
    return false;
  }

  const id = getIdFromPath(pathname, `/api/${collection}`);
  if (id && req.method === 'PATCH') {
    return false;
  }

  if (id && req.method === 'DELETE') {
    return false;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host}`);
  const { pathname, searchParams } = parsedUrl;

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && pathname.startsWith(STATIC_URL_PREFIX)) {
    await serveStaticAsset(req, res, pathname);
    return;
  }

  try {
    if (pathname === '/health' && req.method === 'GET') {
      sendJson(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
      return;
    }

    if (pathname === '/api/client-logs' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const level = String(body.level || '').trim().toLowerCase() === 'error' ? 'error' : 'warn';
      const source = String(body.source || 'mobile-app').trim() || 'mobile-app';
      const timestamp = String(body.timestamp || new Date().toISOString()).trim() || new Date().toISOString();
      const message = String(body.message || '')
        .trim()
        .slice(0, 5000);

      if (!message) {
        sendError(res, 400, 'message is required');
        return;
      }

      const prefix = `[client-log:${source}] [${timestamp}]`;
      if (level === 'error') {
        console.error(`${prefix} ${message}`);
      } else {
        console.warn(`${prefix} ${message}`);
      }

      sendJson(res, 200, { success: true });
      return;
    }

    if (pathname === '/api/public/stock' && req.method === 'GET') {
      const db = await readDb();
      const search = (searchParams.get('search') || '').trim().toLowerCase();
      const items = db.items
        .filter(item => {
          const text = `${item.name} ${item.sku} ${item.category}`.toLowerCase();
          return !search || text.includes(search);
        })
        .map(item => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          category: item.category,
          unit: item.unit,
          qty: item.qty,
          status: item.status,
          location: item.location,
        }));
      sendJson(res, 200, { items, count: items.length });
      return;
    }

    if (pathname === '/api/public/app-update' && req.method === 'GET') {
      const platformRaw = String(searchParams.get('platform') || '').trim().toLowerCase();
      const platform = platformRaw === 'ios' ? 'ios' : 'android';
      const currentVersion = String(searchParams.get('currentVersion') || '').trim() || '0.0.0';
      const manifest = await readAppUpdateManifest();
      const entry = platform === 'ios' ? manifest.ios : manifest.android;
      const updateAvailable = compareAppVersions(entry.latestVersion, currentVersion) > 0;
      const minVersionRequiresUpdate = compareAppVersions(entry.minimumSupportedVersion, currentVersion) > 0;
      const forceUpdate = minVersionRequiresUpdate || (entry.mandatory && updateAvailable);

      sendJson(res, 200, {
        platform,
        currentVersion,
        latestVersion: entry.latestVersion,
        minimumSupportedVersion: entry.minimumSupportedVersion,
        mandatory: forceUpdate,
        updateAvailable,
        forceUpdate,
        downloadUrl: resolveAssetUrl(req, entry.downloadUrl),
        releaseNotes: entry.releaseNotes,
      });
      return;
    }

    if (pathname === '/api/public/products' && req.method === 'GET') {
      const db = await readDb();
      const search = (searchParams.get('search') || '').trim().toLowerCase();
      const products = db.items
        .filter(item => {
          const text = `${item.name} ${item.model || ''} ${item.brand || ''} ${item.category}`.toLowerCase();
          return !search || text.includes(search);
        })
        .map(item => {
          const purchasePrice = parseNumber(item.purchasePrice, 0);
          const sellingPrice = parseNumber(item.sellingPrice, 0);
          const discountPct =
            purchasePrice > 0 && sellingPrice > 0 && purchasePrice > sellingPrice
              ? Math.round(((purchasePrice - sellingPrice) / purchasePrice) * 100)
              : 0;
          return {
            id: item.id,
            name: item.name,
            model: item.model || item.sku,
            brand: item.brand,
            category: item.category,
            tags: normalizeItemTags(item.tags),
            shortDescription: item.description || `${item.category} product`,
            thumbnail: resolveAssetUrl(req, item.images && item.images[0] ? item.images[0] : ''),
            purchasePrice,
            sellingPrice,
            discountPct,
          };
        });
      sendJson(res, 200, { products, count: products.length });
      return;
    }

    const publicProductId = getIdFromPath(pathname, '/api/public/products');
    if (publicProductId && req.method === 'GET') {
      const db = await readDb();
      const item = db.items.find(p => p.id === publicProductId);
      if (!item) {
        sendError(res, 404, 'Product not found');
        return;
      }
      const baseKey = `${item.name}|${item.model || item.sku}|${item.brand || ''}|${item.category}`.toLowerCase();
      const availableCapacities = Array.from(
        new Set(
          db.items
            .filter(p => `${p.name}|${p.model || p.sku}|${p.brand || ''}|${p.category}`.toLowerCase() === baseKey)
            .map(p => normalizeCapacityAh(p.capacityAh))
            .filter(cap => AH_OPTIONS.includes(cap)),
        ),
      );
      const purchasePrice = parseNumber(item.purchasePrice, 0);
      const sellingPrice = parseNumber(item.sellingPrice, 0);
      const discountPct =
        purchasePrice > 0 && sellingPrice > 0 && purchasePrice > sellingPrice
          ? Math.round(((purchasePrice - sellingPrice) / purchasePrice) * 100)
          : 0;
      sendJson(res, 200, {
        product: {
          id: item.id,
          name: item.name,
          model: item.model || item.sku,
          brand: item.brand,
          category: item.category,
          tags: normalizeItemTags(item.tags),
          description: item.description || `${item.category} product for power backup needs.`,
          images: resolveAssetUrls(req, item.images || []),
          availableCapacities,
          purchasePrice,
          sellingPrice,
          discountPct,
          specifications: {
            sku: item.sku,
            unit: item.unit,
            location: item.location,
            hsnCode: item.hsnCode || 'NA',
            taxRate: item.taxRate,
          },
        },
      });
      return;
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const username = String(body.username || '').trim();
      const password = String(body.password || '').trim();
      if (!username || !password) {
        sendError(res, 401, 'Invalid username or password');
        return;
      }

      await ensureDb();
      const [rows] = await mysqlPool.query(
        `SELECT id, username, password_hash, role, full_name
         FROM users
         WHERE username = ?
           AND is_active = 1
         LIMIT 1`,
        [username],
      );
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row || String(row.password_hash || '') !== password) {
        sendError(res, 401, 'Invalid username or password');
        return;
      }

      const user = normalizeUser({
        id: row.id,
        username: row.username,
        password: row.password_hash,
        role: row.role,
        name: row.full_name,
      });
      const token = await createSession(user);
      sendJson(res, 200, { token, user: toPublicUser(user) });
      return;
    }

    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const username = String(body.username || '').trim();
      const password = String(body.password || '').trim();
      const name = String(body.name || '').trim();
      const phone = String(body.phone || '').trim();
      if (!username || !password) {
        sendError(res, 400, 'username and password are required');
        return;
      }
      if (password.length < 6) {
        sendError(res, 400, 'password must be at least 6 characters');
        return;
      }

      const user = normalizeUser({
        id: `u_${crypto.randomUUID().slice(0, 8)}`,
        username,
        password,
        role: 'staff',
        name: name || username,
      });

      await ensureDb();
      try {
        await mysqlPool.query(
          `INSERT INTO users (id, username, password_hash, role, full_name, phone, is_active)
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [user.id, user.username, user.password, user.role, user.name, phone || null],
        );
      } catch (error) {
        if (error && error.code === 'ER_DUP_ENTRY') {
          sendError(res, 409, 'username already exists');
          return;
        }
        throw error;
      }

      await mysqlPool.query(
        `INSERT IGNORE INTO user_preferences (user_id, dark_mode, language)
         VALUES (?, 0, 'English')`,
        [user.id],
      );
      await mysqlPool.query(
        `INSERT IGNORE INTO user_dark_mode_settings (user_id, dark_mode)
         VALUES (?, 0)`,
        [user.id],
      );
      await mysqlPool.query(
        `INSERT IGNORE INTO notification_preferences (user_id, order_updates, promotions, warranty_alerts)
         VALUES (?, 1, 1, 1)`,
        [user.id],
      );

      sendJson(res, 201, { user: toPublicUser(user) });
      return;
    }

    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const auth = await requireAuth(req, res, ['admin', 'manager', 'staff']);
      if (!auth) {
        return;
      }
      sendJson(res, 200, {
        user: {
          id: auth.userId,
          username: auth.username,
          role: auth.role,
          name: auth.name,
        },
      });
      return;
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      const token = readToken(req);
      if (token) {
        sessions.delete(token);
        await ensureDb();
        await mysqlPool.query(
          `UPDATE user_sessions
           SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
           WHERE token_hash = ?`,
          [hashToken(token)],
        );
      }
      sendJson(res, 200, { success: true });
      return;
    }

    if (pathname === '/api/public/location-suggestions' && req.method === 'GET') {
      const db = await readDb();
      const q = String(searchParams.get('query') || '').trim().toLowerCase();
      const suggestions = db.locationSuggestions.filter(loc => {
        if (!q) return true;
        const pincode = String(loc.pincode || '').toLowerCase();
        const text = `${loc.label} ${loc.area || ''} ${loc.city} ${loc.state} ${loc.country} ${loc.pincode}`.toLowerCase();
        const qDigits = q.replace(/[^0-9]/g, '');
        if (qDigits && pincode.startsWith(qDigits)) {
          return true;
        }
        return text.includes(q);
      });
      sendJson(res, 200, { suggestions: suggestions.slice(0, 20) });
      return;
    }

    if (pathname === '/api/public/location-profile' && req.method === 'GET') {
      const owner = await getLocationOwner(req, searchParams);
      if (!owner) {
        sendError(res, 400, 'guestId is required for anonymous users');
        return;
      }
      const db = await readDb();
      const { profile } = findOrCreateLocationProfile(db, owner);
      sendJson(res, 200, { profile });
      return;
    }

    if (pathname === '/api/public/location-profile/select' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const owner = (await getLocationOwner(req, searchParams)) || {
        userId: null,
        guestId: String(body.guestId || '').trim(),
      };
      if (!owner.userId && !owner.guestId) {
        sendError(res, 400, 'guestId is required for anonymous users');
        return;
      }
      const location = normalizeLocation(body.location || {});
      if (!location.label) {
        sendError(res, 400, 'location label is required');
        return;
      }
      const db = await readDb();
      const { profile, idx } = findOrCreateLocationProfile(db, owner);
      const shouldSave = Boolean(body.saveToSaved);
      profile.currentLocation = location;
      profile.recentLocations = mergeLocationUnique(profile.recentLocations, location, 12);
      if (shouldSave) {
        profile.savedLocations = mergeLocationUnique(profile.savedLocations, location, 20);
      }
      profile.updatedAt = new Date().toISOString();
      db.locationProfiles[idx] = normalizeLocationProfile(profile);
      db.locationSuggestions = mergeLocationUnique(db.locationSuggestions, location, 60);
      await writeDb(db);
      sendJson(res, 200, { profile: db.locationProfiles[idx] });
      return;
    }

    if (pathname === '/api/public/location-profile/save' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const owner = (await getLocationOwner(req, searchParams)) || {
        userId: null,
        guestId: String(body.guestId || '').trim(),
      };
      if (!owner.userId && !owner.guestId) {
        sendError(res, 400, 'guestId is required for anonymous users');
        return;
      }
      const location = normalizeLocation(body.location || {});
      const db = await readDb();
      const { profile, idx } = findOrCreateLocationProfile(db, owner);
      profile.savedLocations = mergeLocationUnique(profile.savedLocations, location, 20);
      profile.recentLocations = mergeLocationUnique(profile.recentLocations, location, 12);
      if (!profile.currentLocation) {
        profile.currentLocation = location;
      }
      profile.updatedAt = new Date().toISOString();
      db.locationProfiles[idx] = normalizeLocationProfile(profile);
      db.locationSuggestions = mergeLocationUnique(db.locationSuggestions, location, 60);
      await writeDb(db);
      sendJson(res, 200, { profile: db.locationProfiles[idx] });
      return;
    }

    if (pathname === '/api/public/storefront/state' && req.method === 'GET') {
      const owner = await getStorefrontOwner(req, searchParams, null);
      if (!owner) {
        sendError(res, 400, 'guestId is required for anonymous users');
        return;
      }

      const conn = await mysqlPool.getConnection();
      try {
        if (owner.userId) {
          await ensureUserPreferenceRows(conn, owner.userId);
        }
        const cart = await getOrCreateActiveCart(conn, owner);
        const [
          cartItems,
          orders,
          wishlistIds,
          paymentMethods,
          installationRequests,
          warrantyClaims,
          notificationPrefs,
          profileBundle,
        ] = await Promise.all([
          fetchCartItemsByCartId(conn, cart.id, req),
          fetchOrdersByOwner(conn, owner, req),
          fetchWishlistIds(conn, owner.userId),
          fetchPaymentMethods(conn, owner.userId),
          fetchInstallationRequests(conn, owner.userId),
          fetchWarrantyClaims(conn, owner.userId),
          fetchNotificationPrefs(conn, owner.userId),
          fetchUserProfileAndPrefs(conn, owner.userId),
        ]);

        sendJson(res, 200, {
          cartItems,
          orders,
          wishlistIds,
          paymentMethods,
          installationRequests,
          warrantyClaims,
          notificationPrefs,
          profile: profileBundle.profile,
          preferences: profileBundle.preferences,
        });
      } finally {
        conn.release();
      }
      return;
    }

    if (pathname === '/api/public/storefront/cart' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const owner = await getStorefrontOwner(req, searchParams, body);
      if (!owner) {
        sendError(res, 400, 'guestId is required for anonymous users');
        return;
      }

      const items = Array.isArray(body.items) ? body.items : [];
      const conn = await mysqlPool.getConnection();
      try {
        await conn.beginTransaction();
        const cart = await getOrCreateActiveCart(conn, owner);

        await conn.query(`DELETE FROM cart_items WHERE cart_id = ?`, [cart.id]);

        for (const raw of items) {
          const productId = String(raw?.productId || '').trim();
          if (!productId) continue;
          const capacity = normalizeCapacityAh(raw?.capacity || raw?.capacityAh);
          const qty = parseNumber(raw?.qty, 0);
          const unitPrice = parseNumber(raw?.unitPrice, 0);
          if (qty <= 0 || unitPrice < 0) continue;
          await conn.query(
            `INSERT INTO cart_items
              (id, cart_id, product_id, capacity, unit_price, qty)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [`ci_${crypto.randomUUID().slice(0, 8)}`, cart.id, productId, capacity, unitPrice, qty],
          );
        }

        await conn.query(
          `UPDATE carts
           SET updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [cart.id],
        );

        const cartItems = await fetchCartItemsByCartId(conn, cart.id, req);
        await conn.commit();
        sendJson(res, 200, { cartItems });
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
      return;
    }

    if (pathname === '/api/public/storefront/checkout' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const owner = await getStorefrontOwner(req, searchParams, body);
      if (!owner) {
        sendError(res, 400, 'guestId is required for anonymous users');
        return;
      }

      const conn = await mysqlPool.getConnection();
      try {
        await conn.beginTransaction();
        const cart = await getOrCreateActiveCart(conn, owner);
        const [lineRows] = await conn.query(
          `SELECT ci.product_id,
                  ci.capacity,
                  ci.unit_price,
                  ci.qty,
                  COALESCE(p.name, 'Product') AS product_name,
                  COALESCE(NULLIF(p.model, ''), p.sku, '') AS product_model,
                  p.qty_on_hand
           FROM cart_items ci
           LEFT JOIN products p ON p.id = ci.product_id
           WHERE ci.cart_id = ?`,
          [cart.id],
        );
        const lines = Array.isArray(lineRows) ? lineRows : [];
        if (lines.length === 0) {
          sendError(res, 400, 'Cart is empty');
          await conn.rollback();
          return;
        }

        for (const row of lines) {
          const onHand = parseNumber(row.qty_on_hand, 0);
          const need = parseNumber(row.qty, 0);
          if (need <= 0) {
            sendError(res, 400, 'Invalid cart quantity');
            await conn.rollback();
            return;
          }
          if (onHand < need) {
            sendError(res, 400, `Insufficient stock for ${row.product_name || row.product_id}`);
            await conn.rollback();
            return;
          }
        }

        const subtotal = clamp2(
          lines.reduce((sum, row) => sum + parseNumber(row.unit_price, 0) * parseNumber(row.qty, 0), 0),
        );
        const discount = subtotal >= 20000 ? Math.round(subtotal * 0.1) : 0;
        const deliveryFee = 0;
        const total = clamp2(Math.max(0, subtotal - discount + deliveryFee));

        const ownerWhere = buildOwnerCondition(owner);
        const [locationRows] = await conn.query(
          `SELECT current_location_id
           FROM location_profiles
           WHERE ${ownerWhere.sql}
           ORDER BY updated_at DESC
           LIMIT 1`,
          ownerWhere.params,
        );
        const locationId =
          Array.isArray(locationRows) && locationRows[0]
            ? locationRows[0].current_location_id || null
            : null;

        const orderId = `ord_${crypto.randomUUID().slice(0, 8)}`;
        const orderNumber = `ORD-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 900 + 100)}`;
        await conn.query(
          `INSERT INTO customer_orders
            (id, order_number, user_id, guest_id, location_id, status, subtotal, discount, delivery_fee, total)
           VALUES (?, ?, ?, ?, ?, 'Processing', ?, ?, ?, ?)`,
          [
            orderId,
            orderNumber,
            owner.userId || null,
            owner.guestId || null,
            locationId,
            subtotal,
            discount,
            deliveryFee,
            total,
          ],
        );

        for (const row of lines) {
          const unitPrice = parseNumber(row.unit_price, 0);
          const qty = parseNumber(row.qty, 0);
          await conn.query(
            `INSERT INTO customer_order_items
              (id, order_id, product_id, product_name, model, capacity, unit_price, qty)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              `coi_${crypto.randomUUID().slice(0, 8)}`,
              orderId,
              row.product_id,
              row.product_name || 'Product',
              row.product_model || '',
              row.capacity || '150Ah',
              unitPrice,
              qty,
            ],
          );
          await conn.query(
            `UPDATE products
             SET qty_on_hand = qty_on_hand - ?
             WHERE id = ?`,
            [qty, row.product_id],
          );
          await conn.query(
            `INSERT INTO stock_movements
              (id, product_id, movement_type, delta_qty, balance_after, reason, reference_no, created_by)
             VALUES (?, ?, 'SALES_FULFILLMENT', ?, ?, ?, ?, NULL)`,
            [
              `mov_${crypto.randomUUID().slice(0, 8)}`,
              row.product_id,
              -qty,
              parseNumber(row.qty_on_hand, 0) - qty,
              'Storefront checkout',
              orderNumber,
            ],
          );
        }

        await conn.query(`DELETE FROM cart_items WHERE cart_id = ?`, [cart.id]);
        await conn.query(
          `UPDATE carts
           SET updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [cart.id],
        );

        const [orders, cartItems] = await Promise.all([
          fetchOrdersByOwner(conn, owner, req),
          fetchCartItemsByCartId(conn, cart.id, req),
        ]);

        const itemCount = lines.reduce((sum, row) => sum + parseNumber(row.qty, 0), 0);
        const order = {
          id: orderNumber,
          createdAt: toYmd(new Date()),
          itemCount,
          total,
          status: 'Processing',
        };

        await conn.commit();
        sendJson(res, 201, { order, orders, cartItems });
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
      return;
    }

    if (pathname === '/api/public/storefront/wishlist/toggle' && req.method === 'POST') {
      const authUser = await getAuth(req);
      if (!authUser?.userId) {
        sendError(res, 401, 'Login required for wishlist');
        return;
      }
      const body = await parseJsonBody(req);
      const productId = String(body.productId || '').trim();
      if (!productId) {
        sendError(res, 400, 'productId is required');
        return;
      }

      const conn = await mysqlPool.getConnection();
      try {
        const [existingRows] = await conn.query(
          `SELECT 1
           FROM wishlists
           WHERE user_id = ?
             AND product_id = ?
           LIMIT 1`,
          [authUser.userId, productId],
        );
        const exists = Array.isArray(existingRows) && existingRows.length > 0;
        if (exists) {
          await conn.query(
            `DELETE FROM wishlists
             WHERE user_id = ?
               AND product_id = ?`,
            [authUser.userId, productId],
          );
        } else {
          await conn.query(
            `INSERT INTO wishlists (user_id, product_id)
             VALUES (?, ?)`,
            [authUser.userId, productId],
          );
        }
        const wishlistIds = await fetchWishlistIds(conn, authUser.userId);
        sendJson(res, 200, { wishlistIds, inWishlist: !exists });
      } finally {
        conn.release();
      }
      return;
    }

    if (pathname === '/api/public/storefront/payment-methods' && req.method === 'POST') {
      const authUser = await getAuth(req);
      if (!authUser?.userId) {
        sendError(res, 401, 'Login required for payment methods');
        return;
      }
      const body = await parseJsonBody(req);
      const label = String(body.label || 'UPI').trim() || 'UPI';
      const detail = String(body.detail || '').trim();
      const methodType = ['COD', 'UPI', 'CARD', 'NETBANKING'].includes(String(body.methodType || '').toUpperCase())
        ? String(body.methodType).toUpperCase()
        : 'UPI';

      const conn = await mysqlPool.getConnection();
      try {
        const [countRows] = await conn.query(
          `SELECT COUNT(*) AS total
           FROM payment_methods
           WHERE user_id = ?
             AND is_active = 1`,
          [authUser.userId],
        );
        const isDefault = parseNumber(countRows?.[0]?.total, 0) === 0 ? 1 : 0;
        await conn.query(
          `INSERT INTO payment_methods
            (id, user_id, method_type, label, detail, is_default, is_active)
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [`pm_${crypto.randomUUID().slice(0, 8)}`, authUser.userId, methodType, label, detail || null, isDefault],
        );
        const paymentMethods = await fetchPaymentMethods(conn, authUser.userId);
        sendJson(res, 201, { paymentMethods });
      } finally {
        conn.release();
      }
      return;
    }

    if (pathname === '/api/public/storefront/payment-methods/default' && req.method === 'POST') {
      const authUser = await getAuth(req);
      if (!authUser?.userId) {
        sendError(res, 401, 'Login required for payment methods');
        return;
      }
      const body = await parseJsonBody(req);
      const methodId = String(body.methodId || '').trim();
      if (!methodId) {
        sendError(res, 400, 'methodId is required');
        return;
      }

      const conn = await mysqlPool.getConnection();
      try {
        await conn.query(
          `UPDATE payment_methods
           SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END
           WHERE user_id = ?
             AND is_active = 1`,
          [methodId, authUser.userId],
        );
        const paymentMethods = await fetchPaymentMethods(conn, authUser.userId);
        sendJson(res, 200, { paymentMethods });
      } finally {
        conn.release();
      }
      return;
    }

    if (pathname === '/api/public/storefront/installation-requests' && req.method === 'POST') {
      const authUser = await getAuth(req);
      if (!authUser?.userId) {
        sendError(res, 401, 'Login required for installation requests');
        return;
      }
      const body = await parseJsonBody(req);
      const note = String(body.note || 'Installation requested for recent purchase').trim();
      const orderId = String(body.orderId || '').trim() || null;

      const conn = await mysqlPool.getConnection();
      try {
        await conn.query(
          `INSERT INTO installation_requests
            (id, user_id, order_id, status, note)
           VALUES (?, ?, ?, 'Pending', ?)`,
          [`ins_${crypto.randomUUID().slice(0, 8)}`, authUser.userId, orderId, note || null],
        );
        const installationRequests = await fetchInstallationRequests(conn, authUser.userId);
        sendJson(res, 201, { installationRequests });
      } finally {
        conn.release();
      }
      return;
    }

    if (pathname === '/api/public/storefront/warranty-claims' && req.method === 'POST') {
      const authUser = await getAuth(req);
      if (!authUser?.userId) {
        sendError(res, 401, 'Login required for warranty claims');
        return;
      }
      const body = await parseJsonBody(req);
      const note = String(body.note || 'Warranty claim filed for product issue').trim();
      const orderId = String(body.orderId || '').trim() || null;
      const productId = String(body.productId || '').trim() || null;

      const conn = await mysqlPool.getConnection();
      try {
        await conn.query(
          `INSERT INTO warranty_claims
            (id, user_id, order_id, product_id, status, note)
           VALUES (?, ?, ?, ?, 'Submitted', ?)`,
          [`war_${crypto.randomUUID().slice(0, 8)}`, authUser.userId, orderId, productId, note || null],
        );
        const warrantyClaims = await fetchWarrantyClaims(conn, authUser.userId);
        sendJson(res, 201, { warrantyClaims });
      } finally {
        conn.release();
      }
      return;
    }

    if (pathname === '/api/public/storefront/notification-preferences' && req.method === 'PATCH') {
      const authUser = await getAuth(req);
      if (!authUser?.userId) {
        sendError(res, 401, 'Login required for notification preferences');
        return;
      }
      const body = await parseJsonBody(req);
      const orderUpdates = parseBool(body.orderUpdates, true);
      const promotions = parseBool(body.promotions, true);
      const warrantyAlerts = parseBool(body.warrantyAlerts, true);

      const conn = await mysqlPool.getConnection();
      try {
        await ensureUserPreferenceRows(conn, authUser.userId);
        await conn.query(
          `UPDATE notification_preferences
           SET order_updates = ?, promotions = ?, warranty_alerts = ?
           WHERE user_id = ?`,
          [orderUpdates ? 1 : 0, promotions ? 1 : 0, warrantyAlerts ? 1 : 0, authUser.userId],
        );
        const notificationPrefs = await fetchNotificationPrefs(conn, authUser.userId);
        sendJson(res, 200, { notificationPrefs });
      } finally {
        conn.release();
      }
      return;
    }

    if (pathname === '/api/public/storefront/profile' && req.method === 'PATCH') {
      const authUser = await getAuth(req);
      if (!authUser?.userId) {
        sendError(res, 401, 'Login required for profile updates');
        return;
      }
      const body = await parseJsonBody(req);
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim();
      const phone = String(body.phone || '').trim();

      const conn = await mysqlPool.getConnection();
      try {
        if (email) {
          const [emailRows] = await conn.query(
            `SELECT id
             FROM users
             WHERE username = ?
               AND id <> ?
             LIMIT 1`,
            [email, authUser.userId],
          );
          if (Array.isArray(emailRows) && emailRows.length > 0) {
            sendError(res, 409, 'Email/username already exists');
            return;
          }
        }

        await conn.query(
          `UPDATE users
           SET full_name = COALESCE(NULLIF(?, ''), full_name),
               username = COALESCE(NULLIF(?, ''), username),
               phone = ?
           WHERE id = ?`,
          [name, email, phone || null, authUser.userId],
        );

        const profileBundle = await fetchUserProfileAndPrefs(conn, authUser.userId);
        sendJson(res, 200, { profile: profileBundle.profile, preferences: profileBundle.preferences });
      } finally {
        conn.release();
      }
      return;
    }

    if (pathname === '/api/public/storefront/preferences' && req.method === 'PATCH') {
      const authUser = await getAuth(req);
      if (!authUser?.userId) {
        sendError(res, 401, 'Login required for app preferences');
        return;
      }
      const body = await parseJsonBody(req);
      const darkMode = parseBool(body.darkMode, false);
      const language = String(body.language || '').trim() === 'Hindi' ? 'Hindi' : 'English';

      const conn = await mysqlPool.getConnection();
      try {
        await ensureUserPreferenceRows(conn, authUser.userId);
        await conn.query(
          `UPDATE user_preferences
           SET language = ?
           WHERE user_id = ?`,
          [language, authUser.userId],
        );
        await conn.query(
          `UPDATE user_dark_mode_settings
           SET dark_mode = ?
           WHERE user_id = ?`,
          [darkMode ? 1 : 0, authUser.userId],
        );
        const profileBundle = await fetchUserProfileAndPrefs(conn, authUser.userId);
        sendJson(res, 200, { preferences: profileBundle.preferences, profile: profileBundle.profile });
      } finally {
        conn.release();
      }
      return;
    }

    if (pathname === '/api/public/feedback/order-items' && req.method === 'GET') {
      const owner = await getStorefrontOwner(req, searchParams, null);
      if (!owner) {
        sendError(res, 400, 'guestId is required for anonymous users');
        return;
      }
      const limit = Math.max(1, Math.min(200, parseNumber(searchParams.get('limit'), 80)));
      const conn = await mysqlPool.getConnection();
      try {
        const items = await fetchFeedbackOrderItemsByOwner(conn, owner, limit);
        sendJson(res, 200, { items, count: items.length });
      } finally {
        conn.release();
      }
      return;
    }

    if (pathname === '/api/public/feedback' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const owner = await getStorefrontOwner(req, searchParams, body);
      if (!owner) {
        sendError(res, 400, 'guestId is required for anonymous users');
        return;
      }
      const rating = Math.max(1, Math.min(5, parseNumber(body.rating, 0)));
      const message = String(body.message || '').trim();
      const orderId = String(body.orderId || '').trim();
      const orderItemId = String(body.orderItemId || '').trim();
      if (!rating || !message || !orderId || !orderItemId) {
        sendError(res, 400, 'rating, message, orderId and orderItemId are required');
        return;
      }

      const conn = await mysqlPool.getConnection();
      try {
        const ownerWhere = buildOwnerCondition(owner);
        const [orderItemRows] = await conn.query(
          `SELECT co.id AS order_id,
                  coi.id AS order_item_id,
                  coi.product_id
           FROM customer_orders co
           INNER JOIN customer_order_items coi ON coi.order_id = co.id
           WHERE ${ownerWhere.sql}
             AND co.id = ?
             AND coi.id = ?
           LIMIT 1`,
          [...ownerWhere.params, orderId, orderItemId],
        );
        const orderItem = Array.isArray(orderItemRows) ? orderItemRows[0] : null;
        if (!orderItem) {
          sendError(res, 404, 'Order item not found for this account');
          return;
        }

        await conn.query(
          `INSERT INTO customer_feedback
            (id, user_id, guest_id, order_id, order_item_id, product_id, rating, message)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `fb_${crypto.randomUUID().slice(0, 8)}`,
            owner.userId || null,
            owner.guestId || null,
            orderItem.order_id,
            orderItem.order_item_id,
            orderItem.product_id || null,
            rating,
            message,
          ],
        );
        sendJson(res, 201, { success: true });
      } finally {
        conn.release();
      }
      return;
    }

    const auth = await requireAuth(req, res, ['admin', 'manager', 'staff']);
    if (!auth) {
      return;
    }
    if (auth.role !== 'admin') {
      sendError(res, 403, 'Only admin can access inventory management');
      return;
    }

    if (pathname === '/api/management/overview' && req.method === 'GET') {
      const db = await readDb();
      sendJson(res, 200, {
        overview: managementOverview(db),
        recentMovements: db.stockMovements.slice(0, 8),
      });
      return;
    }

    if (pathname === '/api/management/feedback' && req.method === 'GET') {
      const limit = Math.max(1, Math.min(200, parseNumber(searchParams.get('limit'), 50)));
      const conn = await mysqlPool.getConnection();
      try {
        const [summaryRows, feedback] = await Promise.all([
          conn.query(
            `SELECT COUNT(*) AS total,
                    COALESCE(AVG(rating), 0) AS avg_rating
             FROM customer_feedback`,
          ),
          fetchCustomerFeedback(conn, limit),
        ]);
        const summary = Array.isArray(summaryRows?.[0]) ? summaryRows[0][0] : summaryRows[0];
        sendJson(res, 200, {
          feedback,
          stats: {
            total: parseNumber(summary?.total, 0),
            averageRating: clamp2(parseNumber(summary?.avg_rating, 0)),
          },
        });
      } finally {
        conn.release();
      }
      return;
    }

    if ((pathname === '/api/items' || pathname === '/api/inventory') && req.method === 'GET') {
      const db = await readDb();
      const search = (searchParams.get('search') || '').trim().toLowerCase();
      const category = (searchParams.get('category') || 'All').trim();

      const filtered = db.items.filter(item => {
        const categoryMatch = category === 'All' || item.category === category;
        const text = `${item.name} ${item.sku} ${item.location} ${item.category} ${item.brand} ${item.capacityAh || ''}`.toLowerCase();
        const searchMatch = !search || text.includes(search);
        return categoryMatch && searchMatch;
      });

      sendJson(res, 200, {
        items: filtered.map(item => ({
          ...item,
          images: resolveAssetUrls(req, item.images || []),
        })),
        stats: inventoryStats(db.items),
      });
      return;
    }

    if ((pathname === '/api/items' || pathname === '/api/inventory') && req.method === 'POST') {
      if (!['admin', 'manager'].includes(auth.role)) {
        sendError(res, 403, 'Only admin/manager can create items');
        return;
      }
      const body = await parseJsonBody(req);
      const name = String(body.name || '').trim();
      const sku = String(body.sku || '').trim();
      if (!name || !sku) {
        sendError(res, 400, 'Item name and HSN/SAC are required');
        return;
      }

      const db = await readDb();
      const newItemId = `inv_${crypto.randomUUID().slice(0, 8)}`;
      const uploadedImageUrls = await saveUploadedItemImages(newItemId, body.uploadedImages);
      if (Array.isArray(body.uploadedImages) && body.uploadedImages.length > 0 && uploadedImageUrls.length === 0) {
        sendError(res, 400, 'Uploaded images are invalid or exceed size limit');
        return;
      }
      const urlImages = Array.isArray(body.images)
        ? body.images
            .map(value => String(value || '').trim())
            .filter(value => value && (/^https?:\/\//i.test(value) || value.startsWith('/static/')))
        : [];
      if (Array.isArray(body.images) && body.images.length > 0 && urlImages.length === 0 && uploadedImageUrls.length === 0) {
        sendError(res, 400, 'Image URLs are invalid');
        return;
      }
      const mergedImages = [...uploadedImageUrls, ...urlImages]
        .filter((value, index, arr) => arr.indexOf(value) === index)
        .slice(0, MAX_ITEM_UPLOAD_COUNT);

      const item = normalizeItem({
        id: newItemId,
        ...body,
        name,
        sku,
        images: mergedImages.length > 0 ? mergedImages : body.images,
        updatedAt: new Date().toISOString(),
      });

      if (item.qty < 0 || item.reorderPoint < 0 || item.purchasePrice < 0 || item.sellingPrice < 0 || item.taxRate < 0) {
        sendError(res, 400, 'Numeric values cannot be negative');
        return;
      }

      db.items.unshift(item);
      await writeDb(db);
      sendJson(res, 201, {
        item: {
          ...item,
          images: resolveAssetUrls(req, item.images || []),
        },
        overview: managementOverview(db),
      });
      return;
    }

    const itemId = getIdFromPath(pathname, '/api/items') || getIdFromPath(pathname, '/api/inventory');
    if (itemId && req.method === 'PATCH') {
      if (auth.role !== 'admin') {
        sendError(res, 403, 'Only admin can update items');
        return;
      }
      const body = await parseJsonBody(req);
      const db = await readDb();
      const index = db.items.findIndex(item => item.id === itemId);
      if (index < 0) {
        sendError(res, 404, 'Item not found');
        return;
      }
      const current = db.items[index];
      const next = normalizeItem({
        ...current,
        ...body,
        updatedAt: new Date().toISOString(),
      });

      db.items[index] = next;
      await writeDb(db);
      sendJson(res, 200, {
        item: {
          ...next,
          images: resolveAssetUrls(req, next.images || []),
        },
        overview: managementOverview(db),
      });
      return;
    }

    if (itemId && req.method === 'DELETE') {
      if (!['admin', 'manager'].includes(auth.role)) {
        sendError(res, 403, 'Only admin/manager can delete items');
        return;
      }
      const db = await readDb();
      const index = db.items.findIndex(item => item.id === itemId);
      if (index < 0) {
        sendError(res, 404, 'Item not found');
        return;
      }
      const removed = db.items.splice(index, 1)[0];
      await writeDb(db);
      sendJson(res, 200, { item: removed, overview: managementOverview(db) });
      return;
    }

    if (pathname === '/api/suppliers' && req.method === 'GET') {
      const db = await readDb();
      sendJson(res, 200, { suppliers: db.suppliers });
      return;
    }

    if (pathname === '/api/suppliers' && req.method === 'POST') {
      if (!['admin', 'manager'].includes(auth.role)) {
        sendError(res, 403, 'Only admin/manager can create suppliers');
        return;
      }
      const body = await parseJsonBody(req);
      if (!String(body.name || '').trim()) {
        sendError(res, 400, 'Supplier name is required');
        return;
      }
      const db = await readDb();
      const supplier = normalizeParty(body, 'supplier');
      db.suppliers.unshift(supplier);
      await writeDb(db);
      sendJson(res, 201, { supplier, overview: managementOverview(db) });
      return;
    }

    const supplierId = getIdFromPath(pathname, '/api/suppliers');
    if (supplierId && req.method === 'PATCH') {
      if (!['admin', 'manager'].includes(auth.role)) {
        sendError(res, 403, 'Only admin/manager can update suppliers');
        return;
      }
      const body = await parseJsonBody(req);
      const db = await readDb();
      const index = db.suppliers.findIndex(s => s.id === supplierId);
      if (index < 0) {
        sendError(res, 404, 'Supplier not found');
        return;
      }
      const next = normalizeParty({ ...db.suppliers[index], ...body, id: supplierId }, 'supplier');
      db.suppliers[index] = next;
      await writeDb(db);
      sendJson(res, 200, { supplier: next, overview: managementOverview(db) });
      return;
    }

    if (supplierId && req.method === 'DELETE') {
      if (auth.role !== 'admin') {
        sendError(res, 403, 'Only admin can delete suppliers');
        return;
      }
      const db = await readDb();
      const index = db.suppliers.findIndex(s => s.id === supplierId);
      if (index < 0) {
        sendError(res, 404, 'Supplier not found');
        return;
      }
      const removed = db.suppliers.splice(index, 1)[0];
      await writeDb(db);
      sendJson(res, 200, { supplier: removed, overview: managementOverview(db) });
      return;
    }

    if (pathname === '/api/customers' && req.method === 'GET') {
      const db = await readDb();
      sendJson(res, 200, { customers: db.customers });
      return;
    }

    if (pathname === '/api/customers' && req.method === 'POST') {
      if (!['admin', 'manager'].includes(auth.role)) {
        sendError(res, 403, 'Only admin/manager can create customers');
        return;
      }
      const body = await parseJsonBody(req);
      if (!String(body.name || '').trim()) {
        sendError(res, 400, 'Customer name is required');
        return;
      }
      const db = await readDb();
      const customer = normalizeParty(body, 'customer');
      db.customers.unshift(customer);
      await writeDb(db);
      sendJson(res, 201, { customer, overview: managementOverview(db) });
      return;
    }

    const customerId = getIdFromPath(pathname, '/api/customers');
    if (customerId && req.method === 'PATCH') {
      if (!['admin', 'manager'].includes(auth.role)) {
        sendError(res, 403, 'Only admin/manager can update customers');
        return;
      }
      const body = await parseJsonBody(req);
      const db = await readDb();
      const index = db.customers.findIndex(c => c.id === customerId);
      if (index < 0) {
        sendError(res, 404, 'Customer not found');
        return;
      }
      const next = normalizeParty({ ...db.customers[index], ...body, id: customerId }, 'customer');
      db.customers[index] = next;
      await writeDb(db);
      sendJson(res, 200, { customer: next, overview: managementOverview(db) });
      return;
    }

    if (customerId && req.method === 'DELETE') {
      if (auth.role !== 'admin') {
        sendError(res, 403, 'Only admin can delete customers');
        return;
      }
      const db = await readDb();
      const index = db.customers.findIndex(c => c.id === customerId);
      if (index < 0) {
        sendError(res, 404, 'Customer not found');
        return;
      }
      const removed = db.customers.splice(index, 1)[0];
      await writeDb(db);
      sendJson(res, 200, { customer: removed, overview: managementOverview(db) });
      return;
    }

    if (pathname === '/api/stock-adjustments' && req.method === 'GET') {
      const db = await readDb();
      const limit = Math.max(1, Math.min(100, parseNumber(searchParams.get('limit'), 50)));
      sendJson(res, 200, { movements: db.stockMovements.slice(0, limit) });
      return;
    }

    if (pathname === '/api/stock-adjustments' && req.method === 'POST') {
      if (!['admin', 'manager'].includes(auth.role)) {
        sendError(res, 403, 'Only admin/manager can post adjustments');
        return;
      }
      const body = await parseJsonBody(req);
      const db = await readDb();
      const delta = parseNumber(body.delta, 0);
      if (!body.itemId || !Number.isFinite(delta) || delta === 0) {
        sendError(res, 400, 'itemId and non-zero delta are required');
        return;
      }

      const movement = appendMovement(db, {
        itemId: String(body.itemId),
        delta,
        type: 'ADJUSTMENT',
        reason: String(body.reason || 'Manual adjustment'),
        reference: String(body.reference || ''),
      });

      await writeDb(db);
      sendJson(res, 201, { movement, overview: managementOverview(db) });
      return;
    }

    if (pathname === '/api/purchase-orders' && req.method === 'GET') {
      const db = await readDb();
      sendJson(res, 200, { purchaseOrders: db.purchaseOrders });
      return;
    }

    if (pathname === '/api/purchase-orders' && req.method === 'POST') {
      if (!['admin', 'manager'].includes(auth.role)) {
        sendError(res, 403, 'Only admin/manager can create purchase orders');
        return;
      }
      const body = await parseJsonBody(req);
      const db = await readDb();
      const itemId = String(body.itemId || '');
      const summary = extractItemSummary(db, itemId);
      if (!summary) {
        sendError(res, 404, 'Item not found for purchase order');
        return;
      }

      const qty = parseNumber(body.qty, 0);
      const unitCost = parseNumber(body.unitCost, 0);
      if (qty <= 0 || unitCost < 0) {
        sendError(res, 400, 'qty must be > 0 and unitCost >= 0');
        return;
      }

      const po = {
        id: `po_${crypto.randomUUID().slice(0, 8)}`,
        poNumber: `PO-${String(db.counters.po).padStart(4, '0')}`,
        vendor: String(body.vendor || 'Unknown Vendor'),
        expectedDate: String(body.expectedDate || ''),
        status: 'Open',
        lines: [
          {
            ...summary,
            qty,
            unitCost,
            lineTotal: clamp2(qty * unitCost),
          },
        ],
        total: clamp2(qty * unitCost),
        createdAt: new Date().toISOString(),
      };

      db.counters.po += 1;
      db.purchaseOrders.unshift(po);
      await writeDb(db);
      sendJson(res, 201, { purchaseOrder: po, overview: managementOverview(db) });
      return;
    }

    const receivePoId = getPathAction(pathname, '/api/purchase-orders', 'receive');
    if (receivePoId && req.method === 'POST') {
      if (!['admin', 'manager'].includes(auth.role)) {
        sendError(res, 403, 'Only admin/manager can receive purchase orders');
        return;
      }
      const db = await readDb();
      const poIndex = db.purchaseOrders.findIndex(po => po.id === receivePoId);
      if (poIndex < 0) {
        sendError(res, 404, 'Purchase order not found');
        return;
      }
      const po = db.purchaseOrders[poIndex];
      if (po.status !== 'Open') {
        sendError(res, 400, `Purchase order is already ${po.status}`);
        return;
      }

      po.lines.forEach(line => {
        appendMovement(db, {
          itemId: line.itemId,
          delta: line.qty,
          type: 'PURCHASE_RECEIPT',
          reason: `PO receipt from ${po.vendor}`,
          reference: po.poNumber,
        });
      });

      db.purchaseOrders[poIndex] = {
        ...po,
        status: 'Received',
        receivedAt: new Date().toISOString(),
      };

      await writeDb(db);
      sendJson(res, 200, { purchaseOrder: db.purchaseOrders[poIndex], overview: managementOverview(db) });
      return;
    }

    if (pathname === '/api/sales-orders' && req.method === 'GET') {
      const db = await readDb();
      sendJson(res, 200, { salesOrders: db.salesOrders });
      return;
    }

    if (pathname === '/api/sales-orders' && req.method === 'POST') {
      if (!['admin', 'manager'].includes(auth.role)) {
        sendError(res, 403, 'Only admin/manager can create sales orders');
        return;
      }
      const body = await parseJsonBody(req);
      const db = await readDb();
      const itemId = String(body.itemId || '');
      const summary = extractItemSummary(db, itemId);
      const item = db.items.find(it => it.id === itemId);
      if (!summary || !item) {
        sendError(res, 404, 'Item not found for sales order');
        return;
      }

      const qty = parseNumber(body.qty, 0);
      const unitPrice = parseNumber(body.unitPrice, item.sellingPrice || 0);
      if (qty <= 0 || unitPrice < 0) {
        sendError(res, 400, 'qty must be > 0 and unitPrice >= 0');
        return;
      }

      const so = {
        id: `so_${crypto.randomUUID().slice(0, 8)}`,
        soNumber: `SO-${String(db.counters.so).padStart(4, '0')}`,
        customer: String(body.customer || 'Walk-in Customer'),
        status: 'Open',
        lines: [
          {
            ...summary,
            qty,
            unitPrice,
            lineTotal: clamp2(qty * unitPrice),
          },
        ],
        total: clamp2(qty * unitPrice),
        createdAt: new Date().toISOString(),
      };

      db.counters.so += 1;
      db.salesOrders.unshift(so);
      await writeDb(db);
      sendJson(res, 201, { salesOrder: so, overview: managementOverview(db) });
      return;
    }

    const fulfillSoId = getPathAction(pathname, '/api/sales-orders', 'fulfill');
    if (fulfillSoId && req.method === 'POST') {
      if (!['admin', 'manager'].includes(auth.role)) {
        sendError(res, 403, 'Only admin/manager can fulfill sales orders');
        return;
      }
      const db = await readDb();
      const soIndex = db.salesOrders.findIndex(so => so.id === fulfillSoId);
      if (soIndex < 0) {
        sendError(res, 404, 'Sales order not found');
        return;
      }
      const so = db.salesOrders[soIndex];
      if (so.status !== 'Open') {
        sendError(res, 400, `Sales order is already ${so.status}`);
        return;
      }

      for (const line of so.lines) {
        const item = db.items.find(it => it.id === line.itemId);
        if (!item || item.qty < line.qty) {
          sendError(res, 400, `Insufficient stock for ${line.itemName}`);
          return;
        }
      }

      so.lines.forEach(line => {
        appendMovement(db, {
          itemId: line.itemId,
          delta: -line.qty,
          type: 'SALES_FULFILLMENT',
          reason: `SO fulfillment to ${so.customer}`,
          reference: so.soNumber,
        });
      });

      db.salesOrders[soIndex] = {
        ...so,
        status: 'Fulfilled',
        fulfilledAt: new Date().toISOString(),
      };

      await writeDb(db);
      sendJson(res, 200, { salesOrder: db.salesOrders[soIndex], overview: managementOverview(db) });
      return;
    }

    if (pathname === '/api/bills' && req.method === 'GET') {
      const db = await readDb();
      sendJson(res, 200, { bills: db.bills });
      return;
    }

    if (pathname === '/api/bills' && req.method === 'POST') {
      if (!['admin', 'manager'].includes(auth.role)) {
        sendError(res, 403, 'Only admin/manager can create bills');
        return;
      }
      const body = await parseJsonBody(req);
      const db = await readDb();
      const supplierId = String(body.supplierId || '');
      const itemId = String(body.itemId || '');
      const supplier = db.suppliers.find(s => s.id === supplierId);
      const itemSummary = extractItemSummary(db, itemId);
      if (!supplier) {
        sendError(res, 404, 'Supplier not found');
        return;
      }
      if (!itemSummary) {
        sendError(res, 404, 'Item not found for bill');
        return;
      }

      const qty = parseNumber(body.qty, 0);
      const unitCost = parseNumber(body.unitCost, 0);
      if (qty <= 0 || unitCost < 0) {
        sendError(res, 400, 'qty must be > 0 and unitCost >= 0');
        return;
      }

      appendMovement(db, {
        itemId,
        delta: qty,
        type: 'BILL_RECEIPT',
        reason: `Bill from ${supplier.name}`,
        reference: `BILL-${String(db.counters.bill).padStart(4, '0')}`,
      });

      const total = clamp2(qty * unitCost);
      const bill = {
        id: `bill_${crypto.randomUUID().slice(0, 8)}`,
        billNumber: `BILL-${String(db.counters.bill).padStart(4, '0')}`,
        supplierId,
        supplierName: supplier.name,
        status: 'Open',
        dueDate: String(body.dueDate || ''),
        lines: [
          {
            ...itemSummary,
            qty,
            unitCost,
            lineTotal: total,
          },
        ],
        total,
        createdAt: new Date().toISOString(),
      };

      db.counters.bill += 1;
      db.bills.unshift(bill);
      await writeDb(db);
      sendJson(res, 201, { bill, overview: managementOverview(db) });
      return;
    }

    const payBillId = getPathAction(pathname, '/api/bills', 'pay');
    if (payBillId && req.method === 'POST') {
      if (!['admin', 'manager'].includes(auth.role)) {
        sendError(res, 403, 'Only admin/manager can pay bills');
        return;
      }
      const db = await readDb();
      const index = db.bills.findIndex(b => b.id === payBillId);
      if (index < 0) {
        sendError(res, 404, 'Bill not found');
        return;
      }
      if (db.bills[index].status !== 'Open') {
        sendError(res, 400, 'Bill already closed');
        return;
      }
      db.bills[index] = {
        ...db.bills[index],
        status: 'Paid',
        paidAt: new Date().toISOString(),
      };
      await writeDb(db);
      sendJson(res, 200, { bill: db.bills[index], overview: managementOverview(db) });
      return;
    }

    if (pathname === '/api/invoices' && req.method === 'GET') {
      const db = await readDb();
      sendJson(res, 200, { invoices: db.invoices });
      return;
    }

    if (pathname === '/api/invoices' && req.method === 'POST') {
      if (!['admin', 'manager'].includes(auth.role)) {
        sendError(res, 403, 'Only admin/manager can create invoices');
        return;
      }
      const body = await parseJsonBody(req);
      const db = await readDb();
      const customerId = String(body.customerId || '');
      const itemId = String(body.itemId || '');
      const customer = db.customers.find(c => c.id === customerId);
      const itemSummary = extractItemSummary(db, itemId);
      if (!customer) {
        sendError(res, 404, 'Customer not found');
        return;
      }
      if (!itemSummary) {
        sendError(res, 404, 'Item not found for invoice');
        return;
      }

      const qty = parseNumber(body.qty, 0);
      const unitPrice = parseNumber(body.unitPrice, 0);
      if (qty <= 0 || unitPrice < 0) {
        sendError(res, 400, 'qty must be > 0 and unitPrice >= 0');
        return;
      }

      appendMovement(db, {
        itemId,
        delta: -qty,
        type: 'INVOICE_SALE',
        reason: `Invoice to ${customer.name}`,
        reference: `INV-${String(db.counters.inv).padStart(4, '0')}`,
      });

      const total = clamp2(qty * unitPrice);
      const invoice = {
        id: `invdoc_${crypto.randomUUID().slice(0, 8)}`,
        invoiceNumber: `INV-${String(db.counters.inv).padStart(4, '0')}`,
        customerId,
        customerName: customer.name,
        status: 'Open',
        dueDate: String(body.dueDate || ''),
        lines: [
          {
            ...itemSummary,
            qty,
            unitPrice,
            lineTotal: total,
          },
        ],
        total,
        createdAt: new Date().toISOString(),
      };

      db.counters.inv += 1;
      db.invoices.unshift(invoice);
      await writeDb(db);
      sendJson(res, 201, { invoice, overview: managementOverview(db) });
      return;
    }

    const receiveInvoiceId = getPathAction(pathname, '/api/invoices', 'receive-payment');
    if (receiveInvoiceId && req.method === 'POST') {
      if (!['admin', 'manager'].includes(auth.role)) {
        sendError(res, 403, 'Only admin/manager can record payments');
        return;
      }
      const db = await readDb();
      const index = db.invoices.findIndex(i => i.id === receiveInvoiceId);
      if (index < 0) {
        sendError(res, 404, 'Invoice not found');
        return;
      }
      if (db.invoices[index].status !== 'Open') {
        sendError(res, 400, 'Invoice already closed');
        return;
      }
      db.invoices[index] = {
        ...db.invoices[index],
        status: 'Paid',
        paidAt: new Date().toISOString(),
      };
      await writeDb(db);
      sendJson(res, 200, { invoice: db.invoices[index], overview: managementOverview(db) });
      return;
    }

    sendError(res, 404, 'Route not found');
  } catch (error) {
    const mapped = toErrorResponse(error);
    if (mapped.isServerError) {
      console.error(`[${new Date().toISOString()}] ${req.method} ${pathname}`, error);
    }
    sendError(res, mapped.status, mapped.message);
  }
});

server.listen(PORT, () => {
  console.log(`Inventory API running at http://localhost:${PORT}`);
});
