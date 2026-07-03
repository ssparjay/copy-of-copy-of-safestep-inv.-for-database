import { Product, ScanSession, InventoryRecord, StoreInventoryRecord, DiscrepancyReport } from '../types';

const DB_NAME = 'SafeStepWarehouseDB';
const DB_VERSION = 4;

class WarehouseDB {
  private db: IDBDatabase | null = null;

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('app_state')) {
          db.createObjectStore('app_state');
        }
      };

      request.onsuccess = (event: any) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async getFromStore(key: string): Promise<any[]> {
    const db = await this.open();

    return new Promise((resolve) => {
      const tx = db.transaction(['app_state'], 'readonly');
      const store = tx.objectStore('app_state');
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  }

  private async saveToStore(key: string, data: any[]): Promise<void> {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['app_state'], 'readwrite');
      const store = tx.objectStore('app_state');

      const request = store.put(data, key);

      request.onerror = () => {
        console.error('IndexedDB write failed:', request.error);
        reject(request.error);
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async initialize() {
    return {
      products: await this.getFromStore('products'),
      sessions: await this.getFromStore('sessions'),
      inventory: await this.getFromStore('inventory'),
      storeInventory: await this.getFromStore('storeInventory'),
      discrepancies: await this.getFromStore('discrepancies'),
    };
  }

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

  async pushToCloud(vaultKey: string, state: any): Promise<boolean> {
    try {
      const response = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultKey, state }),
      });

      return response.ok;
    } catch (e) {
      console.error('Cloud push failed:', e);
      return false;
    }
  }

  async fetchFromCloud(vaultKey: string): Promise<any | null> {
    try {
      const res = await fetch(`/api/sync/fetch?vaultKey=${encodeURIComponent(vaultKey)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('Cloud fetch failed:', e);
      return null;
    }
  }
}

export const db = new WarehouseDB();