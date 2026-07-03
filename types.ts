
export interface User {
  id: string;
  name: string;
  role: 'Admin' | 'Operator' | 'Promoter';
  initials: string;
  color: string;
  password?: string;
}

export interface CloudSyncConfig {
  vaultKey: string;
  lastSync: string;
  status: 'connected' | 'disconnected' | 'syncing' | 'error';
  terminalId: string;
}

export interface Product {
  barcode: string;
  itemCode: string;
  description: string;
  category: string;
  brand: string;
  outsole: string;
  stock: number;
  location: string;
  rrp: number;
  skuFamily?: string; 
  smItemCode?: string;
  robinsonsItemCode?: string;
  kccItemCode?: string;
  centroItemCode?: string;
  staLuciaItemCode?: string;
  landmarkItemCode?: string;
  rustansItemCode?: string;
  sportsCentralItemCode?: string;
  islandMallItemCode?: string;
  gaisanoGrandItemCode?: string;
  gaisanoFiestaItemCode?: string;
  metroItemCode?: string; 
}

export interface InventoryRecord {
  barcode: string;
  itemCode: string;
  location: string;
  boxId: string;
  quantity: number;
}

export interface StoreInventoryRecord {
  id: string;
  storeName: string;
  barcode: string;
  itemCode: string;
  description: string;
  quantity: number;
  status: 'Pending Validation' | 'Validated' | 'Discrepancy';
  lastUpdated: string;
  drNumber?: string;
}

export interface DiscrepancyReport {
  id: string;
  storeName: string;
  barcode: string;
  itemCode: string;
  reportedBy: string;
  issueType: 'Missing' | 'Wrong Item' | 'Damaged';
  expectedQty: number;
  actualQty: number;
  timestamp: string;
  status: 'Open' | 'Resolved';
  adminNotes?: string;
}

export interface ScanItem {
  id: string;
  barcode: string;
  itemCode: string;
  description: string;
  quantity: number;
  timestamp: string;
  location: string; 
  boxId: string;    
  originBoxId?: string; 
  // Added rrp to support historical price tracking in scan sessions
  rrp?: number;
}

export interface ScanSession {
  id: string;
  location: string; 
  boxId: string;    
  items: ScanItem[];
  createdAt: string;
  userId: string;
  userName: string;
  status?: string;
  type: 'INBOUND' | 'OUTBOUND';
  recipientName?: string;
  deliveryAddress?: string;
  deliveryDate?: string;
  vendorCode?: string;
  branchCode?: string;
  drNumber?: string;
  poNumber?: string;
  via?: string;
  viaAddress?: string;
  authorizedBy?: string;
  logisticPersonnel?: string;
  personnelSignature?: string; 
  safestepLogo?: string;
  antaLogo?: string;
  targetVendor?: 'SM' | 'ROBINSON' | 'KCC' | 'CENTRO' | 'STA_LUCIA' | 'LANDMARK' | 'RUSTANS' | 'SPORTS_CENTRAL' | 'ISLAND_MALL' | 'GAISANO_GRAND' | 'GAISANO_FIESTA' | 'GENERAL' | 'METRO';
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  action: string;
  details: string;
  timestamp: string;
  terminalId?: string;
}

export interface SyncPacket {
  type: 'SESSION_CREATED' | 'PRODUCT_UPDATED' | 'DISCREPANCY_REPORTED';
  data: any;
  senderId: string;
  terminalId: string;
  timestamp: string;
}

export enum Page {
  DASHBOARD = 'dashboard',
  PRODUCT_MASTER = 'product-master',
  SCANNING = 'scanning',
  STORES_INVENTORY = 'stores-inventory',
  REPORTS = 'reports',
  FINDER = 'finder'
}
