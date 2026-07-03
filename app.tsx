import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Package, ScanLine, Menu,
  LogOut, BarChart3, Store, Search,
  Link as LinkIcon, Share2, Globe, CheckCircle2, Database, Zap
} from 'lucide-react';

import {
  Page, Product, ScanSession, User,
  InventoryRecord, StoreInventoryRecord,
  DiscrepancyReport, ActivityLog,
  CloudSyncConfig, ScanItem
} from './types';

import { INITIAL_PRODUCTS } from './constants';
import { db } from './services/database';

import Dashboard from './components/Dashboard';
import ProductMaster from './components/ProductMaster';
import InventoryScanning from './components/InventoryScanning';
import Reports from './components/Reports';
import StoresInventory from './components/StoresInventory';
import Login from './components/Login';
import Finder from './components/Finder';

/* ================= USERS ================= */
const DEFAULT_USERS: User[] = [
  { id: '1', name: 'System Admin', role: 'Admin', initials: 'SA', color: 'from-blue-600 to-indigo-600', password: 'admin#011' },
  { id: '2', name: 'John Operator', role: 'Operator', initials: 'JO', color: 'from-emerald-500 to-teal-600', password: '123' },
  { id: '3', name: 'Store Promoter', role: 'Promoter', initials: 'SP', color: 'from-amber-500 to-orange-600', password: '123' }
];

/* ================= LOGO ================= */
const SafeStepLogo = () => (
  <div className="flex items-center space-x-3">
    <div className="text-blue-600 font-black text-xl">SafeStep</div>
  </div>
);

/* ================= APP ================= */
const App: React.FC = () => {

  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>(Page.DASHBOARD);

  /* ===== DATA STATE ===== */
  const [products, setProducts] = useState<Product[]>([]);
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [storeInventory, setStoreInventory] = useState<StoreInventoryRecord[]>([]);
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyReport[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  /* ================= LOAD DATA ================= */
  const loadAppData = async () => {
    try {
      const data = await db.initialize();

      // ✅ FIX: NEVER fallback to INITIAL_PRODUCTS
      setProducts(data.products || []);
      setSessions(data.sessions || []);
      setInventory(data.inventory || []);
      setStoreInventory(data.storeInventory || []);
      setDiscrepancies(data.discrepancies || []);

      const savedUser = localStorage.getItem('lastUserId');
      if (savedUser) {
        const user = DEFAULT_USERS.find(u => u.id === savedUser);
        if (user) {
          setCurrentUser(user);
          setIsAuthenticated(true);
        }
      }

    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setIsInitializing(false);
    }
  };

  /* ================= INIT ================= */
  useEffect(() => {
    loadAppData();
  }, []);

  /* ================= AUTO SAVE (🔥 FIX) ================= */
  useEffect(() => {
    db.saveProducts(products);
  }, [products]);

  useEffect(() => {
    db.saveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    db.saveInventory(inventory);
  }, [inventory]);

  useEffect(() => {
    db.saveStoreInventory(storeInventory);
  }, [storeInventory]);

  useEffect(() => {
    db.saveDiscrepancies(discrepancies);
  }, [discrepancies]);

  /* ================= SESSION COMPLETE ================= */
  const handleCompleteSession = (session: ScanSession) => {
    setSessions(prev => [session, ...prev]);

    setInventory(prev => {
      const updated = [...prev];

      session.items.forEach(item => {
        const index = updated.findIndex(
          r => r.barcode === item.barcode && r.location === session.location
        );

        if (index >= 0) {
          updated[index].quantity += item.quantity;
        } else {
          updated.push({
            barcode: item.barcode,
            itemCode: item.itemCode,
            location: session.location,
            boxId: session.boxId || '0',
            quantity: item.quantity
          });
        }
      });

      return updated;
    });
  };

  /* ================= LOGIN ================= */
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('lastUserId', user.id);
  };

  if (isInitializing) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-pulse flex items-center space-x-2">
          <Database />
          <span>Loading SafeStep...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login users={DEFAULT_USERS} onLogin={handleLogin} />;
  }

  /* ================= UI ================= */
  return (
    <div className="h-screen flex">
      
      {/* SIDEBAR */}
      <div className="w-64 bg-slate-900 text-white p-4">
        <SafeStepLogo />

        <nav className="mt-6 space-y-2">
          <button onClick={() => setCurrentPage(Page.DASHBOARD)}>Dashboard</button>
          <button onClick={() => setCurrentPage(Page.SCANNING)}>Scan</button>
          <button onClick={() => setCurrentPage(Page.PRODUCT_MASTER)}>Products</button>
          <button onClick={() => setCurrentPage(Page.REPORTS)}>Reports</button>
        </nav>
      </div>

      {/* MAIN */}
      <div className="flex-1 p-6 overflow-auto">

        {currentPage === Page.DASHBOARD && (
          <Dashboard
            products={products}
            sessions={sessions}
            discrepancies={discrepancies}
            storeInventory={storeInventory}
            activities={activities}
          />
        )}

        {currentPage === Page.PRODUCT_MASTER && (
          <ProductMaster
            products={products}
            inventory={inventory}
            sessions={sessions}
            onAddProduct={(p) => setProducts(prev => [...prev, p])}
            onDeleteProduct={(b) => setProducts(p => p.filter(x => x.barcode !== b))}
            onUpdateProduct={(b, u) =>
              setProducts(p => p.map(x => x.barcode === b ? { ...x, ...u } : x))
            }
          />
        )}

        {currentPage === Page.SCANNING && (
          <InventoryScanning
            isActive={true}
            products={products}
            inventory={inventory}
            sessions={sessions}
            onCompleteSession={handleCompleteSession}
            currentUser={currentUser!}
          />
        )}

        {currentPage === Page.REPORTS && (
          <Reports products={products} sessions={sessions} />
        )}

      </div>
    </div>
  );
};

export default App;