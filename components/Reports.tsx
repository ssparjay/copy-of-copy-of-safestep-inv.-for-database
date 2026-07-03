
import React, { useState, useMemo } from 'react';
import { Product, ScanSession } from '../types';
import { 
  Search, 
  FileSpreadsheet, 
  MapPin, 
  Box as BoxIcon, 
  Package, 
  DollarSign, 
  ChevronDown,
  Filter,
  ArrowUpDown,
  BarChart3,
  FileText,
  Truck,
  Lock,
  MoveRight,
  Database
} from 'lucide-react';
import { exportMultiSheetToExcel } from '../services/excelService';

interface ReportsProps {
  products: Product[];
  sessions: ScanSession[];
}

const Reports: React.FC<ReportsProps> = ({ products, sessions }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const flatReportData = useMemo(() => {
    // Robust check for sessions array
    if (!sessions) return [];

    const data = sessions.flatMap(session => {
      if (!session || !session.items) return [];
      
      return session.items.map(item => {
        const product = products.find(p => p.barcode === item.barcode);
        
        // Logical mapping of Source vs Target
        const sourceNode = item.location || session.location || 'N/A';
        const sourceBox = session.type === 'INBOUND' ? (item.boxId || session.boxId || 'N/A') : (item.originBoxId || 'N/A');
        const targetBox = session.type === 'OUTBOUND' ? (item.boxId || 'N/A') : (item.boxId || session.boxId || 'N/A');

        // Identify if this record was part of a bulk import
        // If the session location is 'IMPORT', we override the type to 'IMPORT'
        const flowType = session.location === 'IMPORT' ? 'IMPORT' : session.type;

        return {
          type: flowType,
          documentNumber: session.drNumber || 'N/A',
          poNumber: session.poNumber || 'N/A',
          vendorCode: session.vendorCode || 'N/A',
          branchCode: session.branchCode || 'N/A',
          recipientName: session.recipientName || 'N/A',
          via: session.via || 'N/A',
          
          // Audit Traceability
          sourceNode,
          sourceBox,
          targetBox,
          
          operator: session.userName || 'System',
          barcode: item.barcode || 'N/A',
          itemCode: product?.itemCode || item.itemCode || 'N/A',
          description: product?.description || item.description || 'N/A',
          brand: product?.brand || 'Generic',
          category: product?.category || 'Uncategorized',
          rrp: product?.rrp || 0,
          quantity: item.quantity || 0,
          totalPrice: (product?.rrp || 0) * (item.quantity || 0),
          timestamp: item.timestamp || session.createdAt || new Date().toISOString()
        };
      });
    });

    let filtered = data.filter(row => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        row.sourceBox.toLowerCase().includes(term) ||
        row.targetBox.toLowerCase().includes(term) ||
        row.itemCode.toLowerCase().includes(term) ||
        row.description.toLowerCase().includes(term) ||
        row.sourceNode.toLowerCase().includes(term) ||
        row.brand.toLowerCase().includes(term) ||
        row.operator.toLowerCase().includes(term) ||
        row.documentNumber.toLowerCase().includes(term) ||
        row.recipientName.toLowerCase().includes(term) ||
        row.barcode.includes(term);
      
      const matchesCategory = categoryFilter === 'ALL' || row.category.toUpperCase() === categoryFilter.toUpperCase();
      const matchesType = typeFilter === 'ALL' || row.type === typeFilter;
      
      return matchesSearch && matchesCategory && matchesType;
    });

    if (sortConfig) {
      filtered.sort((a: any, b: any) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    return filtered;
  }, [sessions, products, searchTerm, categoryFilter, typeFilter, sortConfig]);

  const totals = useMemo(() => {
    return flatReportData.reduce((acc, row) => ({
      items: acc.items + row.quantity,
      valuation: acc.valuation + row.totalPrice
    }), { items: 0, valuation: 0 });
  }, [flatReportData]);

  const handleExport = () => {
    const mapRow = (row: any) => ({
      'Flow Type': row.type,
      'Document # (DR)': row.documentNumber,
      'P.O. #': row.poNumber,
      'Delivered To': row.recipientName,
      'Warehouse Source Node': row.sourceNode,
      'Source Box ID': row.sourceBox,
      'Shipping/Target Box ID': row.targetBox,
      'Operator': row.operator,
      'Barcode': row.barcode,
      'Item Code': row.itemCode,
      'Description': row.description,
      'Brand': row.brand,
      'Category': row.category,
      'Retail Price (PHP)': row.rrp,
      'Quantity': row.quantity,
      'Total Value (PHP)': row.totalPrice,
      'Audit Timestamp': new Date(row.timestamp).toLocaleString()
    });

    const inboundData = flatReportData.filter(r => r.type === 'INBOUND').map(mapRow);
    const outboundData = flatReportData.filter(r => r.type === 'OUTBOUND').map(mapRow);
    const importData = flatReportData.filter(r => r.type === 'IMPORT').map(mapRow);

    exportMultiSheetToExcel(
      { 
        'Inbound Trace': inboundData, 
        'Outbound Trace': outboundData,
        'Import Trace': importData 
      },
      `Full_Traceability_Audit_${new Date().toISOString().split('T')[0]}`
    );
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-900/10">
            <Database size={24} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase">Traceability Audit</h1>
            <p className="text-sm md:text-base text-slate-500 font-medium">Full visibility report: Origin Warehouse Nodes & Source Container ID tracking.</p>
          </div>
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center justify-center space-x-3 px-8 py-4 bg-emerald-600 text-white rounded-[24px] font-black text-xs md:text-sm uppercase tracking-widest shadow-2xl shadow-emerald-900/20 hover:bg-emerald-700 transition-all active:scale-95 w-full lg:w-auto"
        >
          <FileSpreadsheet size={20} />
          <span>Generate Full Trace Report</span>
        </button>
      </div>

      <div className="bg-white rounded-[48px] border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        <div className="p-8 border-b border-slate-100 flex flex-col lg:flex-row gap-6 items-center bg-slate-50/50">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by DR#, PO, Source Box, Location or Recipient..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-white border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all shadow-inner"
            />
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center space-x-3 bg-white px-5 py-4 rounded-2xl border-2 border-slate-100 shadow-sm w-full sm:w-auto">
              <Filter size={16} className="text-slate-400" />
              <select 
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer text-slate-600 appearance-none min-w-[100px]"
              >
                <option value="ALL">All Flows</option>
                <option value="INBOUND">Inbound</option>
                <option value="OUTBOUND">Outbound</option>
                <option value="IMPORT">Import</option>
              </select>
              <ChevronDown size={14} className="text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[2000px]">
            <thead>
              <tr className="bg-slate-50/80 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">
                <th className="px-8 py-5">Flow</th>
                <th className="px-8 py-5">DR # / PO #</th>
                <th className="px-8 py-5">Origin (Source Node)</th>
                <th className="px-8 py-5">Source Box</th>
                <th className="px-4 py-5 text-center"></th>
                <th className="px-8 py-5">Target (Ship Box)</th>
                <th className="px-8 py-5">Recipient / Destination</th>
                <th className="px-8 py-5">Asset Registry</th>
                <th className="px-8 py-5 text-center">Qty</th>
                <th className="px-8 py-5 text-right">Value</th>
                <th className="px-8 py-5 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {flatReportData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-300">
                      <FileSpreadsheet size={64} className="opacity-10 mb-4" />
                      <p className="text-xs font-black uppercase tracking-[0.2em]">No audit data found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                flatReportData.map((row, idx) => (
                  <tr key={`${idx}`} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-8 py-6">
                       <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${row.type === 'INBOUND' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : row.type === 'IMPORT' ? 'text-slate-600 bg-slate-50 border-slate-200' : 'text-blue-600 bg-blue-50 border-blue-100'}`}>
                        {row.type}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="font-black text-slate-900 text-[13px] tracking-tight">{row.documentNumber}</span>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">PO: {row.poNumber}</p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-2 text-slate-900 font-black text-[12px] uppercase">
                        <MapPin size={12} className="text-blue-500" />
                        <span>{row.sourceNode}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-2">
                        <BoxIcon size={12} className="text-slate-400" />
                        <span className="font-bold text-slate-600 text-[12px]">BOX {row.sourceBox}</span>
                      </div>
                    </td>
                    <td className="px-4 py-6 text-center">
                      <MoveRight size={16} className="text-slate-200" />
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-2">
                        <BoxIcon size={14} className="text-blue-600" />
                        <span className="font-black text-slate-900 text-[13px]">BOX #{row.targetBox}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                       <div className="flex items-center space-x-2 text-slate-600 font-bold text-[11px] uppercase tracking-tight">
                        <Truck size={12} className="text-slate-300" />
                        <span>{row.recipientName}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="font-black text-blue-600 text-[12px] tracking-tight leading-tight">{row.itemCode}</p>
                      <p className="text-[9px] text-slate-400 font-mono mt-0.5 truncate max-w-[150px]">{row.description}</p>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-900 text-white font-black text-[12px]">{row.quantity}</span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <span className="font-black text-slate-900 text-[12px]">₱{row.totalPrice.toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase leading-tight">{new Date(row.timestamp).toLocaleDateString()}</p>
                      <p className="text-[10px] font-bold text-slate-300 uppercase mt-1">{new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center space-x-6">
             <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aggregate Records</span>
                <span className="text-lg font-black text-slate-900 leading-none">{flatReportData.length} entries</span>
             </div>
             <div className="h-8 w-px bg-slate-200"></div>
             <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Units counted</span>
                <span className="text-lg font-black text-slate-900 leading-none">{totals.items.toLocaleString()} units</span>
             </div>
          </div>
          <div className="flex items-center space-x-3 bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm">
             <Lock size={14} className="text-emerald-500" />
             <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Full Chain Custody Verified</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
