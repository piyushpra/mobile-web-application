import { Platform } from 'react-native';

import type { ItemTechnologyOption, ModuleId, Theme } from './types';

export const theme: Theme = {
  bg: '#F5F7F3',
  panel: '#FFFFFF',
  panelSoft: '#F8FAF7',
  steel: '#E6ECE2',
  primary: '#2F6FA3',
  accent: '#5F9D67',
  orange: '#F28C38',
  text: '#1F2A37',
  subtext: '#6B7280',
  danger: '#D66A6A',
  warning: '#D4A938',
};

export const darkTheme: Theme = {
  bg: '#0B1220',
  panel: '#111827',
  panelSoft: '#1F2937',
  steel: '#334155',
  primary: '#60A5FA',
  accent: '#4ADE80',
  orange: '#FB923C',
  text: '#F8FAFC',
  subtext: '#94A3B8',
  danger: '#F87171',
  warning: '#FACC15',
};

export const API_BASE = Platform.select({
  android: 'http://13.235.49.124',
  ios: 'http://13.235.49.124',
  default: 'http://13.235.49.124',
});
export const APP_CURRENT_VERSION = '1.0.0';
export const APP_UPDATE_APP_ID = 'com.mobile';
export const APP_UPDATE_CHANNEL = 'production';
export const ITEM_CATEGORY_OPTIONS = ['Battery', 'Inverter', 'Miscellaneous'];
export const DEFAULT_ITEM_CATEGORY = 'Inverter';
export const ITEM_TECHNOLOGY_OPTIONS: ItemTechnologyOption[] = ['Sinewave', 'Eco Watt', 'Advanced Digital'];
export const DEFAULT_ITEM_TECHNOLOGY: ItemTechnologyOption = 'Sinewave';

export const LANDING_HERO_IMAGE = require('../assets/images/land-page-bg.png');
export const APP_LOGO_IMAGE = require('../assets/images/icon.png');
export const FUELECTRIC_LOGO_IMAGE = require('../assets/images/fuelectric-3.png');
export const FOOTER_LOGO_IMAGE = require('../assets/images/footer-logo.png');

export const modules: Array<{ id: ModuleId; label: string }> = [
  { id: 'home', label: '🏠' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'items', label: 'Items' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'customers', label: 'Customers' },
  { id: 'purchases', label: 'PO' },
  { id: 'sales', label: 'SO' },
  { id: 'bills', label: 'Bills' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'stock', label: 'Stock' },
];
