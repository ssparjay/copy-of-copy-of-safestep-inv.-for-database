import {
  Product,
  ScanSession,
  InventoryRecord,
  StoreInventoryRecord,
  DiscrepancyReport,
} from '../types';

const DB_NAME = 'SafeStepWarehouseDB';
const DB_VERSION = 4;
const STORE_NAME = 'app_state';

class WarehouseDB {
  private db: IDBDatabase | null = null;
  private syncChannel = new BroadcastChannel('safestep_sync_engine');

  /**
   * Open IndexedDB safely (single instance)
   */
  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (event: any) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event: any) => {
        reject(event.target.error);
      };
    });
  }

  /**
   * Read data from IndexedDB safely
   */
  private async getFromStore<T>(key: string): Promise<T[]> {
    const db = await this.open();

    return new Promise((resolve) => {
      const tx = db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(Array.isArray(result) ? result : []);
      };

      request.onerror = () => resolve([]);
    });
  }

  /**
   * Save data safely to IndexedDB
   */
  private async saveToStore<T>(key: string, data: T[]): Promise<void> {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const request = store.put(data || [], key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * IMPORTANT: Call this on app startup
   */
  async initialize() {
    await this.open();

    return {
      products: await this.getFromStore<Product>('products'),
      sessions: await this.getFromStore<ScanSession>('sessions'),
      inventory: await this.getFromStore<InventoryRecord>('inventory'),
      storeInventory: await this.getFromStore<StoreInventoryRecord>('storeInventory'),
      discrepancies: await this.getFromStore<DiscrepancyReport>('discrepancies'),
    };
  }

  // =========================
  // SAVE METHODS
  // =========================

  async saveProducts(data: Product[]) {
    return this.saveToStore('products', data);
  }

  async saveSessions(data: ScanSession[]) {
    return this.saveToStore('sessions', data);
  }

  async saveInventory(data: InventoryRecord[]) {
    return this.saveToStore('inventory', data);
  }

  async saveStoreInventory(data: StoreInventoryRecord[]) {
    return this.saveToStore('storeInventory', data);
  }

  async saveDiscrepancies(data: DiscrepancyReport[]) {
    return this.saveToStore('discrepancies', data);
  }

  /**
   * Restore full state (cloud or backup import)
   */
  async restoreState(data: any) {
    if (!data) return;

    await Promise.all([
      this.saveProducts(data.products || []),
      this.saveSessions(data.sessions || []),
      this.saveInventory(data.inventory || []),
      this.saveStoreInventory(data.storeInventory || []),
      this.saveDiscrepancies(data.discrepancies || []),
    ]);
  }

  // =========================
  // CLOUD SYNC (NEON API)
  // =========================

  async pushToCloud(vaultKey: string, state: any): Promise<boolean> {
    try {
      const payload = {
        ...state,
        lastPush: new Date().toISOString(),
      };

      const response = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaultKey,
          state: payload,
        }),
      });

      return response.ok;
    } catch (e) {
      console.error('Cloud push failed:', e);
      return false;
    }
  }

  async fetchFromCloud(vaultKey: string): Promise<any | null> {
    try {
      const response = await fetch(
        `/api/sync/fetch?vaultKey=${encodeURIComponent(vaultKey)}`
      );

      if (!response.ok) return null;

      return await response.json();
    } catch (e) {
      console.error('Cloud fetch failed:', e);
      return null;
    }
  }

  // =========================
  // EXPORT
  // =========================

  async exportMasterSnapshot(): Promise<string> {
    const state = await this.initialize();
    return JSON.stringify(state);
  }

  async generateSQLiteDump(): Promise<string> {
    const state = await this.initialize();

    let sql = `-- SafeStep Warehouse Dump\n-- Generated: ${new Date().toISOString()}\n\n`;

    sql += `CREATE TABLE IF NOT EXISTS products (
      barcode TEXT PRIMARY KEY,
      itemCode TEXT,
      description TEXT,
      category TEXT,
      rrp REAL,
      stock INTEGER
    );\n\n`;

    state.products.forEach((p) => {
      sql += `INSERT OR REPLACE INTO products VALUES (
        '${p.barcode}',
        '${p.itemCode.replace(/'/g, "''")}',
        '${p.description.replace(/'/g, "''")}',
        '${p.category}',
        ${p.rrp},
        ${p.stock}
      );\n`;
    });

    return sql;
  }
}

export const db = new WarehouseDB();