import type { DeliveryLocation, PublicProduct, PublicProductDetail } from '../types';

export const ALL_CAPACITY_OPTIONS = ['110Ah', '120Ah', '150Ah', '200Ah', '220Ah'] as const;

const normalizeCapacityLabel = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  const preset = ALL_CAPACITY_OPTIONS.find(option => option.toLowerCase() === raw.toLowerCase());
  if (preset) {
    return preset;
  }
  const compact = raw.replace(/\s+/g, '');
  const numericMatch = compact.match(/^(\d{2,4})(?:ah)?$/i);
  if (numericMatch?.[1]) {
    return `${numericMatch[1]}Ah`;
  }
  return raw;
};

const sortCapacityLabels = (values: string[]) =>
  [...values].sort((left, right) => {
    const leftNum = parseInt(left, 10);
    const rightNum = parseInt(right, 10);
    if (Number.isFinite(leftNum) && Number.isFinite(rightNum) && leftNum !== rightNum) {
      return leftNum - rightNum;
    }
    return left.localeCompare(right);
  });

export const getOfferLabel = (product: PublicProduct): string | null => {
  const source = `${product.shortDescription || ''} ${product.model || ''}`.trim();
  if (!source) {
    return null;
  }
  const percentMatch = source.match(/(\d{1,2}%\s*off)/i);
  if (percentMatch?.[1]) {
    return percentMatch[1].toUpperCase().replace(/\s+/g, ' ');
  }
  if (/hot\s*deal/i.test(source)) {
    return 'Hot Deal';
  }
  if (/deal/i.test(source)) {
    return 'Deal';
  }
  if (/offer/i.test(source)) {
    return 'Offer';
  }
  return null;
};

type ProductPricingSource = Pick<PublicProduct, 'purchasePrice' | 'sellingPrice' | 'discountPct'>;

export const getDetailPrice = (product: ProductPricingSource) => {
  const purchasePrice = Math.max(0, Number(product.purchasePrice || 0));
  const sellingPrice = Math.max(0, Number(product.sellingPrice || 0));
  const base = Math.round(sellingPrice > 0 ? sellingPrice : purchasePrice);
  const mrp = Math.round(purchasePrice > 0 ? purchasePrice : base);
  const derivedDiscountPct =
    purchasePrice > 0 && sellingPrice > 0 && purchasePrice > sellingPrice
      ? Math.round(((purchasePrice - sellingPrice) / purchasePrice) * 100)
      : 0;
  const apiDiscountPct = Math.max(0, Number(product.discountPct || 0));
  const discountPct = Math.round(apiDiscountPct > 0 ? apiDiscountPct : derivedDiscountPct);
  const emi = Math.round(base / 6);
  return { base, mrp, discountPct, emi };
};

export const getAvailableCapacities = (product: PublicProductDetail) => {
  const apiCapacities = Array.isArray(product.availableCapacities)
    ? product.availableCapacities
        .map(cap => normalizeCapacityLabel(cap))
        .filter(Boolean)
    : [];

  if (apiCapacities.length > 0) {
    return sortCapacityLabels(Array.from(new Set(apiCapacities)));
  }

  const merged = `${product.model} ${product.description}`.toLowerCase();
  const inferred = ALL_CAPACITY_OPTIONS.filter(cap => merged.includes(cap.toLowerCase().replace('ah', '')));
  return inferred;
};

export const getCapacityOptions = (product: PublicProductDetail) => {
  const available = getAvailableCapacities(product);
  if (available.length === 0) {
    return [...ALL_CAPACITY_OPTIONS];
  }

  const presetOptions = [...ALL_CAPACITY_OPTIONS];
  const extraAvailable = available.filter(
    cap => !presetOptions.some(option => option.toLowerCase() === cap.toLowerCase()),
  );
  return [...presetOptions, ...sortCapacityLabels(extraAvailable)];
};

export const locationMatchesQuery = (loc: DeliveryLocation, query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const normalizedQ = q.replace(/\s+/g, '');
  const hay = `${loc.label} ${loc.area || ''} ${loc.city || ''} ${loc.state || ''} ${loc.pincode || ''}`.toLowerCase();
  const normalizedHay = hay.replace(/\s+/g, '');
  return hay.includes(q) || normalizedHay.includes(normalizedQ);
};

function normalizeSpaces(value: string) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function toTitleCase(value: string) {
  const cleaned = normalizeSpaces(value).toLowerCase();
  if (!cleaned) return '';
  return cleaned.replace(/\b[a-z]/g, match => match.toUpperCase());
}

function sanitizeDisplayValue(value: string) {
  const cleaned = normalizeSpaces(value);
  if (!cleaned) return '';
  return cleaned.toLowerCase() === 'general' ? '' : cleaned;
}

function inferCategoryLabel(product: {
  category?: string;
  name?: string;
  model?: string;
  shortDescription?: string;
}) {
  const rawCategory = sanitizeDisplayValue(String(product.category || ''));
  const categorySource = `${rawCategory} ${product.name || ''} ${product.model || ''} ${product.shortDescription || ''}`.toLowerCase();
  if (categorySource.includes('battery')) return 'Battery';
  if (categorySource.includes('inverter')) return 'Inverter';
  if (categorySource.includes('accessor')) return 'Accessory';
  return rawCategory ? toTitleCase(rawCategory) : 'Product';
}

function stripLeadingModelWords(model: string, brand: string, category: string) {
  let next = normalizeSpaces(model);
  if (!next) return '';

  const esc = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prefixes = [normalizeSpaces(brand), normalizeSpaces(category), `${normalizeSpaces(brand)} ${normalizeSpaces(category)}`]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const prefix of prefixes) {
    const re = new RegExp(`^${esc(prefix)}\\b\\s*`, 'i');
    next = normalizeSpaces(next.replace(re, ''));
  }
  return next;
}

export const getLandingProductTitle = (
  product: Pick<PublicProduct, 'name' | 'model' | 'brand' | 'category' | 'shortDescription'>,
) => {
  const brand = toTitleCase(sanitizeDisplayValue(String(product.brand || '').trim()));
  const category = inferCategoryLabel(product);
  const rawModel = normalizeSpaces(String(product.model || '').trim() || String(product.name || '').trim());
  const model = stripLeadingModelWords(rawModel, brand, category) || rawModel;
  return normalizeSpaces(`${brand} ${category} ${model}`);
};

export const getLandingProductModel = (
  product: Pick<PublicProduct, 'name' | 'model' | 'brand' | 'category' | 'shortDescription'>,
) => {
  const brand = toTitleCase(sanitizeDisplayValue(String(product.brand || '').trim()));
  const category = inferCategoryLabel(product);
  const rawModel = normalizeSpaces(String(product.model || '').trim() || String(product.name || '').trim());
  return stripLeadingModelWords(rawModel, brand, category) || rawModel;
};
