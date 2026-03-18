-- MySQL / MariaDB (phpMyAdmin) bootstrap script
-- Creates database + all tables for the mobile application.

CREATE DATABASE IF NOT EXISTS mobile_app_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE mobile_app_db;

-- 1) Auth & user management
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) NOT NULL,
  username VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'manager', 'staff', 'customer') NOT NULL DEFAULT 'customer',
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_sessions (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id VARCHAR(64) NOT NULL,
  dark_mode TINYINT(1) NOT NULL DEFAULT 0,
  language ENUM('English', 'Hindi') NOT NULL DEFAULT 'English',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_preferences_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_preferences (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_seller_settings (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO invoice_seller_settings
  (id, seller_name, seller_gstin, seller_address, seller_state)
VALUES
  ('default', 'FuElectric', NULL, 'New Delhi, Delhi, India', 'Delhi');

-- 2) Inventory & catalog
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(64) NOT NULL,
  item_type VARCHAR(30) NOT NULL DEFAULT 'Goods',
  name VARCHAR(200) NOT NULL,
  model VARCHAR(120) NULL,
  capacity_ah VARCHAR(20) NULL,
  technology_option VARCHAR(40) NULL,
  sku VARCHAR(120) NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'Miscellaneous',
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
  brand VARCHAR(80) NULL,
  tags VARCHAR(255) NULL,
  description TEXT NULL,
  hsn_code VARCHAR(20) NULL,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  location VARCHAR(120) NOT NULL DEFAULT 'Unassigned',
  qty_on_hand INT NOT NULL DEFAULT 0,
  reorder_point INT NOT NULL DEFAULT 0,
  purchase_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  selling_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  stock_status VARCHAR(20)
    GENERATED ALWAYS AS (
      CASE
        WHEN qty_on_hand <= GREATEST(2, FLOOR(reorder_point / 2)) THEN 'Critical'
        WHEN qty_on_hand <= reorder_point THEN 'Low Stock'
        ELSE 'In Stock'
      END
    ) STORED,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_products_sku (sku),
  KEY idx_products_category (category),
  KEY idx_products_stock_status (stock_status),
  KEY idx_products_name_search (name, sku, category),
  CONSTRAINT chk_products_tax_rate CHECK (tax_rate >= 0),
  CONSTRAINT chk_products_qty_on_hand CHECK (qty_on_hand >= 0),
  CONSTRAINT chk_products_reorder_point CHECK (reorder_point >= 0),
  CONSTRAINT chk_products_purchase_price CHECK (purchase_price >= 0),
  CONSTRAINT chk_products_selling_price CHECK (selling_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_images (
  id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  image_url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 1,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  primary_slot TINYINT
    GENERATED ALWAYS AS (CASE WHEN is_primary = 1 THEN 1 ELSE NULL END) STORED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_images_sort (product_id, sort_order),
  UNIQUE KEY uq_product_images_one_primary (product_id, primary_slot),
  KEY idx_product_images_product_id (product_id),
  CONSTRAINT fk_product_images_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT chk_product_images_sort_order CHECK (sort_order > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_movements (
  id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  movement_type ENUM('ADJUSTMENT', 'PURCHASE_RECEIPT', 'SALES_FULFILLMENT', 'BILL_RECEIPT', 'INVOICE_SALE') NOT NULL,
  delta_qty INT NOT NULL,
  balance_after INT NOT NULL,
  reason TEXT NULL,
  reference_no VARCHAR(40) NULL,
  created_by VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_stock_movements_product_created (product_id, created_at),
  KEY idx_stock_movements_type_created (movement_type, created_at),
  KEY idx_stock_movements_created_by (created_by),
  CONSTRAINT fk_stock_movements_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_stock_movements_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT chk_stock_movements_delta_nonzero CHECK (delta_qty <> 0),
  CONSTRAINT chk_stock_movements_balance_nonnegative CHECK (balance_after >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Master parties
CREATE TABLE IF NOT EXISTS suppliers (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(160) NOT NULL,
  company VARCHAR(160) NULL,
  email VARCHAR(160) NULL,
  phone VARCHAR(30) NULL,
  gstin VARCHAR(20) NULL,
  billing_address TEXT NULL,
  shipping_address TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_suppliers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(160) NOT NULL,
  company VARCHAR(160) NULL,
  email VARCHAR(160) NULL,
  phone VARCHAR(30) NULL,
  gstin VARCHAR(20) NULL,
  billing_address TEXT NULL,
  shipping_address TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_customers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) Number counter helper
CREATE TABLE IF NOT EXISTS document_counters (
  counter_key VARCHAR(20) NOT NULL,
  next_value INT NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (counter_key),
  CONSTRAINT chk_document_counters_next_value CHECK (next_value >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO document_counters (counter_key, next_value) VALUES
  ('PO', 1),
  ('SO', 1),
  ('BILL', 1),
  ('INV', 1);

-- 5) Purchase & sales documents
CREATE TABLE IF NOT EXISTS purchase_orders (
  id VARCHAR(64) NOT NULL,
  po_number VARCHAR(30) NOT NULL,
  vendor_name VARCHAR(160) NOT NULL,
  expected_date DATE NULL,
  status ENUM('Open', 'Received', 'Cancelled') NOT NULL DEFAULT 'Open',
  total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  created_by VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  received_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_purchase_orders_po_number (po_number),
  KEY idx_purchase_orders_status_created (status, created_at),
  KEY idx_purchase_orders_created_by (created_by),
  CONSTRAINT fk_purchase_orders_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT chk_purchase_orders_total CHECK (total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id VARCHAR(64) NOT NULL,
  purchase_order_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  qty INT NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(14,2)
    GENERATED ALWAYS AS (qty * unit_cost) STORED,
  PRIMARY KEY (id),
  KEY idx_purchase_order_lines_order (purchase_order_id),
  KEY idx_purchase_order_lines_product (product_id),
  CONSTRAINT fk_purchase_order_lines_order
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_purchase_order_lines_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT chk_purchase_order_lines_qty CHECK (qty > 0),
  CONSTRAINT chk_purchase_order_lines_unit_cost CHECK (unit_cost >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_orders (
  id VARCHAR(64) NOT NULL,
  so_number VARCHAR(30) NOT NULL,
  customer_name VARCHAR(160) NOT NULL,
  status ENUM('Open', 'Fulfilled', 'Cancelled') NOT NULL DEFAULT 'Open',
  total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  created_by VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fulfilled_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sales_orders_so_number (so_number),
  KEY idx_sales_orders_status_created (status, created_at),
  KEY idx_sales_orders_created_by (created_by),
  CONSTRAINT fk_sales_orders_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT chk_sales_orders_total CHECK (total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_order_lines (
  id VARCHAR(64) NOT NULL,
  sales_order_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  qty INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(14,2)
    GENERATED ALWAYS AS (qty * unit_price) STORED,
  PRIMARY KEY (id),
  KEY idx_sales_order_lines_order (sales_order_id),
  KEY idx_sales_order_lines_product (product_id),
  CONSTRAINT fk_sales_order_lines_order
    FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_sales_order_lines_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT chk_sales_order_lines_qty CHECK (qty > 0),
  CONSTRAINT chk_sales_order_lines_unit_price CHECK (unit_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bills (
  id VARCHAR(64) NOT NULL,
  bill_number VARCHAR(30) NOT NULL,
  supplier_id VARCHAR(64) NOT NULL,
  status ENUM('Open', 'Paid', 'Cancelled') NOT NULL DEFAULT 'Open',
  due_date DATE NULL,
  total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  created_by VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bills_bill_number (bill_number),
  KEY idx_bills_status_due (status, due_date),
  KEY idx_bills_supplier_id (supplier_id),
  KEY idx_bills_created_by (created_by),
  CONSTRAINT fk_bills_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_bills_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT chk_bills_total CHECK (total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bill_lines (
  id VARCHAR(64) NOT NULL,
  bill_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  qty INT NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(14,2)
    GENERATED ALWAYS AS (qty * unit_cost) STORED,
  PRIMARY KEY (id),
  KEY idx_bill_lines_bill (bill_id),
  KEY idx_bill_lines_product (product_id),
  CONSTRAINT fk_bill_lines_bill
    FOREIGN KEY (bill_id) REFERENCES bills(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_bill_lines_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT chk_bill_lines_qty CHECK (qty > 0),
  CONSTRAINT chk_bill_lines_unit_cost CHECK (unit_cost >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(64) NOT NULL,
  invoice_number VARCHAR(30) NOT NULL,
  customer_id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64) NULL,
  status ENUM('Open', 'Paid', 'Cancelled') NOT NULL DEFAULT 'Open',
  due_date DATE NULL,
  subtotal DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  discount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  delivery_fee DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  taxable_total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  gst_total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  cgst_total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  sgst_total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  igst_total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  round_off DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  bill_to_name VARCHAR(160) NULL,
  bill_to_phone VARCHAR(30) NULL,
  bill_to_email VARCHAR(160) NULL,
  bill_to_gstin VARCHAR(20) NULL,
  bill_to_address TEXT NULL,
  ship_to_address TEXT NULL,
  place_of_supply VARCHAR(160) NULL,
  total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  created_by VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoices_invoice_number (invoice_number),
  UNIQUE KEY uq_invoices_order_id (order_id),
  KEY idx_invoices_status_due (status, due_date),
  KEY idx_invoices_customer_id (customer_id),
  KEY idx_invoices_created_by (created_by),
  CONSTRAINT fk_invoices_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_invoices_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT chk_invoices_total CHECK (total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_lines (
  id VARCHAR(64) NOT NULL,
  invoice_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  item_name VARCHAR(200) NULL,
  description VARCHAR(255) NULL,
  sku VARCHAR(120) NULL,
  unit VARCHAR(40) NULL,
  hsn_code VARCHAR(40) NULL,
  qty INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  line_total DECIMAL(14,2)
    GENERATED ALWAYS AS (qty * unit_price) STORED,
  gross_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  net_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  taxable_value DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  gst_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  cgst_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  sgst_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  igst_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (id),
  KEY idx_invoice_lines_invoice (invoice_id),
  KEY idx_invoice_lines_product (product_id),
  CONSTRAINT fk_invoice_lines_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_invoice_lines_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT chk_invoice_lines_qty CHECK (qty > 0),
  CONSTRAINT chk_invoice_lines_unit_price CHECK (unit_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6) Location tables
CREATE TABLE IF NOT EXISTS locations (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS location_profiles (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS location_saved (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS location_recent (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS location_suggestions (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7) Storefront profile/cart/checkout/service
CREATE TABLE IF NOT EXISTS wishlists (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS carts (
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
    ON UPDATE CASCADE,
  CONSTRAINT chk_carts_owner
    CHECK ((user_id IS NOT NULL AND guest_id IS NULL) OR (user_id IS NULL AND guest_id IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cart_items (
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
    ON UPDATE CASCADE,
  CONSTRAINT chk_cart_items_unit_price CHECK (unit_price >= 0),
  CONSTRAINT chk_cart_items_qty CHECK (qty > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_orders (
  id VARCHAR(64) NOT NULL,
  order_number VARCHAR(30) NOT NULL,
  user_id VARCHAR(64) NULL,
  guest_id VARCHAR(60) NULL,
  location_id VARCHAR(64) NULL,
  status ENUM('Processing', 'Delivered', 'Cancelled') NOT NULL DEFAULT 'Processing',
  invoice_approval_status ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Approved',
  invoice_requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  invoice_approved_at DATETIME NULL,
  invoice_approved_by VARCHAR(64) NULL,
  invoice_rejected_at DATETIME NULL,
  invoice_rejected_by VARCHAR(64) NULL,
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
  KEY idx_customer_orders_invoice_approval (invoice_approval_status, placed_at),
  CONSTRAINT fk_customer_orders_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_customer_orders_location
    FOREIGN KEY (location_id) REFERENCES locations(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT chk_customer_orders_owner
    CHECK ((user_id IS NOT NULL AND guest_id IS NULL) OR (user_id IS NULL AND guest_id IS NOT NULL)),
  CONSTRAINT chk_customer_orders_subtotal CHECK (subtotal >= 0),
  CONSTRAINT chk_customer_orders_discount CHECK (discount >= 0),
  CONSTRAINT chk_customer_orders_delivery_fee CHECK (delivery_fee >= 0),
  CONSTRAINT chk_customer_orders_total CHECK (total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_order_items (
  id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NULL,
  product_name VARCHAR(200) NOT NULL,
  model VARCHAR(120) NULL,
  capacity VARCHAR(20) NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  qty INT NOT NULL,
  line_total DECIMAL(14,2)
    GENERATED ALWAYS AS (qty * unit_price) STORED,
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
    ON UPDATE CASCADE,
  CONSTRAINT chk_customer_order_items_unit_price CHECK (unit_price >= 0),
  CONSTRAINT chk_customer_order_items_qty CHECK (qty > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_methods (
  id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  method_type ENUM('COD', 'UPI', 'CARD', 'NETBANKING') NOT NULL,
  label VARCHAR(80) NOT NULL,
  detail VARCHAR(160) NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  default_slot TINYINT
    GENERATED ALWAYS AS (
      CASE WHEN is_default = 1 AND is_active = 1 THEN 1 ELSE NULL END
    ) STORED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_methods_single_default (user_id, default_slot),
  KEY idx_payment_methods_user (user_id),
  CONSTRAINT fk_payment_methods_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS installation_requests (
  id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64) NULL,
  status ENUM('Pending', 'Scheduled', 'Resolved') NOT NULL DEFAULT 'Pending',
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  scheduled_at DATETIME NULL,
  resolved_at DATETIME NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS warranty_claims (
  id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64) NULL,
  product_id VARCHAR(64) NULL,
  status ENUM('Submitted', 'Approved', 'Rejected') NOT NULL DEFAULT 'Submitted',
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_feedback (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
