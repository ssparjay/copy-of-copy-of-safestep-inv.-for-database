
import React, { useState, useRef, useMemo } from 'react';
import { Product, ScanSession, User, InventoryRecord } from '../types';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  X as CloseIcon, 
  CheckCircle2,
  Layers,
  MapPin,
  Sparkles,
  Package,
  Filter,
  ChevronDown,
  AlertOctagon,
  DatabaseZap,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  PhilippinePeso,
  Building2,
  Store,
  FileDown,
  FileUp,
  ClipboardList,
  FolderTree,
  CheckSquare,
  Square,
  ShieldAlert,
  AlertTriangle,
  Loader2,
  CheckCircle,
  Database,
  CloudDownload,
  Terminal,
  FileSpreadsheet,
  Skull,
  ShieldX
} from 'lucide-react';
import { generateProductDescription } from '../services/geminiService';
import { downloadProductTemplate, downloadLedgerTemplate, parseProductExcel, parseLedgerExcel } from '../services/excelService';
import { db } from '../services/database';

interface ProductMasterProps {
  products: Product[];
  inventory: InventoryRecord[];
  sessions: ScanSession[];
  onAddProduct: (p: Product | Product[]) => void;
  onDeleteProduct: (barcode: string) => void;
  onDeleteProducts: (barcodes?: string[]) => void;
  onUpdateProduct: (barcode: string, updates: Partial<Product>) => void;
  onUpdateProducts: (barcodes: string[], updates: Partial<Product>) => void;
  onUpdateSession: (sessionId: string, updates: Partial<ScanSession>) => void;
  onDeleteSession: (sessionId: string) => void;
  onDeleteSessions: (sessionIds: string[]) => void;
  onAddSessions: (newSessions: ScanSession[]) => void;
  onExportSession: (session: ScanSession) => void;
  onImportLedger: (newRecords: InventoryRecord[]) => void;
  onPurgeLedger: (indices?: number[]) => void;
  onRestoreSnapshot?: (data: any) => void;
  users: User[];
}

const CATEGORIES = ["FOOTWEAR", "APPAREL", "ACCESSORIES"];

const ProductMaster: React.FC<ProductMasterProps> = ({ 
  products, 
  inventory,
  onAddProduct, 
  onDeleteProduct, 
  onDeleteProducts,
  onUpdateProduct,
  onImportLedger,
  onPurgeLedger,
  onRestoreSnapshot
}) => {
  const [viewMode, setViewMode] = useState<'SKU' | 'LEDGER' | 'SYNC'>('SKU');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{message: string, count: number, type: 'METADATA' | 'LEDGER' | 'SQL'} | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isPurgeAllConfirmOpen, setIsPurgeAllConfirmOpen] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<'METADATA' | 'LEDGER' | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof Product | null>('itemCode');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [selectedProductBarcodes, setSelectedProductBarcodes] = useState<string[]>([]);
  const [selectedLedgerIndices, setSelectedLedgerIndices] = useState<number[]>([]);

  const audioCtx = useRef<AudioContext | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const ledgerImportRef = useRef<HTMLInputElement>(null);
  const snapshotInputRef = useRef<HTMLInputElement>(null);

  const initialFormState: Product = {
    barcode: '', itemCode: '', description: '', category: 'FOOTWEAR', brand: '', outsole: '', stock: 0, location: '', rrp: 0, skuFamily: '', smItemCode: '', robinsonsItemCode: '', kccItemCode: '', centroItemCode: '', staLuciaItemCode: '', landmarkItemCode: '', rustansItemCode: '', sportsCentralItemCode: '', islandMallItemCode: '', gaisanoGrandItemCode: '', gaisanoFiestaItemCode: '', metroItemCode: ''
  };

  const [formData, setFormData] = useState<Product>(initialFormState);

  const playBeep = (freq = 880) => {
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
      const osc = audioCtx.current.createOscillator();
      const gain = audioCtx.current.createGain();
      osc.frequency.setValueAtTime(freq, audioCtx.current.currentTime);
      gain.gain.setValueAtTime(0.05, audioCtx.current.currentTime);
      osc.connect(gain); gain.connect(audioCtx.current.destination);
      osc.start(); osc.stop(audioCtx.current.currentTime + 0.1);
    } catch (e) {}
  };

  const handleExportSQLite = async () => {
    const sql = await db.generateSQLiteDump();
    const blob = new Blob([sql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SafeStep_SQLite_Dump_${new Date().toISOString().split('T')[0]}.sql`;
    a.click();
    playBeep(1200);
  };

  const handleExportSnapshot = async () => {
    const json = await db.exportMasterSnapshot();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SafeStep_Master_Snapshot_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    playBeep(1320);
  };

  const handleImportSnapshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onRestoreSnapshot) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        onRestoreSnapshot(data);
        setImportStatus({ message: "Master Ledger Restored Successfully", count: data.products?.length || 0, type: 'SQL' });
        playBeep(1100);
      } catch (err) { alert("Invalid Snapshot Protocol."); }
    };
    reader.readAsText(file);
  };

  const toggleSort = (field: keyof Product) => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
    playBeep(880);
  };

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      const matchesSearch = p.description.toLowerCase().includes(searchTerm.toLowerCase()) || p.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) || p.barcode.includes(searchTerm);
      const matchesCategory = selectedCategory === 'ALL' || p.category.toUpperCase() === selectedCategory;
      return matchesSearch && matchesCategory;
    });
    if (sortField) {
      result.sort((a, b) => {
        const valA = a[sortField], valB = b[sortField];
        if (typeof valA === 'string' && typeof valB === 'string') return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        if (typeof valA === 'number' && typeof valB === 'number') return sortDirection === 'asc' ? valA - valB : valB - valA;
        return 0;
      });
    }
    return result;
  }, [products, searchTerm, selectedCategory, sortField, sortDirection]);

  const handleSelectProduct = (barcode: string) => setSelectedProductBarcodes(prev => prev.includes(barcode) ? prev.filter(b => b !== barcode) : [...prev, barcode]);
  const handleSelectAllProducts = () => setSelectedProductBarcodes(selectedProductBarcodes.length === filteredProducts.length ? [] : filteredProducts.map(p => p.barcode));

  const filteredLedger = useMemo(() => {
    return inventory.filter(i => i.barcode.includes(searchTerm) || i.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) || i.location.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [inventory, searchTerm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.rrp <= 0) { setFormError("RRP Required."); return; }
    if (editingProduct) onUpdateProduct(editingProduct.barcode, formData);
    else {
      if (products.some(p => p.barcode === formData.barcode)) { setFormError("Barcode Registered."); return; }
      onAddProduct(formData);
    }
    setIsModalOpen(false); setEditingProduct(null); setFormData(initialFormState); playBeep(1100);
  };

  const handleImportMetadata = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const newProducts = await parseProductExcel(file);
      const existingBarcodes = new Set(products.map(p => p.barcode));
      const deduplicated = newProducts.filter(p => !existingBarcodes.has(p.barcode));
      if (deduplicated.length > 0) {
        onAddProduct(deduplicated);
        setImportStatus({ message: "Registry metadata synchronized successfully.", count: deduplicated.length, type: 'METADATA' });
        playBeep(1100);
      }
    } catch (err) { alert("Import Failed."); } finally { setIsImporting(false); if (importInputRef.current) importInputRef.current.value = ''; }
  };

  const handleImportLedgerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const records = await parseLedgerExcel(file);
      if (records.length > 0) {
        onImportLedger(records);
        setImportStatus({ message: "Physical Ledger items synchronized.", count: records.length, type: 'LEDGER' });
        playBeep(1100);
      }
    } catch (err) { alert("Ledger Import Failed. Check template headers."); } finally { setIsImporting(false); if (ledgerImportRef.current) ledgerImportRef.current.value = ''; }
  };

  const executePurge = () => {
    if (purgeTarget === 'METADATA') {
      onDeleteProducts(products.map(p => p.barcode));
      setImportStatus({ message: "SKU Metadata Repository Purged", count: 0, type: 'METADATA' });
    } else if (purgeTarget === 'LEDGER') {
      onPurgeLedger();
      setImportStatus({ message: "Warehouse Inventory Ledger Purged", count: 0, type: 'LEDGER' });
    }
    setIsPurgeAllConfirmOpen(false);
    setPurgeTarget(null);
    playBeep(440);
  };

  const SortIcon = ({ field }: { field: keyof Product }) => {
    if (sortField !== field) return <ArrowUpDown size={14} className="opacity-30 ml-1.5" />;
    return sortDirection === 'asc' ? <ArrowUp size={14} className="text-blue-600 ml-1.5" /> : <ArrowDown size={14} className="text-blue-600 ml-1.5" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 relative">
      {isImporting && (
        <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-xl animate-in fade-in">
          <div className="bg-white p-12 rounded-[56px] shadow-2xl flex flex-col items-center text-center space-y-8 max-w-sm border border-slate-100">
            <div className="relative"><div className="w-24 h-24 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div><DatabaseZap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600" size={32} /></div>
            <div className="space-y-2"><h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Synchronizing</h3><p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">Updating Ledger Repository...</p></div>
          </div>
        </div>
      )}

      {importStatus && (
        <div className="fixed inset-0 z-[290] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[48px] shadow-2xl overflow-hidden p-10 text-center border border-slate-100 animate-in zoom-in-95">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle size={40} /></div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2">Sync Complete</h2>
              <p className="text-slate-500 font-medium mb-6">{importStatus.message}</p>
              <button onClick={() => setImportStatus(null)} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest active:scale-95 transition-all">Dismiss Signal</button>
           </div>
        </div>
      )}

      {isPurgeAllConfirmOpen && (
        <div className="fixed inset-0 z-[310] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[48px] shadow-2xl overflow-hidden p-10 text-center border-4 border-rose-100 animate-in zoom-in-95">
              <div className="w-24 h-24 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"><Skull size={48} /></div>
              <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-4">Confirm Data Purge</h2>
              <p className="text-slate-500 font-bold mb-10 leading-relaxed uppercase text-[11px] tracking-widest">
                Warning: You are about to erase the entire {purgeTarget === 'METADATA' ? 'SKU Metadata Registry' : 'Warehouse Inventory Ledger'}. This action cannot be undone.
              </p>
              <div className="space-y-3">
                <button onClick={executePurge} className="w-full py-6 bg-rose-600 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-rose-900/20 active:scale-95 transition-all">Erase Database</button>
                <button onClick={() => { setIsPurgeAllConfirmOpen(false); setPurgeTarget(null); }} className="w-full py-5 text-slate-400 font-black uppercase tracking-widest hover:text-slate-600 transition-colors">Abort Mission</button>
              </div>
           </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg"><DatabaseZap size={24} /></div>
          <div><h1 className="text-2xl font-black text-slate-900 uppercase">Registry & Database Hub</h1><p className="text-slate-500 font-medium text-sm">SQLite Sync & Asset Metadata Repository.</p></div>
        </div>
        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button onClick={() => setViewMode('SKU')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${viewMode === 'SKU' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500'}`}>Metadata</button>
          <button onClick={() => setViewMode('LEDGER')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${viewMode === 'LEDGER' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500'}`}>Ledger</button>
          <button onClick={() => setViewMode('SYNC')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${viewMode === 'SYNC' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500'}`}>SQL Hub</button>
        </div>
      </div>

      {viewMode === 'SYNC' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-6">
           <div className="bg-white p-10 rounded-[48px] border-2 border-slate-100 shadow-xl space-y-8">
              <div className="flex items-center space-x-4"><div className="p-4 bg-slate-900 text-white rounded-3xl"><Database size={28} /></div><div><h3 className="text-xl font-black text-slate-900 uppercase">SQLite Integration</h3><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Local Database Portability</p></div></div>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">Generate a standard SQL script containing your entire warehouse schema and data. Compatible with <b>SQLite Browser</b>, <b>PostgreSQL</b>, and <b>MySQL</b> for external auditing.</p>
              <button onClick={handleExportSQLite} className="w-full py-6 bg-slate-900 text-white rounded-[32px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"><Terminal size={20}/> Generate SQLite Script</button>
           </div>
           <div className="bg-white p-10 rounded-[48px] border-2 border-slate-100 shadow-xl space-y-8">
              <div className="flex items-center space-x-4"><div className="p-4 bg-blue-600 text-white rounded-3xl"><CloudDownload size={28} /></div><div><h3 className="text-xl font-black text-slate-900 uppercase">Master Snapshot</h3><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Multi-Computer Sync</p></div></div>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">Download a complete snapshot of all products, scans, and inventory levels to move your data to another computer or browser instance.</p>
              <div className="grid grid-cols-2 gap-4">
                 <button onClick={handleExportSnapshot} className="py-6 bg-blue-600 text-white rounded-[32px] font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"><FileDown size={16}/> Create Snapshot</button>
                 <button onClick={() => snapshotInputRef.current?.click()} className="py-6 bg-slate-100 text-slate-700 rounded-[32px] font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all flex items-center justify-center gap-2"><FileUp size={16}/> Load Snapshot</button>
                 <input type="file" ref={snapshotInputRef} onChange={handleImportSnapshot} className="hidden" accept=".json" />
              </div>
           </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-3"><div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} /><input type="text" placeholder="Locate Registry..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-6 py-4 bg-white border-2 rounded-2xl outline-none font-bold focus:border-blue-500 shadow-sm" /></div></div>
            <div className="lg:col-span-9 flex flex-wrap justify-end gap-3">
              {viewMode === 'SKU' && (
                <>
                  <button onClick={() => { setPurgeTarget('METADATA'); setIsPurgeAllConfirmOpen(true); }} className="px-5 py-3 bg-rose-50 text-rose-600 border-2 border-rose-100 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-sm hover:bg-rose-100 transition-colors"><ShieldX size={16} /> Delete All SKU</button>
                  <button onClick={downloadProductTemplate} className="px-5 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-sm"><FileDown size={16} /> SKU Template</button>
                  <button onClick={() => importInputRef.current?.click()} className="px-5 py-3 bg-slate-100 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-sm"><FileUp size={16} /> Import SKU</button>
                  <input type="file" ref={importInputRef} onChange={handleImportMetadata} className="hidden" accept=".xlsx, .xls" />
                </>
              )}
              {viewMode === 'LEDGER' && (
                <>
                  <button onClick={() => { setPurgeTarget('LEDGER'); setIsPurgeAllConfirmOpen(true); }} className="px-5 py-3 bg-rose-50 text-rose-600 border-2 border-rose-100 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-sm hover:bg-rose-100 transition-colors"><Trash2 size={16} /> Clear Ledger</button>
                  <button onClick={downloadLedgerTemplate} className="px-5 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-sm"><FileSpreadsheet size={16} /> Ledger Template</button>
                  <button onClick={() => ledgerImportRef.current?.click()} className="px-5 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg"><FileUp size={16} /> Import Ledger</button>
                  <input type="file" ref={ledgerImportRef} onChange={handleImportLedgerFile} className="hidden" accept=".xlsx, .xls" />
                </>
              )}
              <button onClick={() => { setFormError(null); setFormData(initialFormState); setIsModalOpen(true); }} className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm uppercase shadow-lg shadow-blue-900/10"><Plus size={20} /> SKU Entry</button>
            </div>
          </div>

          <div className="bg-white rounded-[32px] border shadow-xl overflow-hidden mb-24">
            <div className="overflow-x-auto custom-scrollbar">
              {viewMode === 'SKU' ? (
                <table className="w-full text-left min-w-[1400px]">
                  <thead><tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b"><th className="px-8 py-5 w-12"><button onClick={handleSelectAllProducts}>{selectedProductBarcodes.length === filteredProducts.length && filteredProducts.length > 0 ? <CheckSquare size={20} /> : <Square size={20} />}</button></th><th className="px-8 py-5 cursor-pointer" onClick={() => toggleSort('itemCode')}>Item Code <SortIcon field="itemCode" /></th><th className="px-8 py-5">Registry Logic</th><th className="px-8 py-5">Family</th><th className="px-8 py-5">Category</th><th className="px-8 py-5 text-right cursor-pointer" onClick={() => toggleSort('rrp')}>RRP <SortIcon field="rrp" /></th><th className="px-8 py-5 text-center cursor-pointer" onClick={() => toggleSort('stock')}>Stock <SortIcon field="stock" /></th><th className="px-8 py-5 text-center">Actions</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">{filteredProducts.map(p => (<tr key={p.barcode} className={`hover:bg-slate-50 transition-all ${selectedProductBarcodes.includes(p.barcode) ? 'bg-blue-50/50' : ''}`} onClick={() => handleSelectProduct(p.barcode)}><td className="px-8 py-6">{selectedProductBarcodes.includes(p.barcode) ? <CheckSquare size={20} /> : <Square size={20} />}</td><td className="px-8 py-6 font-black text-slate-900 text-[13px]">{p.itemCode}<p className="text-[10px] text-slate-400 font-mono mt-0.5">{p.barcode}</p></td><td className="px-8 py-6"><div className="text-[13px] font-bold text-slate-700 leading-snug">{p.description}</div></td><td className="px-8 py-6"><span className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-2.5 py-1 rounded-lg border">{p.skuFamily || 'No Family'}</span></td><td className="px-8 py-6"><span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">{p.category}</span></td><td className="px-8 py-6 text-right font-black text-slate-900">₱{p.rrp.toLocaleString()}</td><td className="px-8 py-6 text-center font-black text-sm">{p.stock}</td><td className="px-8 py-6 text-center"><button onClick={(e) => { e.stopPropagation(); setFormData(p); setEditingProduct(p); setIsModalOpen(true); }} className="p-2.5 text-slate-400 hover:text-blue-600"><Edit size={16} /></button><button onClick={(e) => { e.stopPropagation(); setProductToDelete(p); }} className="p-2.5 text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button></td></tr>))}</tbody>
                </table>
              ) : (
                <table className="w-full text-left min-w-[800px]">
                  <thead><tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b"><th className="px-8 py-5">Node</th><th className="px-8 py-5">Container</th><th className="px-8 py-5">Registry SKU</th><th className="px-8 py-5 text-center">Qty</th><th className="px-8 py-5 text-center">Status</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">{filteredLedger.map((i, idx) => (<tr key={idx} className="hover:bg-slate-50 transition-all"><td className="px-8 py-6 font-black text-slate-700 uppercase text-xs">{i.location}</td><td className="px-8 py-6 font-black text-slate-900 text-sm">#{i.boxId}</td><td className="px-8 py-6 font-black text-blue-600 text-sm">{i.itemCode}<p className="text-[9px] text-slate-400 font-mono">{i.barcode}</p></td><td className="px-8 py-6 text-center font-black text-lg">{i.quantity}</td><td className="px-8 py-6 text-center"><span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase border border-emerald-100">Verified</span></td></tr>))}</tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[48px] shadow-2xl overflow-hidden animate-in zoom-in-95 h-[90vh] flex flex-col border border-slate-100">
             <div className="p-8 border-b flex items-center justify-between bg-slate-50 shrink-0">
               <div className="flex items-center space-x-5"><div className="p-4 bg-blue-600 text-white rounded-3xl shadow-xl"><Package size={28} /></div><h2 className="text-2xl font-black text-slate-900 uppercase">Registry Node</h2></div>
               <button onClick={() => { setIsModalOpen(false); setEditingProduct(null); }} className="p-2.5 text-slate-400 hover:text-slate-600 bg-white rounded-full"><CloseIcon size={22} /></button>
             </div>
             <form onSubmit={handleSubmit} className="p-10 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-5">
                   <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Barcode</label><input required type="text" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value.replace(/[^0-9]/g, '')})} className="w-full px-6 py-4 bg-slate-50 border-2 rounded-3xl outline-none font-bold" /></div>
                   <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Item Code</label><input required type="text" value={formData.itemCode} onChange={e => setFormData({...formData, itemCode: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-2 rounded-3xl outline-none font-bold uppercase" /></div>
                </div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SKU Family Registry</label><input type="text" value={formData.skuFamily || ''} onChange={e => setFormData({...formData, skuFamily: e.target.value})} className="w-full px-6 py-4 bg-white border-2 border-slate-100 rounded-3xl outline-none font-black text-blue-600 uppercase shadow-sm" placeholder="e.g. CORE SERIES 2025" /></div>
                <div className="grid grid-cols-2 gap-5">
                   <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label><select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-3xl font-bold uppercase outline-none">{CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
                   <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Brand</label><input required type="text" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none font-bold uppercase" /></div>
                </div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Retail Price (RRP)</label><input required type="number" step="0.01" value={formData.rrp || ''} onChange={e => setFormData({...formData, rrp: Number(e.target.value)})} className="w-full px-6 py-4 bg-slate-50 border-2 rounded-3xl font-black text-lg focus:border-blue-500" /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label><textarea required placeholder="Metadata Description..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-2 rounded-3xl h-28 resize-none font-bold outline-none focus:border-blue-500" /></div>
                <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[32px] font-black uppercase tracking-widest shadow-2xl active:scale-95">Authorize SKU Commitment</button>
             </form>
          </div>
        </div>
      )}

      {productToDelete && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl p-10 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6"><Trash2 size={32} /></div>
            <h3 className="text-xl font-black text-slate-900 uppercase mb-2">Delete SKU?</h3>
            <p className="text-slate-500 text-sm mb-8 font-medium">Removing "{productToDelete.itemCode}" will detach its metadata from the registry.</p>
            <div className="space-y-3">
              <button onClick={() => { onDeleteProduct(productToDelete.barcode); setProductToDelete(null); playBeep(440); }} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all">Delete Permanently</button>
              <button onClick={() => setProductToDelete(null)} className="w-full py-4 text-slate-400 font-black uppercase text-xs tracking-widest hover:text-slate-600">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductMaster;
