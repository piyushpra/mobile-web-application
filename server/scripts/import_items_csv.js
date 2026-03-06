#!/usr/bin/env node

const fs = require('fs');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const { config } = require('../config');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    if (ch === '\r') {
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map(cell => String(cell || '').trim());

  return rows.slice(1).map(cols => {
    const out = {};
    for (let i = 0; i < headers.length; i += 1) {
      out[headers[i]] = String(cols[i] || '').trim();
    }
    return out;
  });
}

function parseMoney(value) {
  const cleaned = String(value || '')
    .replace(/,/g, '')
    .replace(/[^0-9.-]/g, '');
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : NaN;
}

function parseTaxRate(row) {
  const candidates = [
    row['Tax1 Percentage'],
    row['Intra State Tax Rate'],
    row['Inter State Tax Rate'],
  ];
  for (const raw of candidates) {
    const num = Number(raw);
    if (Number.isFinite(num) && num >= 0) {
      return num;
    }
  }
  return 0;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function truncateLabel(value, max = 40) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

function buildDummyImageUrl(bg, fg, text) {
  return `https://dummyimage.com/900x600/${bg}/${fg}.png&text=${encodeURIComponent(text)}`;
}

function buildBatteryImages(item) {
  const brand = truncateLabel(item.brand || 'Battery', 18);
  const model = truncateLabel(item.name, 40);
  const code = truncateLabel(`HSN/SAC ${item.sku}`, 26);
  return [
    buildDummyImageUrl('1f2937', 'f9fafb', `${brand} Battery`),
    buildDummyImageUrl('0f766e', 'ecfeff', model),
    buildDummyImageUrl('1d4ed8', 'dbeafe', code),
  ];
}

function deriveBrand(itemName) {
  const first = String(itemName || '').trim().split(/\s+/)[0];
  return first || '';
}

function deriveCategory(hsnSac) {
  const code = String(hsnSac || '').trim();
  if (code === '8506') return 'battery';
  if (code === '8504') return 'inverter';
  return 'Misc';
}

function buildProductId(rawItemId, index) {
  const cleaned = String(rawItemId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '');

  if (!cleaned) {
    return `csv_row_${index + 1}_${crypto.randomUUID().slice(0, 8)}`;
  }

  const candidate = `csv_${cleaned}`;
  if (candidate.length <= 64) {
    return candidate;
  }

  return `csv_${crypto.createHash('sha1').update(cleaned).digest('hex').slice(0, 60)}`;
}

function toProductRow(row, index) {
  const name = String(row['Item Name'] || '').trim();
  if (!name) return null;

  const hsnSac = String(row['HSN/SAC'] || '').trim();
  const sku = hsnSac || `HSN-SAC-${index + 1}`;
  const rate = parseMoney(row.Rate);
  const amount = Number.isFinite(rate) && rate > 0 ? round2(rate) : round2(randomInt(1000, 50000));
  const qty = randomInt(1, 50);
  const reorderPoint = randomInt(3, 15);

  return {
    id: buildProductId(row['Item ID'], index),
    itemType: String(row['Product Type'] || 'goods').trim() || 'goods',
    name,
    model: name,
    capacityAh: '150Ah',
    sku,
    category: deriveCategory(hsnSac),
    unit: String(row['Usage unit'] || '').trim() || 'pcs',
    brand: deriveBrand(name),
    description: String(row.Description || '').trim(),
    hsnCode: sku,
    taxRate: round2(parseTaxRate(row)),
    location: 'Unassigned',
    qtyOnHand: qty,
    reorderPoint,
    purchasePrice: amount,
    sellingPrice: amount,
    updatedAt: new Date(),
  };
}

async function main() {
  const csvPath = process.argv[2] || '/Users/piyush/Downloads/Item.csv';
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const rawRows = parseCsv(csvText);
  const items = rawRows.map(toProductRow).filter(Boolean);

  if (items.length === 0) {
    throw new Error('No valid rows found in CSV');
  }

  const connection = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
  });

  const insertSql = `
    INSERT INTO products
      (id, item_type, name, model, capacity_ah, sku, category, unit, brand, description, hsn_code, tax_rate, location,
       qty_on_hand, reorder_point, purchase_price, selling_price, is_active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    ON DUPLICATE KEY UPDATE
      item_type = VALUES(item_type),
      name = VALUES(name),
      model = VALUES(model),
      capacity_ah = VALUES(capacity_ah),
      sku = VALUES(sku),
      category = VALUES(category),
      unit = VALUES(unit),
      brand = VALUES(brand),
      description = VALUES(description),
      hsn_code = VALUES(hsn_code),
      tax_rate = VALUES(tax_rate),
      location = VALUES(location),
      qty_on_hand = VALUES(qty_on_hand),
      reorder_point = VALUES(reorder_point),
      purchase_price = VALUES(purchase_price),
      selling_price = VALUES(selling_price),
      is_active = 1,
      updated_at = VALUES(updated_at)
  `;

  const upsertImageSql = `
    INSERT INTO product_images (id, product_id, image_url, sort_order, is_primary)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      image_url = VALUES(image_url),
      sort_order = VALUES(sort_order),
      is_primary = VALUES(is_primary)
  `;

  const deleteImagesSql = `DELETE FROM product_images WHERE product_id = ?`;

  let inserted = 0;
  let batteryImagesAttached = 0;
  try {
    await connection.beginTransaction();
    for (const item of items) {
      await connection.query(insertSql, [
        item.id,
        item.itemType,
        item.name,
        item.model,
        item.capacityAh,
        item.sku,
        item.category,
        item.unit,
        item.brand,
        item.description || null,
        item.hsnCode,
        item.taxRate,
        item.location,
        item.qtyOnHand,
        item.reorderPoint,
        item.purchasePrice,
        item.sellingPrice,
        item.updatedAt,
      ]);
      inserted += 1;

      if (item.category === 'battery') {
        const images = buildBatteryImages(item);
        await connection.query(deleteImagesSql, [item.id]);
        for (let idx = 0; idx < images.length; idx += 1) {
          const imageId = `img_${crypto.createHash('sha1').update(`${item.id}_${idx + 1}`).digest('hex').slice(0, 24)}`;
          await connection.query(upsertImageSql, [
            imageId,
            item.id,
            images[idx],
            idx + 1,
            idx === 0 ? 1 : 0,
          ]);
        }
        batteryImagesAttached += 1;
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }

  console.log(`Imported ${inserted} items from ${csvPath} and attached generated images to ${batteryImagesAttached} battery items`);
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
