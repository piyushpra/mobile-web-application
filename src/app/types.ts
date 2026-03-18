export type Role = 'admin' | 'manager' | 'staff' | 'customer';
export type ItemTechnologyOption =
  | 'Sinewave'
  | 'Eco Watt'
  | 'Advanced Digital'
  | 'Tall Tubular'
  | 'Jumboz Tubular'
  | 'Jumboz Short Tubular'
  | 'Super Jumboz Tubular';

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

export type AuthMode = 'none' | 'login' | 'register' | 'forgot';
export type PublicView = 'landing' | 'categories' | 'categoryProducts' | 'list' | 'offers' | 'auth' | 'cart' | 'feedback';
export type LandingCategory = 'inverters' | 'batteries' | 'accessories';
export type ViewMoreContext = 'category' | 'featured' | 'all';
export type ProfilePanel =
  | 'orders'
  | 'wishlist'
  | 'payments'
  | 'notifications'
  | 'installation'
  | 'warranty'
  | 'language'
  | 'orderRequests'
  | 'seller'
  | 'apiHealth';

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
  model?: string;
  images?: string[];
  tags?: string[];
  capacityAh?: string;
  technologyOption?: ItemTechnologyOption;
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
  technologyOption?: ItemTechnologyOption;
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
  technologyOption?: ItemTechnologyOption;
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
  billingAddress?: string;
  shippingAddress?: string;
};

export type InvoiceLine = {
  id?: string;
  itemId?: string | null;
  itemName: string;
  description?: string;
  sku?: string;
  unit?: string;
  hsnCode?: string;
  qty: number;
  unitPrice: number;
  taxRate?: number;
  grossAmount?: number;
  discountAmount?: number;
  netAmount?: number;
  lineTotal: number;
  taxableValue?: number;
  gstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
};

export type InvoiceDetail = {
  id: string;
  orderId?: string;
  orderNumber?: string;
  invoiceNumber: string;
  customerId?: string;
  customerName?: string;
  status: string;
  dueDate?: string;
  total: number;
  createdAt: string;
  paidAt?: string;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  taxableTotal: number;
  gstTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  roundOff?: number;
  billToName: string;
  billToPhone?: string;
  billToEmail?: string;
  billToGstin?: string;
  billToAddress?: string;
  shipToAddress?: string;
  placeOfSupply?: string;
  sellerName: string;
  sellerGstin?: string;
  sellerAddress?: string;
  sellerState?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  sellerWebsite?: string;
  sellerPan?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankBranch?: string;
  declarationNote?: string;
  footerNote?: string;
  pricesIncludeGst: boolean;
  amountInWords: string;
  lines: InvoiceLine[];
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
  subtotal?: number;
  discount?: number;
  deliveryFee?: number;
  taxableTotal?: number;
  gstTotal?: number;
  cgstTotal?: number;
  sgstTotal?: number;
  igstTotal?: number;
  roundOff?: number;
  billToName?: string;
  billToPhone?: string;
  billToEmail?: string;
  billToGstin?: string;
  billToAddress?: string;
  shipToAddress?: string;
  placeOfSupply?: string;
  sellerName?: string;
  sellerGstin?: string;
  sellerAddress?: string;
  sellerState?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  sellerWebsite?: string;
  sellerPan?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankBranch?: string;
  declarationNote?: string;
  footerNote?: string;
  amountInWords?: string;
  orderId?: string;
  orderNumber?: string;
  lines: Array<{
    id?: string;
    itemId?: string | null;
    itemName: string;
    description?: string;
    sku?: string;
    unit?: string;
    qty: number;
    unitPrice?: number;
    unitCost?: number;
    lineTotal?: number;
    hsnCode?: string;
    taxRate?: number;
    grossAmount?: number;
    discountAmount?: number;
    netAmount?: number;
    taxableValue?: number;
    gstAmount?: number;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
  }>;
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
  orderNumber: string;
  createdAt: string;
  itemCount: number;
  total: number;
  subtotal?: number;
  discount?: number;
  deliveryFee?: number;
  status: 'Processing' | 'Delivered' | 'Cancelled';
  productId?: string | null;
  brand?: string;
  category?: string;
  model?: string;
  thumbnail?: string;
  invoiceApprovalStatus?: 'Pending' | 'Approved' | 'Rejected';
  invoiceRequestedAt?: string;
  invoiceApprovedAt?: string | null;
  invoiceRejectedAt?: string | null;
  items: Array<{
    id: string;
    productId?: string | null;
    name: string;
    brand?: string;
    category?: string;
    model?: string;
    capacity?: string;
    qty: number;
    unitPrice?: number;
    lineTotal?: number;
    thumbnail?: string;
  }>;
  invoice?: InvoiceDetail | null;
};

export type AdminOrderRequest = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  itemCount: number;
  total: number;
  placedAt: string;
  invoiceNumber?: string;
  invoiceApprovalStatus: 'Pending' | 'Approved' | 'Rejected';
  invoiceRequestedAt?: string;
  invoiceApprovedAt?: string | null;
  invoiceRejectedAt?: string | null;
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

export type SellerBillingSettings = {
  sellerName: string;
  sellerGstin: string;
  sellerAddress: string;
  sellerState: string;
  sellerPhone?: string;
  sellerEmail?: string;
  sellerWebsite?: string;
  sellerPan?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankBranch?: string;
  declarationNote?: string;
  footerNote?: string;
};

export type AdminApiHealthStatus = {
  status: 'ok' | 'degraded';
  checkedAt: string;
  server: {
    status: 'ok';
    timestamp: string;
    uptimeSeconds: number | null;
    nodeVersion: string;
    appName: string;
  };
  database: {
    status: 'ok' | 'error';
    latencyMs: number | null;
    message: string;
  };
  auth: {
    userId: string;
    role: Role;
    username: string;
  };
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
