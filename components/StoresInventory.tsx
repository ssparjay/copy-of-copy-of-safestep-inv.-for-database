
import React, { useState, useMemo } from 'react';
import { StoreInventoryRecord, DiscrepancyReport, User, Product } from '../types';
import { 
  Store, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Filter, 
  ShieldAlert,
  ArrowRight,
  UserCheck,
  FileText,
  CheckCircle,
  Zap,
  X,
  Box,
  Layers,
  Plus,
  Minus,
  Trash2,
  AlertTriangle
} from 'lucide-react';

interface StoresInventoryProps {
  products: Product[];
  storeInventory: StoreInventoryRecord[];
  discrepancies: DiscrepancyReport[];
  onUpdateItem: (id: string, updates: Partial<StoreInventoryRecord>) => void;
  onReportDiscrepancy: (report: DiscrepancyReport) => void;
  onResolveDiscrepancy: (reportId: string, adjustment: { barcode: string, storeName: string, actualQty: number }) => void;
  onUpdateDiscrepancy: (id: string, updates: Partial<DiscrepancyReport>) => void;
  onDeleteDiscrepancy: (id: string) => void;
  currentUser: User;
}

const StoresInventory: React.FC<StoresInventoryProps> = ({ 
  products,
  storeInventory, 
  discrepancies, 
  onUpdateItem, 
  onReportDiscrepancy, 
  onResolveDiscrepancy,
  onUpdateDiscrepancy,
  onDeleteDiscrepancy,
  currentUser 
}) => {
  const [selectedStore, setSelectedStore] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Pending Validation' | 'Validated' | 'Discrepancy'>('ALL');
  
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [activeValidationItem, setActiveValidationItem] = useState<StoreInventoryRecord | null>(null);
  const [validationQty, setValidationQty] = useState<number>(0);
  const [issueType, setIssueType] = useState<'Missing' | 'Wrong Item' | 'Damaged'>('Missing');

  const stores = useMemo(() => Array.from(new Set(storeInventory.map(i => i.storeName))), [storeInventory]);

  const filteredInventory = useMemo(() => {
    return storeInventory.filter(item => {
      const product = products.find(p => p.barcode === item.barcode);
      const matchesStore = selectedStore === 'ALL' || item.storeName === selectedStore;
      const matchesSearch = (product?.itemCode || item.itemCode).toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (product?.description || item.description).toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.drNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      return matchesStore && matchesSearch && matchesStatus;
    });
  }, [storeInventory, selectedStore, searchTerm, statusFilter, products]);

  const activeDiscrepancies = useMemo(() => discrepancies.filter(d => d.status === 'Open'), [discrepancies]);

  const handleValidate = (item: StoreInventoryRecord) => {
    onUpdateItem(item.id, { status: 'Validated', lastUpdated: new Date().toISOString() });
  };

  const submitDiscrepancy = () => {
    if (!activeValidationItem) return;
    const report: DiscrepancyReport = {
      id: Math.random().toString(36).substr(2, 9),
      storeName: activeValidationItem.storeName,
      barcode: activeValidationItem.barcode,
      itemCode: activeValidationItem.itemCode,
      reportedBy: currentUser.name,
      issueType,
      expectedQty: activeValidationItem.quantity,
      actualQty: validationQty,
      timestamp: new Date().toISOString(),
      status: 'Open'
    };
    onReportDiscrepancy(report);
    onUpdateItem(activeValidationItem.id, { status: 'Discrepancy', lastUpdated: new Date().toISOString() });
    setIsValidationModalOpen(false);
    setActiveValidationItem(null);
  };

  const handleAdjustQty = (report: DiscrepancyReport, delta: number) => {
    onUpdateDiscrepancy(report.id, { actualQty: Math.max(0, report.actualQty + delta) });
  };

  const handleAdminResolve = (report: DiscrepancyReport) => {
    if (confirm(`Authorize inventory adjustment for ${report.itemCode}? Overwrite with ${report.actualQty} units.`)) {
      onResolveDiscrepancy(report.id, {
        barcode: report.barcode, storeName: report.storeName, actualQty: report.actualQty
      });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-900/10"><Store size={24} /></div>
          <div><h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase">Stores Inventory Terminal</h1><p className="text-sm md:text-base text-slate-500 font-medium">Tracking dispatches, promoter verification, and quality audit pipeline.</p></div>
        </div>
      </div>

      {activeDiscrepancies.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          <h3 className="font-black text-[10px] text-rose-500 uppercase tracking-[0.2em] ml-2">Critical Adjustment Queue</h3>
          {activeDiscrepancies.map(d => (
            <div key={d.id} className="bg-white border-2 border-rose-100 p-6 rounded-[32px] flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex items-center space-x-5">
                <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center border border-rose-100"><ShieldAlert size={28} /></div>
                <div><h3 className="font-black text-slate-900 uppercase tracking-tight text-lg">{d.itemCode} - <span className="text-rose-600">{d.issueType}</span></h3><div className="flex flex-wrap gap-x-4 gap-y-1 mt-1"><p className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1"><Store size={10}/> {d.storeName}</p><p className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1"><UserCheck size={10}/> {d.reportedBy}</p></div></div>
              </div>
              <div className="flex items-center space-x-6">
                 <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                    <button onClick={() => handleAdjustQty(d, -1)} className="p-2 bg-white text-slate-400 hover:text-rose-600 rounded-xl shadow-sm border border-slate-100 transition-all"><Minus size={14} /></button>
                    <div className="text-center min-w-[80px]"><p className="text-[9px] font-black text-slate-400 uppercase">Actual Qty</p><p className="text-xl font-black text-rose-600">{d.actualQty}</p></div>
                    <button onClick={() => handleAdjustQty(d, 1)} className="p-2 bg-white text-slate-400 hover:text-emerald-600 rounded-xl shadow-sm border border-slate-100 transition-all"><Plus size={14} /></button>
                 </div>
                 <div className="h-10 w-px bg-slate-100"></div>
                 <div className="flex items-center space-x-2">
                    {currentUser.role === 'Admin' && (
                      <button onClick={() => handleAdminResolve(d)} className="px-6 py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-rose-700 active:scale-95 transition-all flex items-center space-x-2"><Zap size={14} /><span>Authorize</span></button>
                    )}
                    <button onClick={() => onDeleteDiscrepancy(d.id)} className="p-4 text-slate-300 hover:text-rose-500 rounded-2xl transition-all"><Trash2 size={20} /></button>
                 </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl overflow-hidden flex flex-col">
        <div className="p-8 border-b border-slate-100 flex flex-col lg:flex-row gap-6 items-center bg-slate-50/50">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Search store stock by SKU, Description or DR..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-6 py-4 bg-white border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-blue-500 shadow-inner transition-all" />
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center space-x-3 bg-white px-5 py-4 rounded-2xl border-2 border-slate-100 shadow-sm w-full sm:w-auto">
              <Filter size={16} className="text-slate-400" />
              <select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)} className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer text-slate-600"><option value="ALL">All Stores</option>{stores.map(s => <option key={s} value={s}>{s}</option>)}</select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/80 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">
                <th className="px-8 py-5">Assigned Node</th>
                <th className="px-8 py-5">Product Details</th>
                <th className="px-8 py-5">Manifest ID</th>
                <th className="px-8 py-5 text-center">Batch Qty</th>
                <th className="px-8 py-5">Status Node</th>
                <th className="px-8 py-5 text-right">Verification Flow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredInventory.map(item => {
                const product = products.find(p => p.barcode === item.barcode);
                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-8 py-6"><div className="flex items-center space-x-3"><div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm"><Store size={18} /></div><span className="font-black text-slate-900 text-[13px] uppercase tracking-tight">{item.storeName}</span></div></td>
                    <td className="px-8 py-6"><p className="font-black text-blue-600 text-[13px] tracking-tight">{product?.itemCode || item.itemCode}</p><p className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[200px]">{product?.description || item.description}</p></td>
                    <td className="px-8 py-6"><div className="flex items-center space-x-2"><FileText size={14} className="text-slate-300" /><span className="font-bold text-slate-500 text-[11px] uppercase tracking-widest">{item.drNumber || 'MANUAL-DISPATCH'}</span></div></td>
                    <td className="px-8 py-6 text-center"><span className="inline-flex items-center justify-center px-4 py-1.5 rounded-xl bg-slate-900 text-white font-black text-sm shadow-md shadow-slate-200">{item.quantity}</span></td>
                    <td className="px-8 py-6"><span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase border shadow-sm ${item.status === 'Validated' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : item.status === 'Discrepancy' ? 'text-rose-600 bg-rose-50 border-rose-100' : 'text-amber-600 bg-amber-50 border-amber-100'}`}>{item.status}</span></td>
                    <td className="px-8 py-6 text-right">
                      {item.status === 'Pending Validation' ? (
                        <div className="flex items-center justify-end space-x-2">
                          <button onClick={() => handleValidate(item)} className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm border border-emerald-100" title="Verify & Accept"><CheckCircle2 size={18} /></button>
                          <button onClick={() => { setActiveValidationItem(item); setValidationQty(item.quantity); setIsValidationModalOpen(true); }} className="p-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm border border-rose-100" title="Report Discrepancy"><AlertCircle size={18} /></button>
                        </div>
                      ) : <CheckCircle className="inline text-emerald-500" size={20} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isValidationModalOpen && activeValidationItem && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[48px] shadow-2xl overflow-hidden p-10 border-2 border-rose-100 animate-in zoom-in-95">
             <div className="flex items-center justify-between mb-8">
               <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3"><AlertTriangle className="text-rose-600" /> Audit Discrepancy</h2>
               <button onClick={() => setIsValidationModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 rounded-full"><X size={20} /></button>
             </div>
             <div className="space-y-6">
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Audit Target</p>
                  <p className="text-lg font-black text-slate-900">{activeValidationItem.itemCode}</p>
                  <p className="text-xs font-bold text-slate-500">{activeValidationItem.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Issue Profile</label>
                    <select value={issueType} onChange={(e) => setIssueType(e.target.value as any)} className="w-full px-4 py-4 bg-white border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-rose-500 transition-all">
                      <option value="Missing">Missing</option>
                      <option value="Wrong Item">Wrong Item</option>
                      <option value="Damaged">Damaged</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Actual Qty Detected</label>
                    <input type="number" value={validationQty} onChange={(e) => setValidationQty(parseInt(e.target.value) || 0)} className="w-full px-4 py-4 bg-white border-2 border-slate-100 rounded-2xl font-black text-xl text-rose-600 outline-none focus:border-rose-500 transition-all" />
                  </div>
                </div>
                <button onClick={submitDiscrepancy} className="w-full py-5 bg-rose-600 text-white rounded-[24px] font-black uppercase tracking-widest shadow-xl shadow-rose-900/20 active:scale-95 transition-all">Submit Security Audit</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoresInventory;
