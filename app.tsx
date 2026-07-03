
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Package, ScanLine, Menu, 
  LogOut, BarChart3, Store, Database, Search,
  DatabaseZap, Zap, Link as LinkIcon, Share2, Globe, CheckCircle2
} from 'lucide-react';
import { Page, Product, ScanSession, User, InventoryRecord, StoreInventoryRecord, DiscrepancyReport, ActivityLog, CloudSyncConfig, ScanItem } from './types';
import { INITIAL_PRODUCTS } from './constants';
import { db } from './services/database';
import Dashboard from './components/Dashboard';
import ProductMaster from './components/ProductMaster';
import InventoryScanning from './components/InventoryScanning';
import Reports from './components/Reports';
import StoresInventory from './components/StoresInventory';
import Login from './components/Login';
import Finder from './components/Finder';

const DEFAULT_USERS: User[] = [
  { id: '1', name: 'System Admin', role: 'Admin', initials: 'SA', color: 'from-blue-600 to-indigo-600', password: 'admin#011' },
  { id: '4', name: 'Danica Peña', role: 'Admin', initials: 'DP', color: 'from-purple-600 to-indigo-600', password: 'admin#011' },
  { id: '2', name: 'John Operator', role: 'Operator', initials: 'JO', color: 'from-emerald-500 to-teal-600', password: '123' },
  { id: '3', name: 'Store Promoter', role: 'Promoter', initials: 'SP', color: 'from-amber-500 to-orange-600', password: '123' }
];

const SafeStepLogo: React.FC<{ className?: string }> = ({ className = "h-10" }) => (
  <div className={`flex items-center space-x-3 ${className}`}>
    <div className="flex flex-col items-center justify-center space-y-[-4px]">
      <svg width="40" height="20" viewBox="0 0 100 50" fill="none" xmlns="http://www.w3.org/2000/svg" className="transform scale-y-[-1]">
        <path d="M5 40C20 35 45 10 95 10V40H5Z" stroke="#2E58A3" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M25 40C30 30 45 15 65 20C75 25 85 35 85 40" stroke="#2E58A3" strokeWidth="4" strokeLinecap="round"/>
      </svg>
      <svg width="40" height="20" viewBox="0 0 100 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 40C20 35 45 10 95 10V40H5Z" stroke="#2E58A3" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M25 40C30 30 45 15 65 20C75 25 85 35 85 40" stroke="#2E58A3" strokeWidth="4" strokeLinecap="round"/>
      </svg>
    </div>
    <div className="flex flex-col leading-none">
      <span className="text-[20px] font-[900] text-slate-900 tracking-tighter uppercase leading-tight">SafeStep</span>
      <span className="text-[14px] font-[700] text-slate-900 tracking-tight leading-tight">Philippines</span>
    </div>
  </div>
);

const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>(Page.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Cloud Sync State
  const [cloudConfig, setCloudConfig] = useState<CloudSyncConfig>({
    vaultKey: localStorage.getItem('safestep_vault_key') || '',
    lastSync: '',
    status: 'disconnected',
    terminalId: `TER-${Math.floor(1000 + Math.random() * 9000)}`
  });
  const [showCloudConnect, setShowCloudConnect] = useState(!localStorage.getItem('safestep_vault_key'));
  const [showCopied, setShowCopied] = useState(false);
  
  // App Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [storeInventory, setStoreInventory] = useState<StoreInventoryRecord[]>([]);
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyReport[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  
  // DRAFT SCAN STATE (LIFTED FOR PERSISTENCE)
  const [draftItems, setDraftItems] = useState<ScanItem[]>([]);
  const [draftLocation, setDraftLocation] = useState('');
  const [draftBoxId, setDraftBoxId] = useState('');
  const [draftScanType, setDraftScanType] = useState<'INBOUND' | 'OUTBOUND'>('INBOUND');
  const [draftDrNumber, setDraftDrNumber] = useState('');
  const [isDraftTerminalActive, setIsDraftTerminalActive] = useState(false);
  const [recipientName, setRecipientName] = useState('');

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Initial Load & URL Detection
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlVault = params.get('vault');
    if (urlVault) {
       localStorage.setItem('safestep_vault_key', urlVault);
       setCloudConfig(prev => ({ ...prev, vaultKey: urlVault }));
       setShowCloudConnect(false);
    }

    const loadAppData = async () => {
      try {
        const data = await db.initialize();
        setProducts(data.products?.length > 0 ? data.products : INITIAL_PRODUCTS);
        setSessions(data.sessions || []);
        setInventory(data.inventory || []);
        setStoreInventory(data.storeInventory || []);
        setDiscrepancies(data.discrepancies || []);
        
        const savedLastUser = localStorage.getItem('lastUserId');
        if (savedLastUser) {
          const user = DEFAULT_USERS.find(u => u.id === savedLastUser);
          if (user) { setCurrentUser(user); setIsAuthenticated(true); }
        }
      } catch (error) { 
        console.error("Initialization error:", error);
      } finally { setIsInitializing(false); }
    };
    loadAppData();
  }, []);

  // GLOBAL CLOUD HANDSHAKE
  useEffect(() => {
    if (cloudConfig.vaultKey && isAuthenticated) {
      const initialPull = async () => {
        setCloudConfig(prev => ({ ...prev, status: 'syncing' }));
        const remoteState = await db.fetchFromCloud(cloudConfig.vaultKey);
        if (remoteState) {
          await db.restoreState(remoteState);
          setProducts(remoteState.products || []);
          setSessions(remoteState.sessions || []);
          setInventory(remoteState.inventory || []);
          setStoreInventory(remoteState.storeInventory || []);
          setDiscrepancies(remoteState.discrepancies || []);
          setCloudConfig(prev => ({ ...prev, status: 'connected', lastSync: remoteState.lastPush }));
        }
      };
      initialPull();
    }
  }, [cloudConfig.vaultKey, isAuthenticated]);

  // LIVE CLOUD SYNC
  useEffect(() => {
    if (!cloudConfig.vaultKey || !isAuthenticated) return;

    const performSync = async () => {
      const remoteState = await db.fetchFromCloud(cloudConfig.vaultKey);
      
      if (remoteState && remoteState.lastPush !== cloudConfig.lastSync) {
        if (remoteState.products) setProducts(remoteState.products);
        if (remoteState.sessions) {
           const newRemoteSessions = remoteState.sessions.filter((rs: any) => !sessions.some(ls => ls.id === rs.id));
           if (newRemoteSessions.length > 0) {
             setSessions(prev => [...newRemoteSessions, ...prev]);
           }
        }
        if (remoteState.inventory) setInventory(remoteState.inventory);
        if (remoteState.storeInventory) setStoreInventory(remoteState.storeInventory);
        if (remoteState.discrepancies) setDiscrepancies(remoteState.discrepancies);
        
        setCloudConfig(prev => ({ ...prev, lastSync: remoteState.lastPush, status: 'connected' }));
      } else {
        setCloudConfig(prev => ({ ...prev, status: 'syncing' }));
        const success = await db.pushToCloud(cloudConfig.vaultKey, {
          products, sessions, inventory, storeInventory, discrepancies
        });
        setCloudConfig(prev => ({ ...prev, status: success ? 'connected' : 'error' }));
      }
    };

    const interval = setInterval(performSync, 10000); 
    return () => clearInterval(interval);
  }, [cloudConfig.vaultKey, cloudConfig.lastSync, products, sessions, inventory, storeInventory, discrepancies, isAuthenticated]);

  const handleConnectCloud = (key: string) => {
    localStorage.setItem('safestep_vault_key', key);
    localStorage.removeItem(`bin_id_${key}`);
    setCloudConfig(prev => ({ ...prev, vaultKey: key, status: 'syncing' }));
    setShowCloudConnect(false);
  };

  const copyShareLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('vault', cloudConfig.vaultKey);
    navigator.clipboard.writeText(url.toString());
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const handleCompleteSession = (session: ScanSession) => {
    setSessions(prev => [session, ...prev]);
    
    // Clear Draft State upon successful finalization
    setDraftItems([]);
    setIsDraftTerminalActive(false);

    setInventory(prevInv => {
      const updatedInv = [...prevInv];
      session.items.forEach(item => {
        const targetLocation = item.location || session.location;
        const targetBoxId = session.type === 'INBOUND' ? (item.boxId || session.boxId) : (item.originBoxId || '0');
        const recordIdx = updatedInv.findIndex(r => r.barcode === item.barcode && r.location === targetLocation && r.boxId === targetBoxId);
        
        if (session.type === 'INBOUND' || session.location === 'IMPORT') {
          if (recordIdx !== -1) updatedInv[recordIdx].quantity += item.quantity;
          else updatedInv.push({ barcode: item.barcode, itemCode: item.itemCode, location: targetLocation, boxId: targetBoxId, quantity: item.quantity });
        } else {
          if (recordIdx !== -1) {
            updatedInv[recordIdx].quantity = Math.max(0, updatedInv[recordIdx].quantity - item.quantity);
            if (updatedInv[recordIdx].quantity === 0) updatedInv.splice(recordIdx, 1);
          }
        }
      });
      return updatedInv;
    });
    
    setActivities(prev => [{
      id: Math.random().toString(),
      userId: currentUser?.id || 'system',
      userName: currentUser?.name || 'System',
      userColor: currentUser?.color || 'from-slate-600 to-slate-800',
      action: session.location === 'IMPORT' ? 'BULK IMPORT' : (session.type === 'INBOUND' ? 'INBOUND SCAN' : 'OUTBOUND DISPATCH'),
      details: `${session.items.length} units processed for ${session.location}`,
      timestamp: new Date().toISOString()
    }, ...prev].slice(0, 50));
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('lastUserId', user.id);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('lastUserId');
  };

  if (isInitializing) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-6">
      <SafeStepLogo className="invert grayscale brightness-[500%] scale-150 mb-10" />
      <div className="flex items-center space-x-3 text-blue-500"><Database className="animate-pulse" size={24} /><span className="text-[10px] font-black uppercase tracking-[0.3em]">SafeStep Global Ledger Initializing...</span></div>
    </div>
  );

  if (!isAuthenticated) return <Login users={DEFAULT_USERS} onLogin={handleLogin} />;

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden font-inter">
      {showCloudConnect && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl">
           <div className="bg-white w-full max-w-md rounded-[48px] shadow-2xl p-10 text-center border-2 border-blue-100">
              <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6"><Globe size={40} className="animate-pulse" /></div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2">Connect to Global Ledger</h2>
              <p className="text-slate-500 text-sm mb-8 font-medium leading-relaxed">Enter your shared Warehouse Sync Key to enable real-time updates across all computers.</p>
              <div className="space-y-4">
                 <input id="vault-key-input" type="text" placeholder="e.g. MANILA-HUB-01" className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-center focus:border-blue-500 outline-none uppercase" />
                 <button onClick={() => {
                   const key = (document.getElementById('vault-key-input') as HTMLInputElement).value;
                   if (key) handleConnectCloud(key);
                 }} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-all">Connect Terminal</button>
                 <button onClick={() => setShowCloudConnect(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Work Locally Only</button>
              </div>
           </div>
        </div>
      )}

      <aside className={`fixed inset-y-0 left-0 z-[70] w-64 xl:w-72 bg-slate-900 text-white transform transition-transform duration-300 lg:relative lg:translate-x-0 lg:flex flex-col border-r border-slate-800 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-center border-b border-slate-800"><SafeStepLogo className="invert grayscale brightness-[200%] opacity-90 scale-110" /></div>
        <nav className="mt-8 px-4 space-y-2.5 flex-1 overflow-y-auto no-scrollbar">
          {[
            { id: Page.DASHBOARD, label: 'Home', icon: <LayoutDashboard size={20} /> },
            { id: Page.SCANNING, label: 'Scan', icon: <ScanLine size={20} /> },
            { id: Page.FINDER, label: 'Finder', icon: <Search size={20} /> },
            { id: Page.PRODUCT_MASTER, label: 'SKUs', icon: <Package size={20} /> },
            { id: Page.STORES_INVENTORY, label: 'Stores', icon: <Store size={20} /> },
            { id: Page.REPORTS, label: 'Audit', icon: <BarChart3 size={20} /> },
          ].map((item) => (
            <button 
              key={item.id} 
              onClick={() => { setCurrentPage(item.id); setIsSidebarOpen(false); }} 
              className={`w-full flex items-center space-x-3.5 px-5 py-4 rounded-2xl transition-all relative group ${currentPage === item.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/40' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              {item.icon}
              <span className="font-bold tracking-tight text-sm uppercase">{item.label}</span>
              {item.id === Page.SCANNING && draftItems.length > 0 && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                   <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-pulse shadow-lg shadow-blue-400/50"></div>
                </div>
              )}
            </button>
          ))}</nav>
        <div className="p-4 border-t border-slate-800">
           <div className="px-5 py-3 mb-4 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
              <div><p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Global Vault</p><p className="text-[10px] font-bold text-blue-400 truncate w-32">{cloudConfig.vaultKey || 'NOT CONNECTED'}</p></div>
              <button onClick={() => setShowCloudConnect(true)} className="p-2 text-white/20 hover:text-white transition-colors"><LinkIcon size={14}/></button>
           </div>
          <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-5 py-4 text-rose-400 font-bold text-sm uppercase tracking-wider hover:bg-rose-500/10 rounded-xl transition-all"><LogOut size={20} /><span>Sign Out</span></button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="bg-white border-b border-slate-200 h-20 flex items-center justify-between px-12 z-40 sticky top-0 shrink-0">
          <div className="flex items-center space-x-4 lg:hidden"><button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600"><Menu size={24} /></button><SafeStepLogo className="scale-[0.8] origin-left" /></div>
          
          <div className="hidden lg:flex items-center space-x-6">
             <div className={`flex items-center space-x-2.5 px-4 py-2 rounded-full border transition-all ${cloudConfig.status === 'connected' ? 'bg-emerald-50 border-emerald-100 shadow-sm' : cloudConfig.status === 'syncing' ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                <Globe size={14} className={cloudConfig.status === 'syncing' ? 'animate-spin text-blue-600' : 'text-emerald-600'} />
                <span className={`text-[10px] font-black uppercase tracking-widest ${cloudConfig.status === 'connected' ? 'text-emerald-700' : 'text-slate-400'}`}>
                  {cloudConfig.status === 'connected' ? `Live Sync: ${cloudConfig.vaultKey}` : cloudConfig.status === 'syncing' ? 'Synchronizing...' : 'Local Node'}
                </span>
                {cloudConfig.status === 'connected' && (
                  <button onClick={copyShareLink} className="ml-2 p-1 hover:bg-emerald-100 rounded-lg text-emerald-600 transition-colors">
                    {showCopied ? <CheckCircle2 size={14} /> : <Share2 size={14} />}
                  </button>
                )}
             </div>
             {showCopied && <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest animate-in fade-in slide-in-from-left-2">Share Link Copied!</span>}
             {draftItems.length > 0 && currentPage !== Page.SCANNING && (
               <div className="flex items-center space-x-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-full animate-in slide-in-from-right-2">
                 <Zap size={14} className="text-amber-500 animate-pulse" />
                 <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Active Draft: {draftItems.length} SKUs</span>
               </div>
             )}
          </div>

          <div className="flex items-center space-x-4">
             <div className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${currentUser?.color || 'from-slate-600 to-slate-800'} flex items-center justify-center text-white font-black text-sm shadow-xl`}>{currentUser?.initials || '??'}</div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-12 bg-slate-50/50 scroll-smooth no-scrollbar">
          {currentPage === Page.DASHBOARD && <Dashboard products={products} sessions={sessions} discrepancies={discrepancies} storeInventory={storeInventory} activities={activities} />}
          {currentPage === Page.PRODUCT_MASTER && (
            <ProductMaster 
              products={products} inventory={inventory} sessions={sessions} 
              onAddProduct={(p) => setProducts(prev => [...prev, ...(Array.isArray(p) ? p : [p])])} 
              onDeleteProduct={(b) => setProducts(p => p.filter(x => x.barcode !== b))} 
              onDeleteProducts={(bs) => bs && setProducts(p => p.filter(x => !bs.includes(x.barcode)))} 
              onUpdateProduct={(b, u) => setProducts(p => p.map(x => x.barcode === b ? {...x, ...u} : x))} 
              onImportLedger={(recs) => handleCompleteSession({ id: Date.now().toString(), type: 'INBOUND', items: recs.map(r => ({ ...r, id: Math.random().toString(), description: 'Bulk Import', timestamp: new Date().toISOString() })), createdAt: new Date().toISOString(), userId: currentUser?.id || 'system', userName: currentUser?.name || 'System', location: 'IMPORT', boxId: '0' })}
              onPurgeLedger={() => setInventory([])}
              onRestoreSnapshot={(d) => { setProducts(d.products || []); setSessions(d.sessions || []); setInventory(d.inventory || []); setStoreInventory(d.storeInventory || []); setDiscrepancies(d.discrepancies || []); }}
              users={DEFAULT_USERS} onUpdateProducts={() => {}} onUpdateSession={() => {}} onDeleteSession={() => {}} onDeleteSessions={() => {}} onAddSessions={() => {}} onExportSession={() => {}}
            />
          )}
          {currentPage === Page.SCANNING && (
            <InventoryScanning 
              isActive={true} 
              products={products} 
              inventory={inventory} 
              sessions={sessions} 
              onCompleteSession={handleCompleteSession} 
              onUpdateProduct={(b, u) => setProducts(p => p.map(x => x.barcode === b ? {...x, ...u} : x))} 
              onAddProduct={(p) => setProducts(prev => [...prev, ...(Array.isArray(p) ? p : [p])])} 
              onUpdateSession={() => {}} 
              onDeleteSession={() => {}} 
              onExportSession={() => {}} 
              currentUser={currentUser!} 
              users={DEFAULT_USERS}
              externalDraftItems={draftItems}
              onUpdateDraftItems={setDraftItems}
              externalDraftLocation={draftLocation}
              onUpdateDraftLocation={setDraftLocation}
              externalDraftBoxId={draftBoxId}
              onUpdateDraftBoxId={setDraftBoxId}
              externalDraftScanType={draftScanType}
              onUpdateDraftScanType={setDraftScanType}
              externalDraftDrNumber={draftDrNumber}
              onUpdateDraftDrNumber={setDraftDrNumber}
              externalIsTerminalActive={isDraftTerminalActive}
              onUpdateTerminalActive={setIsDraftTerminalActive}
              recipientName={recipientName}
              setRecipientName={setRecipientName}
            />
          )}
          {currentPage === Page.FINDER && <Finder inventory={inventory} products={products} />}
          {currentPage === Page.REPORTS && <Reports products={products} sessions={sessions} />}
          {currentPage === Page.STORES_INVENTORY && <StoresInventory products={products} storeInventory={storeInventory} discrepancies={discrepancies} onUpdateItem={(id, u) => setStoreInventory(prev => prev.map(i => i.id === id ? {...i, ...u} : i))} onReportDiscrepancy={(r) => setDiscrepancies(prev => [r, ...prev])} onResolveDiscrepancy={(rid, adj) => { setDiscrepancies(prev => prev.map(d => d.id === rid ? {...d, status: 'Resolved'} : d)); setStoreInventory(prev => prev.map(i => (i.barcode === adj.barcode && i.storeName === adj.storeName) ? {...i, quantity: adj.actualQty, status: 'Validated'} : i)); }} onUpdateDiscrepancy={(id, u) => setDiscrepancies(prev => prev.map(d => d.id === id ? {...d, ...u} : d))} onDeleteDiscrepancy={(id) => setDiscrepancies(prev => prev.filter(d => d.id !== id))} currentUser={currentUser!} />}
        </main>
      </div>
    </div>
  );
};

export default App;
