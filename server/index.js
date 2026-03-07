const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const { config } = require('./config');
let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch {
  nodemailer = null;
}

const PORT = config.port;
const SESSION_TTL_MS = config.sessionTtlMs;
const MYSQL_HOST = config.mysql.host;
const MYSQL_PORT = config.mysql.port;
const MYSQL_USER = config.mysql.user;
const MYSQL_PASSWORD = config.mysql.password;
const MYSQL_DATABASE = config.mysql.database;
const APP_NAME = config.appName;
const AUTH_PUBLIC_BASE_URL = config.auth.publicBaseUrl;
const AUTH_RESET_TOKEN_TTL_MS = config.auth.resetTokenTtlMs;
const AUTH_RESET_REQUEST_COOLDOWN_MS = config.auth.resetRequestCooldownMs;
const SMTP_HOST = config.mail.host;
const SMTP_PORT = config.mail.port;
const SMTP_SECURE = config.mail.secure;
const SMTP_USER = config.mail.user;
const SMTP_PASSWORD = config.mail.password;
const SMTP_FROM = config.mail.from;
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
let mailTransport = null;
const passwordResetRequestLimiter = new Map();

const PASSWORD_HASH_ALGORITHM = 'scrypt';
const PASSWORD_HASH_KEYLEN = 64;
const PASSWORD_HASH_SALT_BYTES = 16;
const PASSWORD_HASH_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
};
const PASSWORD_RESET_TOKEN_BYTES = 32;

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

const DEFAULT_INVOICE_SELLER = Object.freeze({
  sellerName: 'FuElectric',
  sellerGstin: '',
  sellerAddress: 'New Delhi, Delhi, India',
  sellerState: 'Delhi',
  sellerPhone: '',
  sellerEmail: '',
  sellerWebsite: '',
  sellerPan: '',
  bankAccountName: '',
  bankAccountNumber: '',
  bankIfsc: '',
  bankBranch: '',
  declarationNote: '',
  footerNote: '',
});
const INVOICE_DOWNLOAD_LINK_TTL_MS = 1000 * 60 * 15;
const INVOICE_DOWNLOAD_SECRET = crypto
  .createHash('sha256')
  .update(`${MYSQL_PASSWORD}|${APP_NAME}|invoice-download`)
  .digest('hex');

const NUMBER_WORDS_ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const NUMBER_WORDS_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function parseNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp2(num) {
  return Math.round(num * 100) / 100;
}

function compactText(value) {
  return String(value || '').trim();
}

function joinNonEmpty(parts, separator = ', ') {
  return parts.map(compactText).filter(Boolean).join(separator);
}

function normalizeStateKey(value) {
  return compactText(value).toLowerCase().replace(/[^a-z]/g, '');
}

function normalizeInvoiceSellerProfile(value) {
  const source = value || {};
  return {
    sellerName: compactText(source.sellerName) || DEFAULT_INVOICE_SELLER.sellerName,
    sellerGstin: compactText(source.sellerGstin).toUpperCase(),
    sellerAddress: compactText(source.sellerAddress) || DEFAULT_INVOICE_SELLER.sellerAddress,
    sellerState: compactText(source.sellerState) || DEFAULT_INVOICE_SELLER.sellerState,
    sellerPhone: compactText(source.sellerPhone),
    sellerEmail: compactText(source.sellerEmail),
    sellerWebsite: compactText(source.sellerWebsite),
    sellerPan: compactText(source.sellerPan).toUpperCase(),
    bankAccountName: compactText(source.bankAccountName),
    bankAccountNumber: compactText(source.bankAccountNumber),
    bankIfsc: compactText(source.bankIfsc).toUpperCase(),
    bankBranch: compactText(source.bankBranch),
    declarationNote: compactText(source.declarationNote),
    footerNote: compactText(source.footerNote),
  };
}

function getDefaultInvoiceSellerProfile() {
  return normalizeInvoiceSellerProfile(DEFAULT_INVOICE_SELLER);
}

function validateInvoiceSellerProfileInput(value) {
  const profile = normalizeInvoiceSellerProfile(value);
  if (!profile.sellerName) {
    return 'Seller name is required';
  }
  if (!profile.sellerAddress) {
    return 'Seller address is required';
  }
  if (!profile.sellerState) {
    return 'Seller state is required';
  }
  if (profile.sellerGstin && !/^[0-9A-Z]{15}$/.test(profile.sellerGstin)) {
    return 'GSTIN must be 15 characters';
  }
  if (profile.sellerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.sellerEmail)) {
    return 'Seller email is invalid';
  }
  if (profile.bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(profile.bankIfsc)) {
    return 'IFSC code is invalid';
  }
  return null;
}

async function fetchInvoiceSellerProfile(conn = null) {
  const executor = conn || mysqlPool;
  const [rows] = await executor.query(
    `SELECT seller_name,
            seller_gstin,
            seller_address,
            seller_state,
            seller_phone,
            seller_email,
            seller_website,
            seller_pan,
            bank_account_name,
            bank_account_number,
            bank_ifsc,
            bank_branch,
            declaration_note,
            footer_note
     FROM invoice_seller_settings
     WHERE id = 'default'
     LIMIT 1`,
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  return normalizeInvoiceSellerProfile({
    sellerName: row?.seller_name,
    sellerGstin: row?.seller_gstin,
    sellerAddress: row?.seller_address,
    sellerState: row?.seller_state,
    sellerPhone: row?.seller_phone,
    sellerEmail: row?.seller_email,
    sellerWebsite: row?.seller_website,
    sellerPan: row?.seller_pan,
    bankAccountName: row?.bank_account_name,
    bankAccountNumber: row?.bank_account_number,
    bankIfsc: row?.bank_ifsc,
    bankBranch: row?.bank_branch,
    declarationNote: row?.declaration_note,
    footerNote: row?.footer_note,
  });
}

async function upsertInvoiceSellerProfile(conn, value, updatedBy = null) {
  const profile = normalizeInvoiceSellerProfile(value);
  await conn.query(
    `INSERT INTO invoice_seller_settings
      (id, seller_name, seller_gstin, seller_address, seller_state, seller_phone, seller_email, seller_website,
       seller_pan, bank_account_name, bank_account_number, bank_ifsc, bank_branch, declaration_note, footer_note, updated_by)
     VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       seller_name = VALUES(seller_name),
       seller_gstin = VALUES(seller_gstin),
       seller_address = VALUES(seller_address),
       seller_state = VALUES(seller_state),
       seller_phone = VALUES(seller_phone),
       seller_email = VALUES(seller_email),
       seller_website = VALUES(seller_website),
       seller_pan = VALUES(seller_pan),
       bank_account_name = VALUES(bank_account_name),
       bank_account_number = VALUES(bank_account_number),
       bank_ifsc = VALUES(bank_ifsc),
       bank_branch = VALUES(bank_branch),
       declaration_note = VALUES(declaration_note),
       footer_note = VALUES(footer_note),
       updated_by = VALUES(updated_by),
       updated_at = CURRENT_TIMESTAMP`,
    [
      profile.sellerName,
      profile.sellerGstin || null,
      profile.sellerAddress,
      profile.sellerState,
      profile.sellerPhone || null,
      profile.sellerEmail || null,
      profile.sellerWebsite || null,
      profile.sellerPan || null,
      profile.bankAccountName || null,
      profile.bankAccountNumber || null,
      profile.bankIfsc || null,
      profile.bankBranch || null,
      profile.declarationNote || null,
      profile.footerNote || null,
      updatedBy || null,
    ],
  );
  return fetchInvoiceSellerProfile(conn);
}

function buildLocationAddress(location) {
  if (!location) return '';
  const label = compactText(location.label);
  const details = joinNonEmpty(
    [location.area, location.city, location.state, location.country].filter(Boolean),
  );
  const pincode = compactText(location.pincode);
  const base = label || details;
  if (base && pincode && !base.includes(pincode)) {
    return joinNonEmpty([base, pincode]);
  }
  return base || pincode;
}

function formatPlaceOfSupply(location, fallbackAddress = '') {
  if (location) {
    return joinNonEmpty([location.state, location.pincode], ' - ') || buildLocationAddress(location);
  }
  return compactText(fallbackAddress) || DEFAULT_INVOICE_SELLER.sellerState;
}

function numberToIndianWords(value) {
  const number = Math.max(0, Math.floor(parseNumber(value, 0)));
  if (number < 20) {
    return NUMBER_WORDS_ONES[number];
  }
  if (number < 100) {
    const tens = NUMBER_WORDS_TENS[Math.floor(number / 10)];
    const unit = number % 10;
    return unit ? `${tens} ${NUMBER_WORDS_ONES[unit]}` : tens;
  }
  if (number < 1000) {
    const hundreds = `${NUMBER_WORDS_ONES[Math.floor(number / 100)]} hundred`;
    const remainder = number % 100;
    return remainder ? `${hundreds} ${numberToIndianWords(remainder)}` : hundreds;
  }
  const units = [
    { value: 10000000, label: 'crore' },
    { value: 100000, label: 'lakh' },
    { value: 1000, label: 'thousand' },
  ];
  for (const unit of units) {
    if (number >= unit.value) {
      const major = Math.floor(number / unit.value);
      const remainder = number % unit.value;
      const majorWords = `${numberToIndianWords(major)} ${unit.label}`;
      return remainder ? `${majorWords} ${numberToIndianWords(remainder)}` : majorWords;
    }
  }
  return '';
}

function amountToIndianCurrencyWords(value) {
  const safeAmount = clamp2(Math.max(0, parseNumber(value, 0)));
  const totalPaise = Math.round(safeAmount * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;
  const rupeeWords = rupees === 0 ? 'zero rupees' : `${numberToIndianWords(rupees)} rupees`;
  const paiseWords = paise > 0 ? ` and ${numberToIndianWords(paise)} paise` : '';
  return `${(rupeeWords + paiseWords + ' only').replace(/\s+/g, ' ').trim()}`.replace(/\b[a-z]/g, match =>
    match.toUpperCase(),
  );
}

function allocateDiscountAcrossAmounts(amounts, totalDiscount) {
  const safeAmounts = (Array.isArray(amounts) ? amounts : []).map(amount => clamp2(Math.max(0, parseNumber(amount, 0))));
  const subtotal = clamp2(safeAmounts.reduce((sum, amount) => sum + amount, 0));
  const discount = clamp2(Math.min(Math.max(0, parseNumber(totalDiscount, 0)), subtotal));
  let allocated = 0;
  return safeAmounts.map((amount, index) => {
    if (index === safeAmounts.length - 1) {
      return clamp2(Math.min(amount, discount - allocated));
    }
    const rawShare = subtotal > 0 ? clamp2((discount * amount) / subtotal) : 0;
    const share = clamp2(Math.min(amount, Math.max(0, rawShare), discount - allocated));
    allocated = clamp2(allocated + share);
    return share;
  });
}

function shouldSplitGstToCgstSgst({ sellerState, placeOfSupplyState, shipToAddress }) {
  const sellerKey = normalizeStateKey(sellerState);
  const placeKey = normalizeStateKey(placeOfSupplyState);
  if (sellerKey && placeKey) {
    return sellerKey === placeKey;
  }
  const shipping = compactText(shipToAddress).toLowerCase();
  return Boolean(sellerState && shipping && shipping.includes(compactText(sellerState).toLowerCase()));
}

function decorateInvoiceLine(line) {
  const unitPrice = clamp2(Math.max(0, parseNumber(line.unitPrice, 0)));
  const qty = Math.max(0, parseNumber(line.qty, 0));
  const grossAmount = clamp2(parseNumber(line.grossAmount, parseNumber(line.lineTotal, unitPrice * qty)));
  const discountAmount = clamp2(Math.max(0, parseNumber(line.discountAmount, 0)));
  const lineTotal = clamp2(Math.max(0, parseNumber(line.netAmount, grossAmount - discountAmount)));
  const taxRate = clamp2(Math.max(0, parseNumber(line.taxRate, 0)));
  const taxableValue = clamp2(
    parseNumber(line.taxableValue, taxRate > 0 ? (lineTotal * 100) / (100 + taxRate) : lineTotal),
  );
  const gstAmount = clamp2(Math.max(0, parseNumber(line.gstAmount, lineTotal - taxableValue)));
  const cgstAmount = clamp2(Math.max(0, parseNumber(line.cgstAmount, 0)));
  const sgstAmount = clamp2(Math.max(0, parseNumber(line.sgstAmount, 0)));
  const igstAmount = clamp2(Math.max(0, parseNumber(line.igstAmount, 0)));

  return {
    id: compactText(line.id),
    itemId: compactText(line.itemId),
    itemName: compactText(line.itemName) || 'Item',
    description: compactText(line.description) || compactText(line.itemName) || 'Item',
    sku: compactText(line.sku),
    unit: compactText(line.unit) || 'pcs',
    hsnCode: compactText(line.hsnCode),
    qty,
    unitPrice,
    taxRate,
    grossAmount,
    discountAmount,
    netAmount: lineTotal,
    lineTotal,
    taxableValue,
    gstAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
  };
}

function decorateInvoiceDocument(invoice, sellerProfile = null) {
  const seller = normalizeInvoiceSellerProfile({
    ...(sellerProfile || {}),
    ...(invoice || {}),
  });
  const lines = (Array.isArray(invoice.lines) ? invoice.lines : []).map(decorateInvoiceLine);
  const subtotal = clamp2(
    parseNumber(
      invoice.subtotal,
      lines.reduce((sum, line) => sum + line.grossAmount, 0),
    ),
  );
  const discount = clamp2(
    parseNumber(
      invoice.discount,
      lines.reduce((sum, line) => sum + line.discountAmount, 0),
    ),
  );
  const deliveryFee = clamp2(Math.max(0, parseNumber(invoice.deliveryFee, 0)));
  const taxableTotal = clamp2(
    parseNumber(
      invoice.taxableTotal,
      lines.reduce((sum, line) => sum + line.taxableValue, 0),
    ),
  );
  const gstTotal = clamp2(
    parseNumber(
      invoice.gstTotal,
      lines.reduce((sum, line) => sum + line.gstAmount, 0),
    ),
  );
  const cgstTotal = clamp2(
    parseNumber(
      invoice.cgstTotal,
      lines.reduce((sum, line) => sum + line.cgstAmount, 0),
    ),
  );
  const sgstTotal = clamp2(
    parseNumber(
      invoice.sgstTotal,
      lines.reduce((sum, line) => sum + line.sgstAmount, 0),
    ),
  );
  const igstTotal = clamp2(
    parseNumber(
      invoice.igstTotal,
      lines.reduce((sum, line) => sum + line.igstAmount, 0),
    ),
  );
  const total = clamp2(parseNumber(invoice.total, subtotal - discount + deliveryFee));
  const roundOff = clamp2(parseNumber(invoice.roundOff, total - (subtotal - discount + deliveryFee)));

  return {
    id: compactText(invoice.id),
    orderId: compactText(invoice.orderId),
    orderNumber: compactText(invoice.orderNumber),
    invoiceNumber: compactText(invoice.invoiceNumber),
    customerId: compactText(invoice.customerId),
    customerName: compactText(invoice.customerName) || compactText(invoice.billToName) || 'Customer',
    status: compactText(invoice.status) || 'Open',
    dueDate: compactText(invoice.dueDate),
    total,
    createdAt: invoice.createdAt || new Date().toISOString(),
    paidAt: compactText(invoice.paidAt),
    subtotal,
    discount,
    deliveryFee,
    taxableTotal,
    gstTotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    roundOff,
    billToName: compactText(invoice.billToName) || compactText(invoice.customerName) || 'Customer',
    billToPhone: compactText(invoice.billToPhone),
    billToEmail: compactText(invoice.billToEmail),
    billToGstin: compactText(invoice.billToGstin),
    billToAddress: compactText(invoice.billToAddress),
    shipToAddress: compactText(invoice.shipToAddress) || compactText(invoice.billToAddress),
    placeOfSupply: compactText(invoice.placeOfSupply) || compactText(invoice.shipToAddress) || seller.sellerState,
    pricesIncludeGst: true,
    amountInWords: amountToIndianCurrencyWords(total),
    ...seller,
    lines,
  };
}

function buildInvoiceDocument({
  id,
  invoiceNumber,
  orderId = '',
  orderNumber = '',
  customerId,
  customerName,
  status = 'Open',
  dueDate = '',
  createdAt = new Date().toISOString(),
  paidAt = '',
  subtotal = 0,
  discount = 0,
  deliveryFee = 0,
  billToName,
  billToPhone,
  billToEmail,
  billToGstin,
  billToAddress,
  shipToAddress,
  placeOfSupply,
  placeOfSupplyState = '',
  lines = [],
  sellerProfile = null,
}) {
  const seller = normalizeInvoiceSellerProfile(sellerProfile);
  const preparedLines = Array.isArray(lines) ? lines : [];
  const grossSubtotal = clamp2(
    preparedLines.reduce((sum, line) => sum + clamp2(Math.max(0, parseNumber(line.unitPrice, 0)) * Math.max(0, parseNumber(line.qty, 0))), 0),
  );
  const safeSubtotal = clamp2(Math.max(0, parseNumber(subtotal, grossSubtotal)));
  const safeDiscount = clamp2(Math.min(Math.max(0, parseNumber(discount, 0)), safeSubtotal));
  const safeDeliveryFee = clamp2(Math.max(0, parseNumber(deliveryFee, 0)));
  const lineDiscounts = allocateDiscountAcrossAmounts(
    preparedLines.map(line => clamp2(Math.max(0, parseNumber(line.unitPrice, 0)) * Math.max(0, parseNumber(line.qty, 0)))),
    safeDiscount,
  );
  const intraState = shouldSplitGstToCgstSgst({
    sellerState: seller.sellerState,
    placeOfSupplyState,
    shipToAddress,
  });

  const computedLines = preparedLines.map((line, index) => {
    const qty = Math.max(0, parseNumber(line.qty, 0));
    const unitPrice = clamp2(Math.max(0, parseNumber(line.unitPrice, 0)));
    const grossAmount = clamp2(unitPrice * qty);
    const discountAmount = clamp2(lineDiscounts[index] || 0);
    const netAmount = clamp2(Math.max(0, grossAmount - discountAmount));
    const taxRate = clamp2(Math.max(0, parseNumber(line.taxRate, 0)));
    const taxableValue = clamp2(taxRate > 0 ? (netAmount * 100) / (100 + taxRate) : netAmount);
    const gstAmount = clamp2(Math.max(0, netAmount - taxableValue));
    const cgstAmount = taxRate > 0 && intraState ? clamp2(gstAmount / 2) : 0;
    const sgstAmount = taxRate > 0 && intraState ? clamp2(gstAmount - cgstAmount) : 0;
    const igstAmount = taxRate > 0 && !intraState ? gstAmount : 0;
    return decorateInvoiceLine({
      id: compactText(line.id) || `il_${crypto.randomUUID().slice(0, 8)}`,
      itemId: compactText(line.itemId),
      itemName: compactText(line.itemName),
      description:
        compactText(line.description) ||
        joinNonEmpty([line.itemName, line.model, line.capacity], ' • ') ||
        compactText(line.itemName),
      sku: compactText(line.sku),
      unit: compactText(line.unit) || 'pcs',
      hsnCode: compactText(line.hsnCode),
      qty,
      unitPrice,
      taxRate,
      grossAmount,
      discountAmount,
      netAmount,
      taxableValue,
      gstAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
    });
  });

  const decorated = decorateInvoiceDocument({
    id,
    orderId,
    orderNumber,
    invoiceNumber,
    customerId,
    customerName,
    status,
    dueDate,
    total: clamp2(safeSubtotal - safeDiscount + safeDeliveryFee),
    createdAt,
    paidAt,
    subtotal: safeSubtotal,
    discount: safeDiscount,
    deliveryFee: safeDeliveryFee,
    taxableTotal: computedLines.reduce((sum, line) => sum + line.taxableValue, 0),
    gstTotal: computedLines.reduce((sum, line) => sum + line.gstAmount, 0),
    cgstTotal: computedLines.reduce((sum, line) => sum + line.cgstAmount, 0),
    sgstTotal: computedLines.reduce((sum, line) => sum + line.sgstAmount, 0),
    igstTotal: computedLines.reduce((sum, line) => sum + line.igstAmount, 0),
    roundOff: 0,
    billToName,
    billToPhone,
    billToEmail,
    billToGstin,
    billToAddress,
    shipToAddress,
    placeOfSupply,
    lines: computedLines,
  }, seller);

  return {
    ...decorated,
    customerId,
    customerName: compactText(customerName) || compactText(billToName) || 'Customer',
  };
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

function isPasswordHash(value) {
  return String(value || '').startsWith(`${PASSWORD_HASH_ALGORITHM}$`);
}

function scryptAsync(password, salt, keylen, options) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

function parsePasswordHash(value) {
  const raw = String(value || '').trim();
  const parts = raw.split('$');
  if (parts.length !== 6) {
    return null;
  }
  const [algorithm, n, r, p, salt, hash] = parts;
  if (algorithm !== PASSWORD_HASH_ALGORITHM || !salt || !hash) {
    return null;
  }
  const N = parseNumber(n, 0);
  const R = parseNumber(r, 0);
  const P = parseNumber(p, 0);
  if (!Number.isInteger(N) || !Number.isInteger(R) || !Number.isInteger(P) || N <= 0 || R <= 0 || P <= 0) {
    return null;
  }
  return {
    N,
    r: R,
    p: P,
    salt,
    hash,
  };
}

async function hashPassword(password) {
  const raw = String(password || '');
  const salt = crypto.randomBytes(PASSWORD_HASH_SALT_BYTES).toString('hex');
  const derivedKey = await scryptAsync(raw, salt, PASSWORD_HASH_KEYLEN, PASSWORD_HASH_OPTIONS);
  return [
    PASSWORD_HASH_ALGORITHM,
    PASSWORD_HASH_OPTIONS.N,
    PASSWORD_HASH_OPTIONS.r,
    PASSWORD_HASH_OPTIONS.p,
    salt,
    derivedKey.toString('hex'),
  ].join('$');
}

async function ensurePasswordHash(password) {
  const raw = String(password || '').trim();
  if (!raw) {
    return '';
  }
  if (isPasswordHash(raw)) {
    return raw;
  }
  return hashPassword(raw);
}

async function verifyPassword(password, storedValue) {
  const rawPassword = String(password || '');
  const stored = String(storedValue || '').trim();
  const parsed = parsePasswordHash(stored);
  if (!parsed) {
    return rawPassword === stored;
  }
  const derivedKey = await scryptAsync(rawPassword, parsed.salt, PASSWORD_HASH_KEYLEN, {
    N: parsed.N,
    r: parsed.r,
    p: parsed.p,
    maxmem: PASSWORD_HASH_OPTIONS.maxmem,
  });
  const storedHash = Buffer.from(parsed.hash, 'hex');
  if (storedHash.length !== derivedKey.length) {
    return false;
  }
  return crypto.timingSafeEqual(storedHash, derivedKey);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getClientIp(req) {
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  if (forwarded) {
    return forwarded;
  }
  return String(req?.socket?.remoteAddress || '').trim() || 'unknown';
}

function getAuthBaseUrl(req) {
  const configured = String(AUTH_PUBLIC_BASE_URL || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  return getRequestBaseUrl(req);
}

function getPasswordResetExpiryDate() {
  return new Date(Date.now() + AUTH_RESET_TOKEN_TTL_MS);
}

function cleanupPasswordResetThrottle() {
  const now = Date.now();
  for (const [key, expiresAt] of passwordResetRequestLimiter.entries()) {
    if (expiresAt <= now) {
      passwordResetRequestLimiter.delete(key);
    }
  }
}

function enforcePasswordResetThrottle(req, username) {
  cleanupPasswordResetThrottle();
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const key = `${getClientIp(req)}|${normalizedUsername}`;
  const now = Date.now();
  const expiresAt = passwordResetRequestLimiter.get(key) || 0;
  if (expiresAt > now) {
    throw createHttpError(429, 'Please wait before requesting another reset email.');
  }
  passwordResetRequestLimiter.set(key, now + AUTH_RESET_REQUEST_COOLDOWN_MS);
}

function isMailConfigured() {
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_FROM);
}

function getMailTransport() {
  if (!nodemailer) {
    throw new Error('nodemailer is not installed');
  }
  if (!isMailConfigured()) {
    throw new Error('SMTP is not configured');
  }
  if (mailTransport) {
    return mailTransport;
  }
  const transportConfig = {
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
  };
  if (SMTP_USER) {
    transportConfig.auth = {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    };
  }
  mailTransport = nodemailer.createTransport(transportConfig);
  return mailTransport;
}

async function sendMail(message) {
  const transport = getMailTransport();
  await transport.sendMail(message);
}

function buildPasswordResetEmail({ name, resetUrl, expiresAt }) {
  const expiryMinutes = Math.max(1, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000));
  const safeName = escapeHtml(name || 'there');
  const safeAppName = escapeHtml(APP_NAME);
  const safeUrl = escapeHtml(resetUrl);
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e5e7eb;">
      <p style="margin:0 0 12px;font-size:14px;color:#6b7280;">${safeAppName}</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;">Reset your password</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hi ${safeName},</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">We received a request to reset your password. Use the button below to choose a new password. This link expires in about ${expiryMinutes} minutes.</p>
      <p style="margin:0 0 24px;">
        <a href="${safeUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;">Reset Password</a>
      </p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#374151;">If the button does not work, open this link:</p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;word-break:break-all;"><a href="${safeUrl}" style="color:#2563eb;">${safeUrl}</a></p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">If you did not request this, you can ignore this email.</p>
    </div>
  </body>
</html>`;
  const text = [
    `${APP_NAME}`,
    '',
    `Hi ${name || 'there'},`,
    '',
    'We received a request to reset your password.',
    `Open this link to set a new password: ${resetUrl}`,
    '',
    `This link expires at ${new Date(expiresAt).toISOString()}.`,
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n');
  return {
    subject: `${APP_NAME} password reset`,
    text,
    html,
  };
}

async function createPasswordResetToken(userId) {
  await ensureDb();
  const rawToken = crypto.randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = getPasswordResetExpiryDate();
  await mysqlPool.query(
    `DELETE FROM password_reset_tokens
     WHERE user_id = ?
        OR used_at IS NOT NULL
        OR expires_at <= CURRENT_TIMESTAMP`,
    [userId],
  );
  await mysqlPool.query(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at)
     VALUES (?, ?, ?, ?, NULL)`,
    [`prt_${crypto.randomUUID().slice(0, 8)}`, userId, tokenHash, expiresAt],
  );
  return {
    token: rawToken,
    expiresAt,
  };
}

async function revokeUserSessions(userId) {
  if (!userId) {
    return;
  }
  sessions.forEach((session, token) => {
    if (session && session.userId === userId) {
      sessions.delete(token);
    }
  });
  await mysqlPool.query(
    `UPDATE user_sessions
     SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
     WHERE user_id = ?
       AND revoked_at IS NULL`,
    [userId],
  );
}

function renderResetPasswordPage(token, errorMessage = '') {
  const safeToken = escapeHtml(token);
  const safeError = escapeHtml(errorMessage);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(APP_NAME)} Password Reset</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: linear-gradient(180deg, #111827 0%, #1f2937 100%); color: #111827; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; }
      .card { width: 100%; max-width: 420px; background: #fff; border-radius: 18px; padding: 28px; box-shadow: 0 30px 60px rgba(0,0,0,.25); }
      h1 { margin: 0 0 10px; font-size: 28px; }
      p { margin: 0 0 16px; color: #4b5563; line-height: 1.6; }
      label { display: block; margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #111827; }
      input { width: 100%; box-sizing: border-box; padding: 12px 14px; border: 1px solid #d1d5db; border-radius: 12px; font-size: 15px; margin-bottom: 14px; }
      button { width: 100%; border: 0; border-radius: 12px; padding: 12px 16px; background: #111827; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; }
      button:disabled { opacity: .65; cursor: wait; }
      .message { margin-top: 14px; font-size: 14px; line-height: 1.5; }
      .error { color: #b91c1c; }
      .success { color: #047857; }
    </style>
  </head>
  <body>
    <div class="card">
      <p>${escapeHtml(APP_NAME)}</p>
      <h1>Set a new password</h1>
      <p>Enter your new password below. This reset link can only be used once.</p>
      <form id="reset-form">
        <input type="hidden" name="token" value="${safeToken}" />
        <label for="password">New password</label>
        <input id="password" name="password" type="password" minlength="6" autocomplete="new-password" required />
        <label for="confirmPassword">Confirm password</label>
        <input id="confirmPassword" name="confirmPassword" type="password" minlength="6" autocomplete="new-password" required />
        <button id="submit-btn" type="submit">Reset Password</button>
      </form>
      <div id="message" class="message ${safeError ? 'error' : ''}">${safeError}</div>
    </div>
    <script>
      const form = document.getElementById('reset-form');
      const messageEl = document.getElementById('message');
      const submitBtn = document.getElementById('submit-btn');
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(form);
        const password = String(formData.get('password') || '');
        const confirmPassword = String(formData.get('confirmPassword') || '');
        const token = String(formData.get('token') || '');
        if (password.length < 6) {
          messageEl.className = 'message error';
          messageEl.textContent = 'Password must be at least 6 characters.';
          return;
        }
        if (password !== confirmPassword) {
          messageEl.className = 'message error';
          messageEl.textContent = 'Passwords do not match.';
          return;
        }
        submitBtn.disabled = true;
        messageEl.className = 'message';
        messageEl.textContent = 'Saving...';
        try {
          const response = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password, confirmPassword }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload.error || 'Unable to reset password.');
          }
          form.reset();
          submitBtn.disabled = true;
          messageEl.className = 'message success';
          messageEl.textContent = payload.message || 'Password updated. You can return to the app and sign in.';
        } catch (error) {
          submitBtn.disabled = false;
          messageEl.className = 'message error';
          messageEl.textContent = error instanceof Error ? error.message : 'Unable to reset password.';
        }
      });
    </script>
  </body>
</html>`;
}

function getDefaultAppUpdateManifest() {
  return {
    android: {
      appId: 'com.mobile',
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
}

function normalizeAppUpdateEntry(entry, fallbackVersion = '1.0.0') {
  const fallback = String(fallbackVersion || '1.0.0').trim() || '1.0.0';
  const latestVersion = String(entry?.latestVersion || fallback).trim() || fallback;
  const minimumSupportedVersion = String(entry?.minimumSupportedVersion || latestVersion).trim() || latestVersion;
  return {
    appId: String(entry?.appId || '').trim(),
    channel: String(entry?.channel || 'production').trim().toLowerCase() || 'production',
    latestVersion,
    minimumSupportedVersion,
    mandatory: Boolean(entry?.mandatory),
    downloadUrl: String(entry?.downloadUrl || '').trim(),
    releaseNotes: String(entry?.releaseNotes || '').trim(),
    publishedAt: String(entry?.publishedAt || '').trim(),
    checksumSha256: String(entry?.checksumSha256 || '').trim().toLowerCase(),
    fileSizeBytes: Math.max(0, parseNumber(entry?.fileSizeBytes, 0)),
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
const ITEM_CATEGORY_OPTIONS = ['Battery', 'Inverter', 'Miscellaneous'];
const ITEM_TECHNOLOGY_OPTIONS = [
  'Sinewave',
  'Eco Watt',
  'Advanced Digital',
  'Tall Tubular',
  'Jumboz Tubular',
  'Jumboz Short Tubular',
  'Super Jumboz Tubular',
];
const ITEM_TAGS = ['bestseller', 'premium'];

function normalizeCapacityAh(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '150Ah';
  }
  const preset = AH_OPTIONS.find(option => option.toLowerCase() === raw.toLowerCase());
  if (preset) {
    return preset;
  }
  const compact = raw.replace(/\s+/g, '');
  const numericMatch = compact.match(/^(\d{2,4})(?:ah)?$/i);
  if (numericMatch?.[1]) {
    return `${numericMatch[1]}Ah`;
  }
  return raw.slice(0, 20);
}

function compareCapacityAh(a, b) {
  const aText = String(a || '').trim();
  const bText = String(b || '').trim();
  const aNum = parseInt(aText, 10);
  const bNum = parseInt(bText, 10);
  if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
    return aNum - bNum;
  }
  return aText.localeCompare(bText);
}

function normalizeTechnologyOption(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  const normalized = raw.toLowerCase();
  if (normalized === 'sinewave' || normalized === 'sine wave' || normalized === 'pure sine wave') {
    return 'Sinewave';
  }
  if (normalized === 'eco watt' || normalized === 'ecowatt') {
    return 'Eco Watt';
  }
  if (
    normalized === 'advanced digital' ||
    normalized === 'advanced-digital' ||
    normalized === 'advanceddigital'
  ) {
    return 'Advanced Digital';
  }
  if (normalized === 'tall tubular' || normalized === 'tall-tubular' || normalized === 'talltubular') {
    return 'Tall Tubular';
  }
  if (normalized === 'jumboz tubular' || normalized === 'jumboz-tubular' || normalized === 'jumboztubular') {
    return 'Jumboz Tubular';
  }
  if (
    normalized === 'jumboz short tubular' ||
    normalized === 'jumboz-short-tubular' ||
    normalized === 'jumbozshorttubular'
  ) {
    return 'Jumboz Short Tubular';
  }
  if (
    normalized === 'super jumboz tubular' ||
    normalized === 'super-jumboz-tubular' ||
    normalized === 'superjumboztubular'
  ) {
    return 'Super Jumboz Tubular';
  }
  return ITEM_TECHNOLOGY_OPTIONS.includes(raw) ? raw : '';
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
    return 'Miscellaneous';
  }
  const normalized = category.toLowerCase();
  if (normalized === 'general' || normalized === 'misc' || normalized === 'miscellaneous') {
    return 'Miscellaneous';
  }
  if (normalized.includes('battery')) {
    return 'Battery';
  }
  if (normalized.includes('inverter') || normalized.includes('power backup') || normalized.includes('ups')) {
    return 'Inverter';
  }
  if (normalized.includes('accessor')) {
    return 'Miscellaneous';
  }
  return ITEM_CATEGORY_OPTIONS.includes(category) ? category : 'Miscellaneous';
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
    technologyOption: normalizeTechnologyOption(item.technologyOption || item.technology_option),
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

async function reserveDocumentNumber(conn, counterKey, prefix) {
  const key = compactText(counterKey).toUpperCase();
  const [rows] = await conn.query(
    `SELECT next_value
     FROM document_counters
     WHERE counter_key = ?
     FOR UPDATE`,
    [key],
  );
  let nextValue = parseNumber(Array.isArray(rows) && rows[0] ? rows[0].next_value : 0, 0);
  if (!nextValue) {
    nextValue = 1;
    await conn.query(
      `INSERT INTO document_counters (counter_key, next_value)
       VALUES (?, 2)
       ON DUPLICATE KEY UPDATE next_value = next_value`,
      [key],
    );
  } else {
    await conn.query(
      `UPDATE document_counters
       SET next_value = ?
       WHERE counter_key = ?`,
      [nextValue + 1, key],
    );
  }
  return `${compactText(prefix) || key}-${String(nextValue).padStart(4, '0')}`;
}

async function ensureStorefrontCustomer(conn, owner, checkoutProfile) {
  let userProfile = null;
  if (owner?.userId) {
    const [userRows] = await conn.query(
      `SELECT full_name, username, phone
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [owner.userId],
    );
    userProfile = Array.isArray(userRows) ? userRows[0] || null : null;
  }

  const firstName = compactText(checkoutProfile.firstName);
  const lastName = compactText(checkoutProfile.lastName);
  const fullName = joinNonEmpty(
    [firstName, lastName],
    ' ',
  ) || compactText(userProfile?.full_name) || 'Guest Customer';
  const email = compactText(checkoutProfile.email) || compactText(userProfile?.username);
  const phone = compactText(checkoutProfile.phone) || compactText(userProfile?.phone);
  const billingAddress = compactText(checkoutProfile.billingAddress);
  const shippingAddress = compactText(checkoutProfile.shippingAddress) || billingAddress;

  let existing = null;
  if (email) {
    const [rows] = await conn.query(
      `SELECT id, name, company, email, phone, gstin, billing_address, shipping_address
       FROM customers
       WHERE LOWER(TRIM(COALESCE(email, ''))) = LOWER(?)
       ORDER BY updated_at DESC
       LIMIT 1`,
      [email],
    );
    existing = Array.isArray(rows) ? rows[0] || null : null;
  }
  if (!existing && phone) {
    const [rows] = await conn.query(
      `SELECT id, name, company, email, phone, gstin, billing_address, shipping_address
       FROM customers
       WHERE TRIM(COALESCE(phone, '')) = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
      [phone],
    );
    existing = Array.isArray(rows) ? rows[0] || null : null;
  }

  const customerId = compactText(existing?.id) || `cus_${crypto.randomUUID().slice(0, 8)}`;
  const customer = {
    id: customerId,
    name: fullName || compactText(existing?.name) || 'Customer',
    company: compactText(existing?.company),
    email: email || compactText(existing?.email),
    phone: phone || compactText(existing?.phone),
    gstin: compactText(existing?.gstin),
    billingAddress: billingAddress || compactText(existing?.billing_address),
    shippingAddress: shippingAddress || compactText(existing?.shipping_address) || billingAddress,
  };

  await conn.query(
    `INSERT INTO customers
      (id, name, company, email, phone, gstin, billing_address, shipping_address, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       company = VALUES(company),
       email = VALUES(email),
       phone = VALUES(phone),
       gstin = COALESCE(NULLIF(VALUES(gstin), ''), gstin),
       billing_address = COALESCE(NULLIF(VALUES(billing_address), ''), billing_address),
       shipping_address = COALESCE(NULLIF(VALUES(shipping_address), ''), shipping_address),
       is_active = 1`,
    [
      customer.id,
      customer.name,
      customer.company || null,
      customer.email || null,
      customer.phone || null,
      customer.gstin || null,
      customer.billingAddress || null,
      customer.shippingAddress || null,
    ],
  );

  return customer;
}

function createInvoiceDownloadSignature(orderId, owner) {
  const ownerKind = owner?.userId ? 'user' : 'guest';
  const ownerValue = compactText(owner?.userId || owner?.guestId);
  const expiresAt = Date.now() + INVOICE_DOWNLOAD_LINK_TTL_MS;
  const payload = `${compactText(orderId)}|${ownerKind}|${ownerValue}|${expiresAt}`;
  const signature = crypto.createHmac('sha256', INVOICE_DOWNLOAD_SECRET).update(payload).digest('hex');
  return { ownerKind, ownerValue, expiresAt, signature };
}

function verifyInvoiceDownloadSignature({ orderId, ownerKind, ownerValue, expiresAt, signature }) {
  const safeKind = compactText(ownerKind);
  const safeOwner = compactText(ownerValue);
  const safeSignature = compactText(signature);
  const safeExpiresAt = parseNumber(expiresAt, 0);
  if (!compactText(orderId) || !safeOwner || !safeSignature || !['user', 'guest'].includes(safeKind)) {
    return false;
  }
  if (!Number.isFinite(safeExpiresAt) || safeExpiresAt < Date.now()) {
    return false;
  }
  if (safeExpiresAt - Date.now() > INVOICE_DOWNLOAD_LINK_TTL_MS + 60 * 1000) {
    return false;
  }
  const payload = `${compactText(orderId)}|${safeKind}|${safeOwner}|${safeExpiresAt}`;
  const expected = crypto.createHmac('sha256', INVOICE_DOWNLOAD_SECRET).update(payload).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(safeSignature, 'hex');
  if (expectedBuffer.length === 0 || actualBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

async function getInvoiceDownloadOwner(req, searchParams, orderId) {
  const authOwner = await getStorefrontOwner(req, searchParams, null);
  if (authOwner) {
    return authOwner;
  }
  const ownerKind = compactText(searchParams.get('ownerKind'));
  const ownerValue = compactText(searchParams.get('ownerValue'));
  const expiresAt = parseNumber(searchParams.get('expires'), 0);
  const signature = compactText(searchParams.get('sig'));
  if (!verifyInvoiceDownloadSignature({ orderId, ownerKind, ownerValue, expiresAt, signature })) {
    return null;
  }
  return ownerKind === 'user'
    ? { userId: ownerValue, guestId: null }
    : { userId: null, guestId: ownerValue };
}

function renderStorefrontInvoiceHtml(order, invoice) {
  const safeOrder = order || {};
  const safeInvoice = invoice || {};
  const lines = Array.isArray(safeInvoice.lines) ? safeInvoice.lines : [];
  const escape = escapeHtml;
  const totals = [
    ['Gross Amount', safeInvoice.subtotal],
    ['Discount', safeInvoice.discount],
    ['Taxable Amount', safeInvoice.taxableTotal],
    ['Included GST', safeInvoice.gstTotal],
    [Number(safeInvoice.igstTotal || 0) > 0 ? 'IGST' : 'CGST', Number(safeInvoice.igstTotal || 0) > 0 ? safeInvoice.igstTotal : safeInvoice.cgstTotal],
    [Number(safeInvoice.igstTotal || 0) > 0 ? null : 'SGST', Number(safeInvoice.igstTotal || 0) > 0 ? null : safeInvoice.sgstTotal],
    ['Delivery', safeInvoice.deliveryFee],
  ]
    .filter(entry => entry[0])
    .map(([label, value]) => `<div class="row"><span>${escape(label)}</span><strong>${escape(formatCurrencyInrForHtml(value))}</strong></div>`)
    .join('');
  const lineMarkup = lines
    .map(
      line => `
        <tr>
          <td>${escape(line.itemName || 'Item')}<div class="sub">${escape(line.description || '')}</div></td>
          <td>${escape(line.hsnCode || '-')}</td>
          <td>${escape(String(line.qty || 0))}</td>
          <td>${escape(formatCurrencyInrForHtml(line.unitPrice || 0))}</td>
          <td>${escape(String(Number(line.taxRate || 0).toFixed(2)))}%</td>
          <td>${escape(formatCurrencyInrForHtml(line.taxableValue || 0))}</td>
          <td>${escape(formatCurrencyInrForHtml(line.gstAmount || 0))}</td>
          <td>${escape(formatCurrencyInrForHtml(line.lineTotal || 0))}</td>
        </tr>`,
    )
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escape(safeInvoice.invoiceNumber || safeOrder.orderNumber || 'Invoice')}</title>
  <style>
    body { margin: 0; padding: 24px; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background: #f3f4f6; color: #111827; }
    .sheet { max-width: 980px; margin: 0 auto; background: #fff; border-radius: 24px; padding: 28px; box-shadow: 0 18px 50px rgba(15,23,42,0.12); }
    .hero { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; margin-bottom:24px; }
    .eyebrow { color:#0f766e; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; }
    h1 { margin:8px 0 4px; font-size:32px; line-height:1.1; }
    .subhead { color:#475569; font-size:14px; font-weight:600; }
    .pill { display:inline-flex; align-items:center; padding:8px 14px; border-radius:999px; background:#dbeafe; color:#1d4ed8; font-weight:800; font-size:12px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; margin-bottom:18px; }
    .card { border:1px solid #e5e7eb; border-radius:18px; padding:16px; background:#fff; }
    .card h2 { margin:0 0 10px; font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:#64748b; }
    .card strong { display:block; font-size:16px; margin-bottom:6px; }
    .card p { margin:4px 0; color:#475569; font-size:13px; line-height:1.5; }
    table { width:100%; border-collapse:collapse; margin-top:8px; }
    th, td { border-bottom:1px solid #e5e7eb; padding:12px 10px; text-align:left; vertical-align:top; font-size:13px; }
    th { color:#64748b; font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
    .sub { color:#64748b; font-size:12px; margin-top:4px; }
    .summary { margin-top:20px; display:grid; grid-template-columns:1.3fr .9fr; gap:16px; }
    .note { border-radius:18px; background:#e0f2fe; padding:16px; color:#0f172a; }
    .note h3 { margin:0 0 8px; font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:#0c4a6e; }
    .row { display:flex; justify-content:space-between; gap:14px; padding:8px 0; border-bottom:1px solid #eef2f7; font-size:14px; }
    .row:last-child { border-bottom:none; }
    .grand { font-size:18px; font-weight:900; }
    @media print { body { background:#fff; padding:0; } .sheet { box-shadow:none; border-radius:0; max-width:none; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="hero">
      <div>
        <div class="eyebrow">Order invoice</div>
        <h1>${escape(safeInvoice.invoiceNumber || safeOrder.orderNumber || 'Invoice')}</h1>
        <div class="subhead">${escape(safeOrder.orderNumber || '')} ${safeOrder.createdAt ? `• ${escape(String(safeOrder.createdAt))}` : ''}</div>
      </div>
      <div class="pill">${escape(safeInvoice.status || safeOrder.status || 'Open')}</div>
    </div>

    <div class="grid">
      <div class="card">
        <h2>Seller</h2>
        <strong>${escape(safeInvoice.sellerName || 'Seller')}</strong>
        <p>${escape(safeInvoice.sellerAddress || '-')}</p>
        <p>GSTIN: ${escape(safeInvoice.sellerGstin || 'Not configured')}</p>
      </div>
      <div class="card">
        <h2>Bill To</h2>
        <strong>${escape(safeInvoice.billToName || safeInvoice.customerName || 'Customer')}</strong>
        <p>${escape(safeInvoice.billToAddress || '-')}</p>
        <p>${escape(safeInvoice.billToPhone || '')}</p>
        <p>GSTIN: ${escape(safeInvoice.billToGstin || 'Unregistered')}</p>
      </div>
      <div class="card">
        <h2>Supply</h2>
        <strong>${escape(safeInvoice.placeOfSupply || safeInvoice.sellerState || 'India')}</strong>
        <p>Ship to: ${escape(safeInvoice.shipToAddress || safeInvoice.billToAddress || '-')}</p>
        <p>Prices are GST inclusive.</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>HSN</th>
          <th>Qty</th>
          <th>Rate</th>
          <th>GST</th>
          <th>Taxable</th>
          <th>GST Included</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>${lineMarkup}</tbody>
    </table>

    <div class="summary">
      <div class="note">
        <h3>Amount in Words</h3>
        <div>${escape(safeInvoice.amountInWords || '')}</div>
        <p style="margin-top:12px;">This invoice shows GST already included in the line and payable amounts.</p>
      </div>
      <div class="card">
        <h2>Payment Summary</h2>
        ${totals}
        <div class="row grand"><span>Total Amount</span><strong>${escape(formatCurrencyInrForHtml(safeInvoice.total || 0))}</strong></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function formatCurrencyInrForHtml(value) {
  return `Rs ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCurrencyInrForPdf(value) {
  return `INR ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapePdfText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, '')
    .replace(/\n/g, ' ');
}

function estimatePdfTextWidth(text, fontSize, fontKey = 'F1') {
  const factor = fontKey === 'F2' ? 0.56 : 0.52;
  return String(text || '').length * fontSize * factor;
}

function wrapPdfText(value, maxWidth, fontSize, fontKey = 'F1', maxLines = 0) {
  const rawLines = String(value || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const baseLines = rawLines.length > 0 ? rawLines : [''];
  const result = [];
  for (const rawLine of baseLines) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      result.push('');
      continue;
    }
    let current = words[0];
    for (let index = 1; index < words.length; index += 1) {
      const word = words[index];
      const candidate = `${current} ${word}`;
      if (estimatePdfTextWidth(candidate, fontSize, fontKey) <= maxWidth) {
        current = candidate;
      } else {
        result.push(current);
        current = word;
      }
    }
    result.push(current);
  }
  if (maxLines > 0 && result.length > maxLines) {
    const clipped = result.slice(0, maxLines);
    const lastLine = clipped[maxLines - 1] || '';
    clipped[maxLines - 1] = `${lastLine.replace(/\s+$/, '')}...`;
    return clipped;
  }
  return result;
}

function getInvoiceTaxBreakdown(invoice) {
  const safeInvoice = invoice || {};
  const lines = Array.isArray(safeInvoice.lines) ? safeInvoice.lines : [];
  const lineTaxableTotal = clamp2(lines.reduce((sum, line) => sum + parseNumber(line.taxableValue, 0), 0));
  const lineGstTotal = clamp2(lines.reduce((sum, line) => sum + parseNumber(line.gstAmount, 0), 0));
  const lineCgstTotal = clamp2(lines.reduce((sum, line) => sum + parseNumber(line.cgstAmount, 0), 0));
  const lineSgstTotal = clamp2(lines.reduce((sum, line) => sum + parseNumber(line.sgstAmount, 0), 0));
  const lineIgstTotal = clamp2(lines.reduce((sum, line) => sum + parseNumber(line.igstAmount, 0), 0));
  const deliveryFee = clamp2(parseNumber(safeInvoice.deliveryFee, 0));
  const taxableBase = clamp2(Math.max(0, parseNumber(safeInvoice.total, 0) - deliveryFee));
  const taxableTotal = clamp2(
    parseNumber(
      safeInvoice.taxableTotal,
      lineTaxableTotal > 0 ? lineTaxableTotal : Math.max(0, taxableBase - parseNumber(safeInvoice.gstTotal, 0)),
    ),
  );
  let gstTotal = clamp2(parseNumber(safeInvoice.gstTotal, lineGstTotal));
  if (gstTotal <= 0 && taxableBase > taxableTotal) {
    gstTotal = clamp2(taxableBase - taxableTotal);
  }
  const intraState = shouldSplitGstToCgstSgst({
    sellerState: safeInvoice.sellerState,
    placeOfSupplyState: safeInvoice.placeOfSupply,
    shipToAddress: safeInvoice.shipToAddress || safeInvoice.billToAddress,
  });
  let cgstTotal = clamp2(parseNumber(safeInvoice.cgstTotal, lineCgstTotal));
  let sgstTotal = clamp2(parseNumber(safeInvoice.sgstTotal, lineSgstTotal));
  let igstTotal = clamp2(parseNumber(safeInvoice.igstTotal, lineIgstTotal));
  if (gstTotal > 0 && cgstTotal <= 0 && sgstTotal <= 0 && igstTotal <= 0) {
    if (intraState) {
      cgstTotal = clamp2(gstTotal / 2);
      sgstTotal = clamp2(gstTotal - cgstTotal);
    } else {
      igstTotal = gstTotal;
    }
  }
  return {
    taxableTotal,
    gstTotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    intraState,
  };
}

function renderPdfDocument(pageStreams) {
  const safePageStreams = Array.isArray(pageStreams) ? pageStreams.filter(Boolean) : [];
  const pagesCount = safePageStreams.length || 1;
  const fontRegularId = 1;
  const fontBoldId = 2;
  const catalogId = 3;
  const pagesId = 4;
  const objects = [];
  objects[fontRegularId - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[fontBoldId - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;

  const pageObjectIds = [];
  const contentObjectIds = [];
  for (let index = 0; index < pagesCount; index += 1) {
    contentObjectIds.push(5 + index * 2);
    pageObjectIds.push(6 + index * 2);
  }
  objects[pagesId - 1] = `<< /Type /Pages /Count ${pagesCount} /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(' ')}] >>`;

  safePageStreams.forEach((stream, index) => {
    const contentId = contentObjectIds[index];
    const pageId = pageObjectIds[index];
    const contentBuffer = Buffer.from(String(stream || ''), 'binary');
    objects[contentId - 1] = `<< /Length ${contentBuffer.length} >>\nstream\n${contentBuffer.toString('binary')}\nendstream`;
    objects[pageId - 1] =
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> ` +
      `/Contents ${contentId} 0 R >>`;
  });

  let pdf = '%PDF-1.4\n%\xC7\xEC\x8F\xA2\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, 'binary'));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'binary');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
}

function renderStorefrontInvoicePdf(order, invoice) {
  const safeOrder = order || {};
  const safeInvoice = decorateInvoiceDocument(invoice);
  const taxBreakdown = getInvoiceTaxBreakdown(safeInvoice);
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 36;
  const marginTop = 34;
  const marginBottom = 42;
  const contentWidth = pageWidth - marginX * 2;
  const colors = {
    ink: [0.07, 0.11, 0.18],
    muted: [0.40, 0.47, 0.57],
    accent: [0.10, 0.36, 0.73],
    border: [0.84, 0.88, 0.94],
    soft: [0.95, 0.97, 0.99],
    success: [0.13, 0.46, 0.22],
  };
  const columns = [
    { key: 'item', label: 'Item Description', width: 180, align: 'left' },
    { key: 'hsn', label: 'HSN', width: 48, align: 'left' },
    { key: 'qty', label: 'Qty', width: 28, align: 'right' },
    { key: 'rate', label: 'Rate', width: 58, align: 'right' },
    { key: 'gstRate', label: 'GST%', width: 38, align: 'right' },
    { key: 'taxable', label: 'Taxable', width: 58, align: 'right' },
    { key: 'gst', label: 'GST', width: 48, align: 'right' },
    { key: 'total', label: 'Total', width: 62, align: 'right' },
  ];

  const pages = [];
  const resolveY = top => (pageHeight - top).toFixed(2);
  const resolveTextY = (top, size) => (pageHeight - top - size).toFixed(2);
  const colorCommand = color => color.map(value => Number(value).toFixed(3)).join(' ');
  const estimateRightX = (rightEdge, text, size, fontKey = 'F1') =>
    Math.max(marginX, rightEdge - estimatePdfTextWidth(text, size, fontKey));
  const buildText = (text, x, top, options = {}) => {
    const size = Number(options.size || 10);
    const font = options.font || 'F1';
    const color = options.color || colors.ink;
    return `BT /${font} ${size.toFixed(2)} Tf ${colorCommand(color)} rg 1 0 0 1 ${Number(x).toFixed(2)} ${resolveTextY(top, size)} Tm (${escapePdfText(text)}) Tj ET`;
  };
  const buildLine = (x1, top1, x2, top2, options = {}) => {
    const stroke = options.color || colors.border;
    const width = Number(options.width || 1);
    return `${colorCommand(stroke)} RG ${width.toFixed(2)} w ${Number(x1).toFixed(2)} ${resolveY(top1)} m ${Number(x2).toFixed(2)} ${resolveY(top2)} l S`;
  };
  const buildRect = (x, top, width, height, options = {}) => {
    const commands = [];
    if (options.fillColor) {
      commands.push(`${colorCommand(options.fillColor)} rg ${Number(x).toFixed(2)} ${(pageHeight - top - height).toFixed(2)} ${Number(width).toFixed(2)} ${Number(height).toFixed(2)} re f`);
    }
    if (options.strokeColor) {
      commands.push(`${colorCommand(options.strokeColor)} RG ${(Number(options.lineWidth || 1)).toFixed(2)} w ${Number(x).toFixed(2)} ${(pageHeight - top - height).toFixed(2)} ${Number(width).toFixed(2)} ${Number(height).toFixed(2)} re S`);
    }
    return commands.join('\n');
  };

  const sellerMetaLines = [];
  if (safeInvoice.sellerGstin) sellerMetaLines.push(`GSTIN: ${safeInvoice.sellerGstin}`);
  if (safeInvoice.sellerPan) sellerMetaLines.push(`PAN: ${safeInvoice.sellerPan}`);
  if (safeInvoice.sellerPhone) sellerMetaLines.push(`Phone: ${safeInvoice.sellerPhone}`);
  if (safeInvoice.sellerEmail) sellerMetaLines.push(`Email: ${safeInvoice.sellerEmail}`);
  if (safeInvoice.sellerWebsite) sellerMetaLines.push(`Website: ${safeInvoice.sellerWebsite}`);
  const sellerLines = [
    { text: safeInvoice.sellerName || 'Seller', font: 'F2', size: 12, color: colors.ink },
    ...wrapPdfText(safeInvoice.sellerAddress || '-', 146, 9, 'F1').map(text => ({
      text,
      font: 'F1',
      size: 9,
      color: colors.ink,
    })),
    ...sellerMetaLines.flatMap(text =>
      wrapPdfText(text, 146, 8.5, 'F1').map(line => ({ text: line, font: 'F1', size: 8.5, color: colors.muted })),
    ),
  ];
  const buyerMetaLines = [];
  if (safeInvoice.billToPhone) buyerMetaLines.push(safeInvoice.billToPhone);
  if (safeInvoice.billToEmail) buyerMetaLines.push(safeInvoice.billToEmail);
  if (safeInvoice.billToGstin) buyerMetaLines.push(`GSTIN: ${safeInvoice.billToGstin}`);
  const buyerLines = [
    { text: safeInvoice.billToName || safeInvoice.customerName || 'Customer', font: 'F2', size: 12, color: colors.ink },
    ...wrapPdfText(safeInvoice.billToAddress || safeInvoice.shipToAddress || '-', 146, 9, 'F1').map(text => ({
      text,
      font: 'F1',
      size: 9,
      color: colors.ink,
    })),
    ...buyerMetaLines.flatMap(text =>
      wrapPdfText(text, 146, 8.5, 'F1').map(line => ({ text: line, font: 'F1', size: 8.5, color: colors.muted })),
    ),
  ];
  const infoLines = [
    `Order Ref: ${safeOrder.orderNumber || safeInvoice.orderNumber || '-'}`,
    `Invoice Date: ${toYmd(safeInvoice.createdAt) || '-'}`,
    `Status: ${safeInvoice.status || safeOrder.status || 'Open'}`,
    `Place of Supply: ${safeInvoice.placeOfSupply || safeInvoice.sellerState || '-'}`,
    'Prices on this invoice are GST inclusive.',
  ].flatMap(text =>
    wrapPdfText(text, 146, 8.5, 'F1').map(line => ({ text: line, font: 'F1', size: 8.5, color: colors.ink })),
  );
  const infoCardLineCount = Math.max(sellerLines.length, buyerLines.length, infoLines.length);
  const infoCardHeight = Math.max(88, 28 + infoCardLineCount * 12);

  const amountWordsLines = wrapPdfText(safeInvoice.amountInWords || amountToIndianCurrencyWords(safeInvoice.total), 242, 9, 'F1', 4);
  const bankLines = [
    safeInvoice.bankAccountName ? `Account Name: ${safeInvoice.bankAccountName}` : '',
    safeInvoice.bankAccountNumber ? `Account No: ${safeInvoice.bankAccountNumber}` : '',
    safeInvoice.bankIfsc ? `IFSC: ${safeInvoice.bankIfsc}` : '',
    safeInvoice.bankBranch ? `Branch: ${safeInvoice.bankBranch}` : '',
  ].filter(Boolean);
  const noteLines = [
    ...(safeInvoice.declarationNote ? wrapPdfText(`Declaration: ${safeInvoice.declarationNote}`, 242, 8.5, 'F1', 5) : []),
    ...(safeInvoice.footerNote ? wrapPdfText(`Note: ${safeInvoice.footerNote}`, 242, 8.5, 'F1', 5) : []),
  ];
  const summaryRows = [
    { label: 'Gross Amount', value: formatCurrencyInrForPdf(safeInvoice.subtotal) },
    { label: 'Discount', value: formatCurrencyInrForPdf(safeInvoice.discount) },
    { label: 'Delivery', value: formatCurrencyInrForPdf(safeInvoice.deliveryFee) },
    { label: 'Taxable Amount', value: formatCurrencyInrForPdf(taxBreakdown.taxableTotal) },
    ...(taxBreakdown.intraState
      ? [
          { label: 'CGST @ 9% (included)', value: formatCurrencyInrForPdf(taxBreakdown.cgstTotal) },
          { label: 'SGST @ 9% (included)', value: formatCurrencyInrForPdf(taxBreakdown.sgstTotal) },
        ]
      : [{ label: 'IGST @ 18% (included)', value: formatCurrencyInrForPdf(taxBreakdown.igstTotal) }]),
    { label: 'Included GST Total', value: formatCurrencyInrForPdf(taxBreakdown.gstTotal) },
    { label: 'Total Amount', value: formatCurrencyInrForPdf(safeInvoice.total), bold: true },
  ];

  const drawBlock = (page, x, top, width, title, lines) => {
    const safeLines = Array.isArray(lines) ? lines : [];
    page.ops.push(buildRect(x, top, width, infoCardHeight, { strokeColor: colors.border, fillColor: [1, 1, 1] }));
    page.ops.push(buildText(title, x + 10, top + 10, { font: 'F2', size: 9, color: colors.accent }));
    let cursorTop = top + 28;
    safeLines.forEach((line, index) => {
      const font = line.font || 'F1';
      const size = line.size || 9;
      page.ops.push(buildText(line.text, x + 10, cursorTop, { font, size, color: line.color || colors.ink }));
      cursorTop += index === 0 ? 14 : 11;
    });
  };

  const drawTableHeader = page => {
    page.ops.push(buildRect(marginX, page.cursorTop, contentWidth, 22, { fillColor: colors.soft, strokeColor: colors.border }));
    let cursorX = marginX + 6;
    columns.forEach(column => {
      const labelX =
        column.align === 'right'
          ? estimateRightX(cursorX + column.width - 6, column.label, 8, 'F2')
          : cursorX;
      page.ops.push(buildText(column.label, labelX, page.cursorTop + 7, { font: 'F2', size: 8, color: colors.muted }));
      cursorX += column.width;
    });
    page.cursorTop += 24;
  };

  const startPage = isFirstPage => {
    const page = {
      ops: [],
      cursorTop: marginTop,
    };
    const rightEdge = pageWidth - marginX;
    page.ops.push(buildText('Tax Invoice', marginX, 18, { font: 'F2', size: 22, color: colors.ink }));
    page.ops.push(buildText(safeInvoice.invoiceNumber || safeOrder.orderNumber || 'Invoice', marginX, 44, { font: 'F2', size: 15, color: colors.accent }));
    page.ops.push(
      buildText(
        `Status: ${safeInvoice.status || safeOrder.status || 'Open'}`,
        estimateRightX(rightEdge, `Status: ${safeInvoice.status || safeOrder.status || 'Open'}`, 10, 'F2'),
        20,
        { font: 'F2', size: 10, color: colors.success },
      ),
    );
    page.ops.push(
      buildText(
        `Order ID: ${safeOrder.orderNumber || safeInvoice.orderNumber || '-'}`,
        estimateRightX(rightEdge, `Order ID: ${safeOrder.orderNumber || safeInvoice.orderNumber || '-'}`, 9, 'F1'),
        38,
        { font: 'F1', size: 9, color: colors.muted },
      ),
    );
    page.ops.push(
      buildText(
        `Date: ${toYmd(safeInvoice.createdAt) || '-'}`,
        estimateRightX(rightEdge, `Date: ${toYmd(safeInvoice.createdAt) || '-'}`, 9, 'F1'),
        52,
        { font: 'F1', size: 9, color: colors.muted },
      ),
    );
    page.ops.push(buildLine(marginX, 66, pageWidth - marginX, 66, { color: colors.border, width: 1 }));
    page.cursorTop = 78;
    if (isFirstPage) {
      drawBlock(page, marginX, page.cursorTop, 160, 'Seller', sellerLines);
      drawBlock(page, marginX + 170, page.cursorTop, 160, 'Bill To', buyerLines);
      drawBlock(page, marginX + 340, page.cursorTop, 183, 'Invoice Info', infoLines);
      page.cursorTop += infoCardHeight + 20;
    }
    drawTableHeader(page);
    pages.push(page);
    return page;
  };

  let page = startPage(true);
  const itemRightEdges = [];
  let runningX = marginX;
  columns.forEach(column => {
    itemRightEdges.push(runningX + column.width - 6);
    runningX += column.width;
  });

  (Array.isArray(safeInvoice.lines) ? safeInvoice.lines : []).forEach(line => {
    const titleLines = wrapPdfText(line.itemName || 'Item', columns[0].width - 12, 9, 'F2', 3);
    const descriptionLines = wrapPdfText(line.description || '', columns[0].width - 12, 8, 'F1', 3);
    const rowHeight = Math.max(28, 10 + titleLines.length * 10 + descriptionLines.length * 9);
    if (page.cursorTop + rowHeight > pageHeight - marginBottom - 180) {
      page = startPage(false);
    }
    page.ops.push(buildRect(marginX, page.cursorTop, contentWidth, rowHeight, { strokeColor: colors.border }));
    let textTop = page.cursorTop + 8;
    titleLines.forEach(text => {
      page.ops.push(buildText(text, marginX + 6, textTop, { font: 'F2', size: 9, color: colors.ink }));
      textTop += 10;
    });
    descriptionLines.forEach(text => {
      page.ops.push(buildText(text, marginX + 6, textTop, { font: 'F1', size: 8, color: colors.muted }));
      textTop += 9;
    });
    const rowValues = [
      compactText(line.hsnCode) || '-',
      String(Math.max(0, parseNumber(line.qty, 0))),
      formatCurrencyInrForPdf(line.unitPrice || 0),
      `${Number(parseNumber(line.taxRate, 0)).toFixed(2)}%`,
      formatCurrencyInrForPdf(line.taxableValue || 0),
      formatCurrencyInrForPdf(line.gstAmount || 0),
      formatCurrencyInrForPdf(line.lineTotal || 0),
    ];
    rowValues.forEach((value, index) => {
      const column = columns[index + 1];
      const leftEdge = marginX + columns.slice(0, index + 1).reduce((sum, entry) => sum + entry.width, 0);
      const x =
        column.align === 'right'
          ? estimateRightX(itemRightEdges[index + 1], value, 8.5, 'F1')
          : leftEdge + 6;
      page.ops.push(buildText(value, x, page.cursorTop + 9, { font: 'F1', size: 8.5, color: colors.ink }));
    });
    page.cursorTop += rowHeight;
  });

  const notesHeight =
    58 +
    amountWordsLines.length * 11 +
    (bankLines.length > 0 ? 18 + bankLines.length * 10 : 0) +
    (noteLines.length > 0 ? 16 + noteLines.length * 10 : 0);
  const summaryHeight = 48 + summaryRows.length * 16 + 34;
  const finalBlockHeight = Math.max(summaryHeight, notesHeight) + 24;
  if (page.cursorTop + finalBlockHeight > pageHeight - marginBottom) {
    page = startPage(false);
  }

  const notesTop = page.cursorTop + 12;
  const notesWidth = 272;
  const summaryWidth = contentWidth - notesWidth - 16;
  page.ops.push(buildRect(marginX, notesTop, notesWidth, notesHeight, { strokeColor: colors.border, fillColor: [1, 1, 1] }));
  page.ops.push(buildRect(marginX + notesWidth + 16, notesTop, summaryWidth, summaryHeight, { strokeColor: colors.border, fillColor: [1, 1, 1] }));
  page.ops.push(buildText('Amount In Words', marginX + 10, notesTop + 10, { font: 'F2', size: 10, color: colors.accent }));
  let notesCursorTop = notesTop + 28;
  amountWordsLines.forEach(text => {
    page.ops.push(buildText(text, marginX + 10, notesCursorTop, { font: 'F1', size: 9, color: colors.ink }));
    notesCursorTop += 11;
  });
  if (bankLines.length > 0) {
    notesCursorTop += 8;
    page.ops.push(buildText('Bank Details', marginX + 10, notesCursorTop, { font: 'F2', size: 9, color: colors.accent }));
    notesCursorTop += 16;
    bankLines.forEach(text => {
      page.ops.push(buildText(text, marginX + 10, notesCursorTop, { font: 'F1', size: 8.5, color: colors.ink }));
      notesCursorTop += 10;
    });
  }
  if (noteLines.length > 0) {
    notesCursorTop += 8;
    noteLines.forEach(text => {
      page.ops.push(buildText(text, marginX + 10, notesCursorTop, { font: 'F1', size: 8.5, color: colors.muted }));
      notesCursorTop += 10;
    });
  }

  const summaryX = marginX + notesWidth + 16;
  page.ops.push(buildText('Payment Summary', summaryX + 10, notesTop + 10, { font: 'F2', size: 10, color: colors.accent }));
  let summaryCursorTop = notesTop + 28;
  summaryRows.forEach(row => {
    page.ops.push(
      buildText(row.label, summaryX + 10, summaryCursorTop, {
        font: row.bold ? 'F2' : 'F1',
        size: row.bold ? 10 : 9,
        color: row.bold ? colors.ink : colors.muted,
      }),
    );
    page.ops.push(
      buildText(
        row.value,
        estimateRightX(summaryX + summaryWidth - 10, row.value, row.bold ? 10 : 9, row.bold ? 'F2' : 'F1'),
        summaryCursorTop,
        { font: row.bold ? 'F2' : 'F1', size: row.bold ? 10 : 9, color: colors.ink },
      ),
    );
    summaryCursorTop += 16;
  });
  summaryCursorTop += 4;
  page.ops.push(buildLine(summaryX + 10, summaryCursorTop, summaryX + summaryWidth - 10, summaryCursorTop, { color: colors.border, width: 1 }));
  summaryCursorTop += 12;
  page.ops.push(
    buildText(
      taxBreakdown.intraState ? 'GST breakup shown as 9% CGST + 9% SGST.' : 'GST breakup shown as 18% IGST.',
      summaryX + 10,
      summaryCursorTop,
      { font: 'F1', size: 8.5, color: colors.muted },
    ),
  );

  const footerTop = pageHeight - marginBottom + 8;
  const footerText = safeInvoice.footerNote || `Authorised signatory for ${safeInvoice.sellerName}`;
  const signatureText = 'Authorised Signatory';
  pages.forEach((entry, index) => {
    entry.ops.push(buildLine(pageWidth - 176, footerTop - 22, pageWidth - 56, footerTop - 22, { color: colors.border, width: 1 }));
    entry.ops.push(buildText(signatureText, pageWidth - 160, footerTop - 18, { font: 'F1', size: 8.5, color: colors.muted }));
    entry.ops.push(buildText(footerText, marginX, footerTop - 18, { font: 'F1', size: 8.5, color: colors.muted }));
    entry.ops.push(
      buildText(
        `Page ${index + 1} of ${pages.length}`,
        estimateRightX(pageWidth / 2 + 34, `Page ${index + 1} of ${pages.length}`, 8.5, 'F1'),
        footerTop - 2,
        { font: 'F1', size: 8.5, color: colors.muted },
      ),
    );
  });

  return renderPdfDocument(pages.map(entry => entry.ops.join('\n')));
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

      await conn.query(
        `CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id VARCHAR(64) NOT NULL,
          user_id VARCHAR(64) NOT NULL,
          token_hash CHAR(64) NOT NULL,
          expires_at DATETIME NOT NULL,
          used_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_password_reset_tokens_token_hash (token_hash),
          KEY idx_password_reset_tokens_user_expires (user_id, expires_at),
          CONSTRAINT fk_password_reset_tokens_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );

      await conn.query(
        `CREATE TABLE IF NOT EXISTS locations (
          id VARCHAR(64) NOT NULL,
          label VARCHAR(220) NOT NULL,
          area VARCHAR(120) NULL,
          city VARCHAR(120) NULL,
          state VARCHAR(120) NULL,
          country VARCHAR(120) NOT NULL DEFAULT 'India',
          pincode VARCHAR(12) NULL,
          lat DECIMAL(10,7) NULL,
          lng DECIMAL(10,7) NULL,
          source ENUM('default', 'manual', 'gps', 'network', 'search') NOT NULL DEFAULT 'manual',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_locations_city_state_pin (city, state, pincode),
          CONSTRAINT chk_locations_lat CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
          CONSTRAINT chk_locations_lng CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );

      await conn.query(
        `CREATE TABLE IF NOT EXISTS location_profiles (
          id VARCHAR(64) NOT NULL,
          user_id VARCHAR(64) NULL,
          guest_id VARCHAR(60) NULL,
          current_location_id VARCHAR(64) NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_location_profiles_user_id (user_id),
          UNIQUE KEY uq_location_profiles_guest_id (guest_id),
          KEY idx_location_profiles_current_location (current_location_id),
          CONSTRAINT fk_location_profiles_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE,
          CONSTRAINT fk_location_profiles_current_location
            FOREIGN KEY (current_location_id) REFERENCES locations(id)
            ON DELETE SET NULL
            ON UPDATE CASCADE,
          CONSTRAINT chk_location_profiles_owner
            CHECK ((user_id IS NOT NULL AND guest_id IS NULL) OR (user_id IS NULL AND guest_id IS NOT NULL))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );

      await conn.query(
        `CREATE TABLE IF NOT EXISTS location_saved (
          profile_id VARCHAR(64) NOT NULL,
          location_id VARCHAR(64) NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (profile_id, location_id),
          CONSTRAINT fk_location_saved_profile
            FOREIGN KEY (profile_id) REFERENCES location_profiles(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE,
          CONSTRAINT fk_location_saved_location
            FOREIGN KEY (location_id) REFERENCES locations(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );

      await conn.query(
        `CREATE TABLE IF NOT EXISTS location_recent (
          id VARCHAR(64) NOT NULL,
          profile_id VARCHAR(64) NOT NULL,
          location_id VARCHAR(64) NOT NULL,
          seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_location_recent_profile_location (profile_id, location_id),
          KEY idx_location_recent_profile_seen (profile_id, seen_at),
          CONSTRAINT fk_location_recent_profile
            FOREIGN KEY (profile_id) REFERENCES location_profiles(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE,
          CONSTRAINT fk_location_recent_location
            FOREIGN KEY (location_id) REFERENCES locations(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );

      await conn.query(
        `CREATE TABLE IF NOT EXISTS location_suggestions (
          id VARCHAR(64) NOT NULL,
          location_id VARCHAR(64) NOT NULL,
          rank_score INT NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_location_suggestions_location (location_id),
          KEY idx_location_suggestions_rank (rank_score, created_at),
          CONSTRAINT fk_location_suggestions_location
            FOREIGN KEY (location_id) REFERENCES locations(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );

      await conn.query(
        `CREATE TABLE IF NOT EXISTS invoice_seller_settings (
          id VARCHAR(32) NOT NULL,
          seller_name VARCHAR(160) NOT NULL,
          seller_gstin VARCHAR(20) NULL,
          seller_address TEXT NOT NULL,
          seller_state VARCHAR(80) NOT NULL,
          seller_phone VARCHAR(30) NULL,
          seller_email VARCHAR(160) NULL,
          seller_website VARCHAR(200) NULL,
          seller_pan VARCHAR(20) NULL,
          bank_account_name VARCHAR(160) NULL,
          bank_account_number VARCHAR(80) NULL,
          bank_ifsc VARCHAR(20) NULL,
          bank_branch VARCHAR(160) NULL,
          declaration_note TEXT NULL,
          footer_note TEXT NULL,
          updated_by VARCHAR(64) NULL,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          CONSTRAINT fk_invoice_seller_settings_updated_by
            FOREIGN KEY (updated_by) REFERENCES users(id)
            ON DELETE SET NULL
            ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );

      const requiredTables = [
        'users',
        'password_reset_tokens',
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
        'invoice_seller_settings',
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

      const [technologyColumnRows] = await conn.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = ?
           AND table_name = 'products'
           AND column_name = 'technology_option'`,
        [MYSQL_DATABASE],
      );
      if (!Array.isArray(technologyColumnRows) || technologyColumnRows.length === 0) {
        await conn.query(
          `ALTER TABLE products
           ADD COLUMN technology_option VARCHAR(40) NULL AFTER capacity_ah`,
        );
      }

      const [invoiceColumnRows] = await conn.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = ?
           AND table_name = 'invoices'`,
        [MYSQL_DATABASE],
      );
      const invoiceColumnSet = new Set(
        (Array.isArray(invoiceColumnRows) ? invoiceColumnRows : []).map(row => row.COLUMN_NAME || row.column_name),
      );
      const invoiceColumnDefs = [
        ['order_id', `ALTER TABLE invoices ADD COLUMN order_id VARCHAR(64) NULL AFTER customer_id`],
        ['subtotal', `ALTER TABLE invoices ADD COLUMN subtotal DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER due_date`],
        ['discount', `ALTER TABLE invoices ADD COLUMN discount DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER subtotal`],
        ['delivery_fee', `ALTER TABLE invoices ADD COLUMN delivery_fee DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER discount`],
        ['taxable_total', `ALTER TABLE invoices ADD COLUMN taxable_total DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER delivery_fee`],
        ['gst_total', `ALTER TABLE invoices ADD COLUMN gst_total DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER taxable_total`],
        ['cgst_total', `ALTER TABLE invoices ADD COLUMN cgst_total DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER gst_total`],
        ['sgst_total', `ALTER TABLE invoices ADD COLUMN sgst_total DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER cgst_total`],
        ['igst_total', `ALTER TABLE invoices ADD COLUMN igst_total DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER sgst_total`],
        ['round_off', `ALTER TABLE invoices ADD COLUMN round_off DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER igst_total`],
        ['bill_to_name', `ALTER TABLE invoices ADD COLUMN bill_to_name VARCHAR(160) NULL AFTER round_off`],
        ['bill_to_phone', `ALTER TABLE invoices ADD COLUMN bill_to_phone VARCHAR(30) NULL AFTER bill_to_name`],
        ['bill_to_email', `ALTER TABLE invoices ADD COLUMN bill_to_email VARCHAR(160) NULL AFTER bill_to_phone`],
        ['bill_to_gstin', `ALTER TABLE invoices ADD COLUMN bill_to_gstin VARCHAR(20) NULL AFTER bill_to_email`],
        ['bill_to_address', `ALTER TABLE invoices ADD COLUMN bill_to_address TEXT NULL AFTER bill_to_gstin`],
        ['ship_to_address', `ALTER TABLE invoices ADD COLUMN ship_to_address TEXT NULL AFTER bill_to_address`],
        ['place_of_supply', `ALTER TABLE invoices ADD COLUMN place_of_supply VARCHAR(160) NULL AFTER ship_to_address`],
      ];
      for (const [columnName, ddl] of invoiceColumnDefs) {
        if (!invoiceColumnSet.has(columnName)) {
          await conn.query(ddl);
        }
      }

      const [invoiceIndexRows] = await conn.query(
        `SELECT index_name
         FROM information_schema.statistics
         WHERE table_schema = ?
           AND table_name = 'invoices'`,
        [MYSQL_DATABASE],
      );
      const invoiceIndexSet = new Set(
        (Array.isArray(invoiceIndexRows) ? invoiceIndexRows : []).map(row => row.INDEX_NAME || row.index_name),
      );
      if (!invoiceIndexSet.has('uq_invoices_order_id')) {
        await conn.query(
          `ALTER TABLE invoices
           ADD UNIQUE KEY uq_invoices_order_id (order_id)`,
        );
      }

      const [invoiceLineColumnRows] = await conn.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = ?
           AND table_name = 'invoice_lines'`,
        [MYSQL_DATABASE],
      );
      const invoiceLineColumnSet = new Set(
        (Array.isArray(invoiceLineColumnRows) ? invoiceLineColumnRows : []).map(row => row.COLUMN_NAME || row.column_name),
      );
      const invoiceLineDefs = [
        ['item_name', `ALTER TABLE invoice_lines ADD COLUMN item_name VARCHAR(200) NULL AFTER product_id`],
        ['description', `ALTER TABLE invoice_lines ADD COLUMN description VARCHAR(255) NULL AFTER item_name`],
        ['sku', `ALTER TABLE invoice_lines ADD COLUMN sku VARCHAR(120) NULL AFTER description`],
        ['unit', `ALTER TABLE invoice_lines ADD COLUMN unit VARCHAR(40) NULL AFTER sku`],
        ['hsn_code', `ALTER TABLE invoice_lines ADD COLUMN hsn_code VARCHAR(40) NULL AFTER unit`],
        ['tax_rate', `ALTER TABLE invoice_lines ADD COLUMN tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER unit_price`],
        ['gross_amount', `ALTER TABLE invoice_lines ADD COLUMN gross_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER line_total`],
        ['discount_amount', `ALTER TABLE invoice_lines ADD COLUMN discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER gross_amount`],
        ['net_amount', `ALTER TABLE invoice_lines ADD COLUMN net_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER discount_amount`],
        ['taxable_value', `ALTER TABLE invoice_lines ADD COLUMN taxable_value DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER net_amount`],
        ['gst_amount', `ALTER TABLE invoice_lines ADD COLUMN gst_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER taxable_value`],
        ['cgst_amount', `ALTER TABLE invoice_lines ADD COLUMN cgst_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER gst_amount`],
        ['sgst_amount', `ALTER TABLE invoice_lines ADD COLUMN sgst_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER cgst_amount`],
        ['igst_amount', `ALTER TABLE invoice_lines ADD COLUMN igst_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER sgst_amount`],
      ];
      for (const [columnName, ddl] of invoiceLineDefs) {
        if (!invoiceLineColumnSet.has(columnName)) {
          await conn.query(ddl);
        }
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
        `CREATE TABLE IF NOT EXISTS invoice_seller_settings (
          id VARCHAR(32) NOT NULL,
          seller_name VARCHAR(160) NOT NULL,
          seller_gstin VARCHAR(20) NULL,
          seller_address TEXT NOT NULL,
          seller_state VARCHAR(80) NOT NULL,
          seller_phone VARCHAR(30) NULL,
          seller_email VARCHAR(160) NULL,
          seller_website VARCHAR(200) NULL,
          seller_pan VARCHAR(20) NULL,
          bank_account_name VARCHAR(160) NULL,
          bank_account_number VARCHAR(80) NULL,
          bank_ifsc VARCHAR(20) NULL,
          bank_branch VARCHAR(160) NULL,
          declaration_note TEXT NULL,
          footer_note TEXT NULL,
          updated_by VARCHAR(64) NULL,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          CONSTRAINT fk_invoice_seller_settings_updated_by
            FOREIGN KEY (updated_by) REFERENCES users(id)
            ON DELETE SET NULL
            ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      );

      await conn.query(
        `INSERT IGNORE INTO invoice_seller_settings
          (id, seller_name, seller_gstin, seller_address, seller_state)
         VALUES ('default', ?, ?, ?, ?)`,
        [
          DEFAULT_INVOICE_SELLER.sellerName,
          DEFAULT_INVOICE_SELLER.sellerGstin || null,
          DEFAULT_INVOICE_SELLER.sellerAddress,
          DEFAULT_INVOICE_SELLER.sellerState,
        ],
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
        const storedPassword = await ensurePasswordHash(u.password);
        await conn.query(
          `INSERT IGNORE INTO users (id, username, password_hash, role, full_name, is_active)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [u.id, u.username, storedPassword, u.role, u.name],
        );
      }

      const [userPasswordRows] = await conn.query(
        `SELECT id, password_hash
         FROM users`,
      );
      for (const row of Array.isArray(userPasswordRows) ? userPasswordRows : []) {
        const storedPassword = String(row.password_hash || '').trim();
        if (!storedPassword || isPasswordHash(storedPassword)) {
          continue;
        }
        await conn.query(
          `UPDATE users
           SET password_hash = ?
           WHERE id = ?`,
          [await hashPassword(storedPassword), row.id],
        );
      }

      await conn.query(
        `DELETE FROM password_reset_tokens
         WHERE used_at IS NOT NULL
            OR expires_at <= CURRENT_TIMESTAMP`,
      );

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
             SET category = 'Miscellaneous'
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

function mapInvoiceLineFromDbRow(row) {
  return decorateInvoiceLine({
    id: row.id,
    itemId: row.item_id || row.product_id,
    itemName: row.item_name,
    description: row.description,
    sku: row.sku,
    unit: row.unit,
    hsnCode: row.hsn_code,
    qty: parseNumber(row.qty, 0),
    unitPrice: parseNumber(row.unit_price, 0),
    taxRate: parseNumber(row.tax_rate, 0),
    grossAmount: parseNumber(row.gross_amount, parseNumber(row.line_total, 0)),
    discountAmount: parseNumber(row.discount_amount, 0),
    netAmount: parseNumber(row.net_amount, parseNumber(row.line_total, 0)),
    taxableValue: parseNumber(row.taxable_value, 0),
    gstAmount: parseNumber(row.gst_amount, 0),
    cgstAmount: parseNumber(row.cgst_amount, 0),
    sgstAmount: parseNumber(row.sgst_amount, 0),
    igstAmount: parseNumber(row.igst_amount, 0),
  });
}

function mapInvoiceFromDbRow(row, lines = [], sellerProfile = null) {
  return decorateInvoiceDocument({
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.order_number,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    status: row.status,
    dueDate: toYmd(row.due_date),
    total: parseNumber(row.total, 0),
    createdAt: toIso(row.created_at),
    paidAt: row.paid_at ? toIso(row.paid_at) : '',
    subtotal: parseNumber(row.subtotal, 0),
    discount: parseNumber(row.discount, 0),
    deliveryFee: parseNumber(row.delivery_fee, 0),
    taxableTotal: parseNumber(row.taxable_total, 0),
    gstTotal: parseNumber(row.gst_total, 0),
    cgstTotal: parseNumber(row.cgst_total, 0),
    sgstTotal: parseNumber(row.sgst_total, 0),
    igstTotal: parseNumber(row.igst_total, 0),
    roundOff: parseNumber(row.round_off, 0),
    billToName: row.bill_to_name,
    billToPhone: row.bill_to_phone,
    billToEmail: row.bill_to_email,
    billToGstin: row.bill_to_gstin,
    billToAddress: row.bill_to_address,
    shipToAddress: row.ship_to_address,
    placeOfSupply: row.place_of_supply,
    lines,
  }, sellerProfile);
}

function buildSqlPlaceholders(values) {
  return (Array.isArray(values) ? values : []).map(() => '?').join(', ');
}

async function fetchInvoicesByOrderIds(conn, orderIds) {
  const safeOrderIds = Array.from(new Set((Array.isArray(orderIds) ? orderIds : []).map(compactText).filter(Boolean)));
  if (safeOrderIds.length === 0) {
    return new Map();
  }

  const [invoiceRows, sellerProfile] = await Promise.all([
    conn.query(
    `SELECT i.id,
            i.order_id,
            co.order_number,
            i.invoice_number,
            i.customer_id,
            i.status,
            i.due_date,
            i.total,
            i.created_at,
            i.paid_at,
            i.subtotal,
            i.discount,
            i.delivery_fee,
            i.taxable_total,
            i.gst_total,
            i.cgst_total,
            i.sgst_total,
            i.igst_total,
            i.round_off,
            i.bill_to_name,
            i.bill_to_phone,
            i.bill_to_email,
            i.bill_to_gstin,
            i.bill_to_address,
            i.ship_to_address,
            i.place_of_supply,
            COALESCE(c.name, i.bill_to_name, '') AS customer_name
     FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id
     LEFT JOIN customer_orders co ON co.id = i.order_id
     WHERE i.order_id IN (${buildSqlPlaceholders(safeOrderIds)})
     ORDER BY i.created_at DESC`,
    safeOrderIds,
    ),
    fetchInvoiceSellerProfile(conn),
  ]);
  const invoiceData = Array.isArray(invoiceRows?.[0]) ? invoiceRows[0] : Array.isArray(invoiceRows) ? invoiceRows : [];
  const invoiceIds = invoiceData.map(row => row.id).filter(Boolean);
  let invoiceLineData = [];
  if (invoiceIds.length > 0) {
    const [lineRows] = await conn.query(
      `SELECT il.id,
              il.invoice_id,
              il.product_id AS item_id,
              COALESCE(NULLIF(il.item_name, ''), COALESCE(p.name, 'Unknown Item')) AS item_name,
              COALESCE(NULLIF(il.description, ''), COALESCE(p.name, 'Unknown Item')) AS description,
              COALESCE(NULLIF(il.sku, ''), COALESCE(p.sku, '')) AS sku,
              COALESCE(NULLIF(il.unit, ''), COALESCE(p.unit, 'pcs')) AS unit,
              COALESCE(NULLIF(il.hsn_code, ''), COALESCE(p.hsn_code, '')) AS hsn_code,
              il.qty,
              il.unit_price,
              CASE
                WHEN il.tax_rate > 0 THEN il.tax_rate
                ELSE COALESCE(p.tax_rate, 0)
              END AS tax_rate,
              il.line_total,
              il.gross_amount,
              il.discount_amount,
              il.net_amount,
              il.taxable_value,
              il.gst_amount,
              il.cgst_amount,
              il.sgst_amount,
              il.igst_amount
       FROM invoice_lines il
       LEFT JOIN products p ON p.id = il.product_id
       WHERE il.invoice_id IN (${buildSqlPlaceholders(invoiceIds)})
       ORDER BY il.invoice_id, il.id`,
      invoiceIds,
    );
    invoiceLineData = Array.isArray(lineRows) ? lineRows : [];
  }

  const invoiceLinesByInvoice = new Map();
  for (const row of invoiceLineData) {
    const lines = invoiceLinesByInvoice.get(row.invoice_id) || [];
    lines.push(mapInvoiceLineFromDbRow(row));
    invoiceLinesByInvoice.set(row.invoice_id, lines);
  }

  const invoicesByOrder = new Map();
  for (const row of invoiceData) {
    invoicesByOrder.set(row.order_id, mapInvoiceFromDbRow(row, invoiceLinesByInvoice.get(row.id) || [], sellerProfile));
  }
  return invoicesByOrder;
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
      `SELECT id, item_type, name, model, capacity_ah, technology_option, sku, category, unit, brand, tags, description, hsn_code,
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
      `SELECT i.id,
              i.order_id,
              co.order_number,
              i.invoice_number,
              i.customer_id,
              i.status,
              i.due_date,
              i.total,
              i.created_at,
              i.paid_at,
              i.subtotal,
              i.discount,
              i.delivery_fee,
              i.taxable_total,
              i.gst_total,
              i.cgst_total,
              i.sgst_total,
              i.igst_total,
              i.round_off,
              i.bill_to_name,
              i.bill_to_phone,
              i.bill_to_email,
              i.bill_to_gstin,
              i.bill_to_address,
              i.ship_to_address,
              i.place_of_supply,
              COALESCE(c.name, i.bill_to_name, '') AS customer_name
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       LEFT JOIN customer_orders co ON co.id = i.order_id
       ORDER BY i.created_at DESC`,
    ),
    mysqlPool.query(
      `SELECT il.id,
              il.invoice_id,
              il.product_id AS item_id,
              COALESCE(NULLIF(il.item_name, ''), COALESCE(p.name, 'Unknown Item')) AS item_name,
              COALESCE(NULLIF(il.description, ''), COALESCE(p.name, 'Unknown Item')) AS description,
              COALESCE(NULLIF(il.sku, ''), COALESCE(p.sku, '')) AS sku,
              COALESCE(NULLIF(il.unit, ''), COALESCE(p.unit, 'pcs')) AS unit,
              COALESCE(NULLIF(il.hsn_code, ''), COALESCE(p.hsn_code, '')) AS hsn_code,
              il.qty,
              il.unit_price,
              CASE
                WHEN il.tax_rate > 0 THEN il.tax_rate
                ELSE COALESCE(p.tax_rate, 0)
              END AS tax_rate,
              il.line_total,
              il.gross_amount,
              il.discount_amount,
              il.net_amount,
              il.taxable_value,
              il.gst_amount,
              il.cgst_amount,
              il.sgst_amount,
              il.igst_amount
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
      technologyOption: row.technology_option,
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
    lines.push(mapInvoiceLineFromDbRow(row));
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

  const invoices = invoiceData.map(row => mapInvoiceFromDbRow(row, invoiceLinesByInvoice.get(row.id) || []));

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
        const storedPassword = await ensurePasswordHash(u.password);
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
          [u.id, u.username, storedPassword, u.role, u.name, null],
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
            (id, item_type, name, model, capacity_ah, technology_option, sku, category, unit, brand, tags, description, hsn_code, tax_rate, location,
             qty_on_hand, reorder_point, purchase_price, selling_price, is_active, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [
            item.id,
            item.itemType || 'Goods',
            item.name,
            item.model || item.sku,
            normalizeCapacityAh(item.capacityAh),
            normalizeTechnologyOption(item.technologyOption),
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
             (id, order_id, invoice_number, customer_id, status, due_date, subtotal, discount, delivery_fee, taxable_total,
              gst_total, cgst_total, sgst_total, igst_total, round_off, bill_to_name, bill_to_phone, bill_to_email,
              bill_to_gstin, bill_to_address, ship_to_address, place_of_supply, total, created_by, created_at, paid_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
          [
            invoice.id,
            compactText(invoice.orderId) || null,
            invoice.invoiceNumber,
            invoice.customerId,
            invoice.status || 'Open',
            toMysqlDate(invoice.dueDate),
            parseNumber(invoice.subtotal, 0),
            parseNumber(invoice.discount, 0),
            parseNumber(invoice.deliveryFee, 0),
            parseNumber(invoice.taxableTotal, 0),
            parseNumber(invoice.gstTotal, 0),
            parseNumber(invoice.cgstTotal, 0),
            parseNumber(invoice.sgstTotal, 0),
            parseNumber(invoice.igstTotal, 0),
            parseNumber(invoice.roundOff, 0),
            compactText(invoice.billToName) || compactText(invoice.customerName) || null,
            compactText(invoice.billToPhone) || null,
            compactText(invoice.billToEmail) || null,
            compactText(invoice.billToGstin) || null,
            compactText(invoice.billToAddress) || null,
            compactText(invoice.shipToAddress) || null,
            compactText(invoice.placeOfSupply) || null,
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
              (id, invoice_id, product_id, item_name, description, sku, unit, hsn_code, qty, unit_price, tax_rate,
               gross_amount, discount_amount, net_amount, taxable_value, gst_amount, cgst_amount, sgst_amount, igst_amount)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              compactText(line.id) || `il_${invoice.id}_${i + 1}`,
              invoice.id,
              line.itemId,
              compactText(line.itemName) || 'Item',
              compactText(line.description) || compactText(line.itemName) || 'Item',
              compactText(line.sku) || null,
              compactText(line.unit) || 'pcs',
              compactText(line.hsnCode) || null,
              parseNumber(line.qty, 0),
              parseNumber(line.unitPrice, 0),
              parseNumber(line.taxRate, 0),
              parseNumber(line.grossAmount, parseNumber(line.lineTotal, 0)),
              parseNumber(line.discountAmount, 0),
              parseNumber(line.netAmount, parseNumber(line.lineTotal, 0)),
              parseNumber(line.taxableValue, 0),
              parseNumber(line.gstAmount, 0),
              parseNumber(line.cgstAmount, 0),
              parseNumber(line.sgstAmount, 0),
              parseNumber(line.igstAmount, 0),
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

function sendJson(res, status, payload, extraHeaders = null) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    ...(extraHeaders || {}),
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, status, html, extraHeaders = null) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    ...(extraHeaders || {}),
  });
  res.end(String(html || ''));
}

function sendPdf(res, status, pdfBuffer, extraHeaders = null) {
  const payload = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer || '');
  res.writeHead(status, {
    'Content-Type': 'application/pdf',
    'Content-Length': payload.length,
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    ...(extraHeaders || {}),
  });
  res.end(payload);
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
    const headers = {
      'Content-Type': contentType,
      'Content-Length': String(stats.size),
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'X-Content-Type-Options': 'nosniff',
    };
    if (contentType === 'application/vnd.android.package-archive') {
      headers['Content-Disposition'] = `attachment; filename="${path.basename(absolutePath)}"`;
    }
    res.writeHead(200, headers);
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

function toProfileOrderItemPreview(row, req = null) {
  return {
    id: row.order_item_id || `${row.order_id}_${row.product_id || 'item'}`,
    productId: row.product_id || null,
    name: row.product_name || 'Product',
    brand: row.brand || '',
    category: row.category || '',
    model: row.model || row.order_item_model || row.product_name || '',
    capacity: row.order_item_capacity || row.capacity || '',
    qty: Math.max(1, parseNumber(row.qty, 1)),
    unitPrice: parseNumber(row.unit_price, 0),
    lineTotal: clamp2(parseNumber(row.unit_price, 0) * Math.max(1, parseNumber(row.qty, 1))),
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

async function fetchOrdersByOwner(conn, owner, req = null, options = {}) {
  const ownerWhere = buildOwnerCondition(owner);
  const filterSql = compactText(options.orderId) ? ' AND co.id = ?' : '';
  const filterParams = compactText(options.orderId) ? [compactText(options.orderId)] : [];
  const [rows] = await conn.query(
    `SELECT co.id AS order_id,
            co.order_number,
            co.status,
            co.placed_at,
            co.created_at,
            co.total,
            co.subtotal,
            co.discount,
            co.delivery_fee,
            coi.id AS order_item_id,
            coi.product_id,
            coi.product_name,
            coi.model AS order_item_model,
            coi.capacity AS order_item_capacity,
            coi.unit_price,
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
       ${filterSql}
     ORDER BY co.placed_at DESC, co.created_at DESC, co.id DESC, coi.id DESC`,
    [...ownerWhere.params, ...filterParams],
  );
  const orderRows = Array.isArray(rows) ? rows : [];
  if (orderRows.length === 0) {
    return [];
  }

  const invoicesByOrder = await fetchInvoicesByOrderIds(
    conn,
    orderRows.map(row => row.order_id),
  );
  const groupedOrders = new Map();
  for (const row of orderRows) {
    let order = groupedOrders.get(row.order_id);
    if (!order) {
      order = {
        id: row.order_id,
        orderNumber: row.order_number || row.order_id,
        createdAt: toYmd(row.placed_at || row.created_at),
        itemCount: 0,
        total: parseNumber(row.total, 0),
        subtotal: parseNumber(row.subtotal, 0),
        discount: parseNumber(row.discount, 0),
        deliveryFee: parseNumber(row.delivery_fee, 0),
        status: row.status || 'Processing',
        productId: row.product_id || null,
        brand: row.brand || '',
        category: row.category || '',
        model: row.model || row.order_item_model || row.product_name || '',
        thumbnail: resolveAssetUrl(req, row.thumbnail || getFallbackThumbnail()),
        items: [],
        invoice: invoicesByOrder.get(row.order_id) || null,
      };
      groupedOrders.set(row.order_id, order);
    }
    const previewItem = toProfileOrderItemPreview(row, req);
    order.itemCount += previewItem.qty;
    order.items.push(previewItem);
  }
  return Array.from(groupedOrders.values());
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
    description: joinNonEmpty([item.name, item.model, item.capacityAh], ' • ') || item.name,
    model: item.model || '',
    capacity: item.capacityAh || '',
    sku: item.sku,
    unit: item.unit,
    hsnCode: item.hsnCode || '',
    taxRate: parseNumber(item.taxRate, 0),
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
  const rawPathname = parsedUrl.pathname;
  const pathname = rawPathname.startsWith('/api/public/store/')
    ? rawPathname.replace('/api/public/store/', '/api/public/')
    : rawPathname;
  const { searchParams } = parsedUrl;

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && rawPathname.startsWith(STATIC_URL_PREFIX)) {
    await serveStaticAsset(req, res, rawPathname);
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

    if (pathname === '/reset-password' && req.method === 'GET') {
      const token = String(searchParams.get('token') || '').trim();
      if (!token) {
        sendHtml(res, 400, renderResetPasswordPage('', 'Reset token is missing.'));
        return;
      }
      sendHtml(res, 200, renderResetPasswordPage(token));
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
      const appId = String(searchParams.get('appId') || '').trim();
      const channel = String(searchParams.get('channel') || 'production').trim().toLowerCase() || 'production';
      const platformRaw = String(searchParams.get('platform') || '').trim().toLowerCase();
      if (platformRaw !== 'android' && platformRaw !== 'ios') {
        sendError(res, 400, 'Invalid platform');
        return;
      }
      const platform = platformRaw;
      const currentVersion = String(searchParams.get('currentVersion') || '').trim() || '0.0.0';
      const manifest = await readAppUpdateManifest();
      const entry = platform === 'ios' ? manifest.ios : manifest.android;
      if (entry.channel && entry.channel !== channel) {
        sendError(res, 404, 'Update manifest not found');
        return;
      }
      if (platform === 'android' && appId && entry.appId && entry.appId !== appId) {
        sendError(res, 404, 'Update manifest not found');
        return;
      }
      const updateAvailable = compareAppVersions(entry.latestVersion, currentVersion) > 0;
      const minVersionRequiresUpdate = compareAppVersions(entry.minimumSupportedVersion, currentVersion) > 0;
      const forceUpdate = minVersionRequiresUpdate || (entry.mandatory && updateAvailable);

      sendJson(res, 200, {
        appId: entry.appId,
        channel: entry.channel,
        platform,
        currentVersion,
        latestVersion: entry.latestVersion,
        minimumSupportedVersion: entry.minimumSupportedVersion,
        mandatory: forceUpdate,
        updateAvailable,
        forceUpdate,
        downloadUrl: resolveAssetUrl(req, entry.downloadUrl),
        releaseNotes: entry.releaseNotes,
        publishedAt: entry.publishedAt,
        checksumSha256: entry.checksumSha256,
        fileSizeBytes: entry.fileSizeBytes,
      }, {
        'Cache-Control': 'no-store, max-age=0',
      });
      return;
    }

    if (pathname === '/api/public/products' && req.method === 'GET') {
      const db = await readDb();
      const search = (searchParams.get('search') || '').trim().toLowerCase();
      const products = db.items
        .filter(item => {
          const text = `${item.name} ${item.model || ''} ${item.brand || ''} ${item.category} ${item.technologyOption || ''}`.toLowerCase();
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
            technologyOption: item.technologyOption || undefined,
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
      const baseKey = `${item.name}|${item.model || item.sku}|${item.brand || ''}|${item.category}|${item.technologyOption || ''}`.toLowerCase();
      const availableCapacities = Array.from(
        new Set(
          db.items
            .filter(
              p =>
                `${p.name}|${p.model || p.sku}|${p.brand || ''}|${p.category}|${p.technologyOption || ''}`.toLowerCase() ===
                baseKey,
            )
            .map(p => normalizeCapacityAh(p.capacityAh))
            .filter(Boolean),
        ),
      ).sort(compareCapacityAh);
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
          technologyOption: item.technologyOption || undefined,
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
      const storedPassword = String(row?.password_hash || '').trim();
      const isPasswordValid = row ? await verifyPassword(password, storedPassword) : false;
      if (!row || !isPasswordValid) {
        sendError(res, 401, 'Invalid username or password');
        return;
      }

      if (row && storedPassword && !isPasswordHash(storedPassword)) {
        await mysqlPool.query(
          `UPDATE users
           SET password_hash = ?
           WHERE id = ?`,
          [await hashPassword(storedPassword), row.id],
        );
      }

      const user = normalizeUser({
        id: row.id,
        username: row.username,
        password: isPasswordHash(storedPassword) ? storedPassword : await ensurePasswordHash(storedPassword),
        role: row.role,
        name: row.full_name,
      });
      const token = await createSession(user);
      sendJson(res, 200, { token, user: toPublicUser(user) });
      return;
    }

    if (pathname === '/api/auth/forgot-password' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const username = String(body.username || '').trim();
      if (!username) {
        sendError(res, 400, 'Email/username is required');
        return;
      }
      if (!nodemailer || !isMailConfigured()) {
        sendError(res, 503, 'Password reset email is not configured on the server');
        return;
      }

      enforcePasswordResetThrottle(req, username);
      await ensureDb();
      const [rows] = await mysqlPool.query(
        `SELECT id, username, full_name
         FROM users
         WHERE username = ?
           AND is_active = 1
         LIMIT 1`,
        [username],
      );
      const row = Array.isArray(rows) ? rows[0] : null;
      const genericMessage = 'If an account exists for this email, a reset link has been sent.';

      if (row && String(row.username || '').includes('@')) {
        const { token, expiresAt } = await createPasswordResetToken(row.id);
        const resetUrl = `${getAuthBaseUrl(req)}/reset-password?token=${encodeURIComponent(token)}`;
        const emailContent = buildPasswordResetEmail({
          name: row.full_name || row.username,
          resetUrl,
          expiresAt,
        });
        await sendMail({
          from: SMTP_FROM,
          to: row.username,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
        });
      }

      sendJson(res, 200, { success: true, message: genericMessage });
      return;
    }

    if (pathname === '/api/auth/reset-password' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const token = String(body.token || '').trim();
      const password = String(body.password || '').trim();
      const confirmPassword = String(body.confirmPassword || '').trim();
      if (!token || !password) {
        sendError(res, 400, 'Reset token and new password are required');
        return;
      }
      if (password.length < 6) {
        sendError(res, 400, 'Password must be at least 6 characters');
        return;
      }
      if (confirmPassword && confirmPassword !== password) {
        sendError(res, 400, 'Passwords do not match');
        return;
      }

      await ensureDb();
      const tokenHash = hashToken(token);
      const nextPasswordHash = await hashPassword(password);
      const conn = await mysqlPool.getConnection();
      let userId = '';
      try {
        await conn.beginTransaction();
        const [rows] = await conn.query(
          `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at, u.is_active
           FROM password_reset_tokens prt
           INNER JOIN users u ON u.id = prt.user_id
           WHERE prt.token_hash = ?
           LIMIT 1
           FOR UPDATE`,
          [tokenHash],
        );
        const row = Array.isArray(rows) ? rows[0] : null;
        const expiresAtMs = row?.expires_at ? new Date(row.expires_at).getTime() : 0;
        const isValid =
          row &&
          Number(row.is_active || 0) === 1 &&
          !row.used_at &&
          Number.isFinite(expiresAtMs) &&
          expiresAtMs > Date.now();
        if (!isValid) {
          await conn.rollback();
          sendError(res, 400, 'Reset link is invalid or has expired');
          return;
        }

        userId = String(row.user_id || '').trim();
        await conn.query(
          `UPDATE users
           SET password_hash = ?
           WHERE id = ?`,
          [nextPasswordHash, userId],
        );
        await conn.query(
          `UPDATE password_reset_tokens
           SET used_at = CURRENT_TIMESTAMP
           WHERE user_id = ?
             AND used_at IS NULL`,
          [userId],
        );
        await conn.commit();
      } catch (error) {
        try {
          await conn.rollback();
        } catch {
          // ignore rollback errors
        }
        throw error;
      } finally {
        conn.release();
      }

      await revokeUserSessions(userId);
      sendJson(res, 200, { success: true, message: 'Password updated. Return to the app and sign in.' });
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
        password: await hashPassword(password),
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
                  COALESCE(p.sku, '') AS sku,
                  COALESCE(p.unit, 'pcs') AS unit,
                  COALESCE(p.hsn_code, '') AS hsn_code,
                  COALESCE(p.tax_rate, 0) AS tax_rate,
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
        let deliveryLocation = null;
        if (locationId) {
          const [deliveryRows] = await conn.query(
            `SELECT id, label, area, city, state, country, pincode, lat, lng, source, updated_at
             FROM locations
             WHERE id = ?
             LIMIT 1`,
            [locationId],
          );
          const locationRow = Array.isArray(deliveryRows) ? deliveryRows[0] || null : null;
          if (locationRow) {
            deliveryLocation = normalizeLocation({
              id: locationRow.id,
              label: locationRow.label,
              area: locationRow.area,
              city: locationRow.city,
              state: locationRow.state,
              country: locationRow.country,
              pincode: locationRow.pincode,
              lat: locationRow.lat != null ? Number(locationRow.lat) : null,
              lng: locationRow.lng != null ? Number(locationRow.lng) : null,
              source: locationRow.source,
              updatedAt: toIso(locationRow.updated_at),
            });
          }
        }
        const shippingAddress = buildLocationAddress(deliveryLocation);
        const customer = await ensureStorefrontCustomer(conn, owner, {
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone,
          email: body.email,
          billingAddress: shippingAddress,
          shippingAddress,
        });

        const orderId = `ord_${crypto.randomUUID().slice(0, 8)}`;
        const orderNumber = `ORD-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 900 + 100)}`;
        const placedAt = new Date();
        await conn.query(
          `INSERT INTO customer_orders
            (id, order_number, user_id, guest_id, location_id, status, subtotal, discount, delivery_fee, total, placed_at, created_at)
           VALUES (?, ?, ?, ?, ?, 'Processing', ?, ?, ?, ?, ?, ?)`,
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
            placedAt,
            placedAt,
          ],
        );

        const invoiceLineDrafts = [];
        for (const row of lines) {
          const unitPrice = parseNumber(row.unit_price, 0);
          const qty = parseNumber(row.qty, 0);
          const productName = row.product_name || 'Product';
          const productModel = row.product_model || '';
          const capacity = row.capacity || '150Ah';
          await conn.query(
            `INSERT INTO customer_order_items
              (id, order_id, product_id, product_name, model, capacity, unit_price, qty)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              `coi_${crypto.randomUUID().slice(0, 8)}`,
              orderId,
              row.product_id,
              productName,
              productModel,
              capacity,
              unitPrice,
              qty,
            ],
          );
          invoiceLineDrafts.push({
            id: `il_${crypto.randomUUID().slice(0, 8)}`,
            itemId: row.product_id,
            itemName: productName,
            description: joinNonEmpty([productName, productModel, capacity], ' • ') || productName,
            sku: row.sku || '',
            unit: row.unit || 'pcs',
            hsnCode: row.hsn_code || '',
            qty,
            unitPrice,
            taxRate: parseNumber(row.tax_rate, 0),
          });
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

        const invoiceId = `invdoc_${crypto.randomUUID().slice(0, 8)}`;
        const invoiceNumber = await reserveDocumentNumber(conn, 'INV', 'INV');
        const sellerProfile = await fetchInvoiceSellerProfile(conn);
        const invoice = buildInvoiceDocument({
          id: invoiceId,
          orderId,
          orderNumber,
          invoiceNumber,
          customerId: customer.id,
          customerName: customer.name,
          status: 'Open',
          dueDate: toYmd(placedAt),
          createdAt: placedAt.toISOString(),
          subtotal,
          discount,
          deliveryFee,
          billToName: customer.name,
          billToPhone: customer.phone,
          billToEmail: customer.email,
          billToGstin: customer.gstin,
          billToAddress: customer.billingAddress || shippingAddress,
          shipToAddress: customer.shippingAddress || shippingAddress || customer.billingAddress,
          placeOfSupply: formatPlaceOfSupply(deliveryLocation, customer.shippingAddress || shippingAddress),
          placeOfSupplyState: deliveryLocation?.state || '',
          lines: invoiceLineDrafts,
          sellerProfile,
        });
        await conn.query(
          `INSERT INTO invoices
            (id, order_id, invoice_number, customer_id, status, due_date, subtotal, discount, delivery_fee, taxable_total,
             gst_total, cgst_total, sgst_total, igst_total, round_off, bill_to_name, bill_to_phone, bill_to_email,
             bill_to_gstin, bill_to_address, ship_to_address, place_of_supply, total, created_by, created_at, paid_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)`,
          [
            invoice.id,
            orderId,
            invoice.invoiceNumber,
            invoice.customerId,
            invoice.status || 'Open',
            toMysqlDate(invoice.dueDate),
            invoice.subtotal,
            invoice.discount,
            invoice.deliveryFee,
            invoice.taxableTotal,
            invoice.gstTotal,
            invoice.cgstTotal,
            invoice.sgstTotal,
            invoice.igstTotal,
            invoice.roundOff,
            invoice.billToName,
            invoice.billToPhone || null,
            invoice.billToEmail || null,
            invoice.billToGstin || null,
            invoice.billToAddress || null,
            invoice.shipToAddress || null,
            invoice.placeOfSupply || null,
            invoice.total,
            placedAt,
          ],
        );
        for (const line of invoice.lines) {
          await conn.query(
            `INSERT INTO invoice_lines
              (id, invoice_id, product_id, item_name, description, sku, unit, hsn_code, qty, unit_price, tax_rate,
               gross_amount, discount_amount, net_amount, taxable_value, gst_amount, cgst_amount, sgst_amount, igst_amount)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              line.id,
              invoice.id,
              line.itemId,
              line.itemName,
              line.description,
              line.sku || null,
              line.unit || 'pcs',
              line.hsnCode || null,
              line.qty,
              line.unitPrice,
              line.taxRate,
              line.grossAmount,
              line.discountAmount,
              line.netAmount,
              line.taxableValue,
              line.gstAmount,
              line.cgstAmount,
              line.sgstAmount,
              line.igstAmount,
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

        const order = orders.find(entry => entry.id === orderId) || null;

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

    const storefrontInvoiceLinkOrderId = getPathAction(pathname, '/api/public/storefront/orders', 'invoice-link');
    if (storefrontInvoiceLinkOrderId && req.method === 'GET') {
      const owner = await getStorefrontOwner(req, searchParams, null);
      if (!owner) {
        sendError(res, 400, 'guestId is required for anonymous users');
        return;
      }
      const conn = await mysqlPool.getConnection();
      try {
        const orders = await fetchOrdersByOwner(conn, owner, req, { orderId: storefrontInvoiceLinkOrderId });
        const order = Array.isArray(orders) ? orders[0] || null : null;
        if (!order || !order.invoice) {
          sendError(res, 404, 'Invoice not found for this order');
          return;
        }
        const signed = createInvoiceDownloadSignature(order.id, owner);
        const url = new URL(`${getRequestBaseUrl(req)}/api/public/storefront/orders/${encodeURIComponent(order.id)}/invoice-download`);
        url.searchParams.set('ownerKind', signed.ownerKind);
        url.searchParams.set('ownerValue', signed.ownerValue);
        url.searchParams.set('expires', String(signed.expiresAt));
        url.searchParams.set('sig', signed.signature);
        sendJson(res, 200, { downloadUrl: url.toString(), invoiceNumber: order.invoice.invoiceNumber });
      } finally {
        conn.release();
      }
      return;
    }

    const storefrontInvoiceDownloadOrderId = getPathAction(pathname, '/api/public/storefront/orders', 'invoice-download');
    if (storefrontInvoiceDownloadOrderId && req.method === 'GET') {
      const owner = await getInvoiceDownloadOwner(req, searchParams, storefrontInvoiceDownloadOrderId);
      if (!owner) {
        sendError(res, 401, 'Unauthorized invoice download');
        return;
      }
      const conn = await mysqlPool.getConnection();
      try {
        const orders = await fetchOrdersByOwner(conn, owner, req, { orderId: storefrontInvoiceDownloadOrderId });
        const order = Array.isArray(orders) ? orders[0] || null : null;
        if (!order || !order.invoice) {
          sendError(res, 404, 'Invoice not found for this order');
          return;
        }
        const pdfBuffer = renderStorefrontInvoicePdf(order, order.invoice);
        const safeName = sanitizeFilePart(order.invoice.invoiceNumber || order.orderNumber || 'invoice');
        sendPdf(res, 200, pdfBuffer, {
          'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
        });
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

    if (pathname === '/api/public/storefront/admin/seller-settings' && req.method === 'GET') {
      const authUser = await getAuth(req);
      if (!authUser?.userId) {
        sendError(res, 401, 'Login required for seller settings');
        return;
      }
      if (authUser.role !== 'admin') {
        sendError(res, 403, 'Only admin can manage seller settings');
        return;
      }
      const conn = await mysqlPool.getConnection();
      try {
        const settings = await fetchInvoiceSellerProfile(conn);
        sendJson(res, 200, { settings });
      } finally {
        conn.release();
      }
      return;
    }

    if (pathname === '/api/public/storefront/admin/seller-settings' && req.method === 'PATCH') {
      const authUser = await getAuth(req);
      if (!authUser?.userId) {
        sendError(res, 401, 'Login required for seller settings');
        return;
      }
      if (authUser.role !== 'admin') {
        sendError(res, 403, 'Only admin can manage seller settings');
        return;
      }
      const body = await parseJsonBody(req);
      const validationError = validateInvoiceSellerProfileInput(body);
      if (validationError) {
        sendError(res, 400, validationError);
        return;
      }
      const conn = await mysqlPool.getConnection();
      try {
        const settings = await upsertInvoiceSellerProfile(conn, body, authUser.userId);
        sendJson(res, 200, { settings });
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
        const text = `${item.name} ${item.sku} ${item.location} ${item.category} ${item.brand} ${item.capacityAh || ''} ${item.technologyOption || ''}`.toLowerCase();
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

      const invoiceNumber = `INV-${String(db.counters.inv).padStart(4, '0')}`;

      appendMovement(db, {
        itemId,
        delta: -qty,
        type: 'INVOICE_SALE',
        reason: `Invoice to ${customer.name}`,
        reference: invoiceNumber,
      });

      const sellerProfile = await fetchInvoiceSellerProfile();
      const invoice = buildInvoiceDocument({
        id: `invdoc_${crypto.randomUUID().slice(0, 8)}`,
        invoiceNumber,
        customerId,
        customerName: customer.name,
        status: 'Open',
        dueDate: String(body.dueDate || ''),
        createdAt: new Date().toISOString(),
        subtotal: clamp2(qty * unitPrice),
        discount: 0,
        deliveryFee: 0,
        billToName: customer.name,
        billToPhone: customer.phone,
        billToEmail: customer.email,
        billToGstin: customer.gstin,
        billToAddress: customer.billingAddress,
        shipToAddress: customer.shippingAddress || customer.billingAddress,
        placeOfSupply: formatPlaceOfSupply(null, customer.shippingAddress || customer.billingAddress),
        lines: [
          {
            ...itemSummary,
            qty,
            unitPrice,
          },
        ],
        sellerProfile,
      });

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
      console.error(`[${new Date().toISOString()}] ${req.method} ${rawPathname}`, error);
    }
    sendError(res, mapped.status, mapped.message);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Inventory API running on 0.0.0.0:${PORT}`);
});
