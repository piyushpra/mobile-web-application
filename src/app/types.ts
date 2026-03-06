export type Role = 'admin' | 'manager' | 'staff';

export type ModuleId =
  | 'home'
  | 'dashboard'
  | 'items'
  | 'suppliers'
  | 'customers'
  | 'purchases'
  | 'sales'
  | 'bills'
  | 'invoices'
  | 'stock';

export type AuthMode = 'none' | 'login' | 'register';
export type PublicView = 'landing' | 'categories' | 'categoryProducts' | 'list' | 'auth' | 'cart' | 'feedback';
export type LandingCategory = 'inverters' | 'batteries' | 'accessories';
export type ViewMoreContext = 'category' | 'featured' | 'all';
export type ProfilePanel = 'orders' | 'wishlist' | 'payments' | 'notifications' | 'installation' | 'warranty' | 'language';

export type Theme = {
  bg: string;
  panel: string;
  panelSoft: string;
  steel: string;
  primary: string;
  accent: string;
  orange: string;
  text: string;
  subtext: string;
  danger: string;
  warning: string;
};

export type User = { id: string; username: string; role: Role; name: string };

export type Item = {
  id: string;
  name: string;
  sku: string;
  images?: string[];
  tags?: string[];
  capacityAh?: string;
  category: string;
  unit: string;
  brand: string;
  qty: number;
  reorderPoint: number;
  purchasePrice: number;
  sellingPrice: number;
  status: 'In Stock' | 'Low Stock' | 'Critical';
};

export type PublicStockItem = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  qty: number;
  status: 'In Stock' | 'Low Stock' | 'Critical';
  location: string;
};

export type PublicProduct = {
  id: string;
  name: string;
  model: string;
  brand: string;
  category: string;
  tags?: string[];
  shortDescription: string;
  thumbnail: string;
  purchasePrice?: number;
  sellingPrice?: number;
  discountPct?: number;
};

export type DeliveryLocation = {
  id: string;
  label: string;
  area?: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  lat?: number | null;
  lng?: number | null;
  source?: string;
};

export type CartItem = {
  id: string;
  productId: string;
  name: string;
  model: string;
  capacity: string;
  thumbnail: string;
  qty: number;
  unitPrice: number;
};

export type PublicProductDetail = {
  id: string;
  name: string;
  model: string;
  brand: string;
  category: string;
  tags?: string[];
  description: string;
  images: string[];
  availableCapacities?: string[];
  purchasePrice?: number;
  sellingPrice?: number;
  discountPct?: number;
  specifications: {
    sku: string;
    unit: string;
    location: string;
    hsnCode: string;
    taxRate: number;
  };
};

export type Party = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  gstin: string;
};

export type Doc = {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  dueDate?: string;
  poNumber?: string;
  soNumber?: string;
  billNumber?: string;
  invoiceNumber?: string;
  vendor?: string;
  customer?: string;
  supplierName?: string;
  customerName?: string;
  lines: Array<{ itemName: string; qty: number }>;
};

export type Movement = {
  id: string;
  itemName: string;
  type: string;
  delta: number;
  reason: string;
  balanceAfter: number;
};

export type ProfileOrder = {
  id: string;
  createdAt: string;
  itemCount: number;
  total: number;
  status: 'Processing' | 'Delivered' | 'Cancelled';
  productId?: string | null;
  brand?: string;
  category?: string;
  model?: string;
  thumbnail?: string;
};

export type ProfilePaymentMethod = {
  id: string;
  label: string;
  detail: string;
  isDefault: boolean;
};

export type ProfileServiceRequest = {
  id: string;
  createdAt: string;
  status: 'Pending' | 'Scheduled' | 'Resolved';
  note: string;
};

export type ProfileWarrantyClaim = {
  id: string;
  createdAt: string;
  status: 'Submitted' | 'Approved' | 'Rejected';
  note: string;
};

export type FeedbackOrderItem = {
  orderId: string;
  orderNumber: string;
  orderItemId: string;
  productId: string | null;
  productName: string;
  model: string;
  capacity: string;
  placedAt: string;
};

export type Overview = {
  itemsCount: number;
  totalUnits: number;
  lowStockCount: number;
  inventoryValue: number;
  pendingPurchaseOrders: number;
  pendingSalesOrders: number;
  movementCount: number;
  suppliersCount: number;
  customersCount: number;
  openBills: number;
  openInvoices: number;
};
