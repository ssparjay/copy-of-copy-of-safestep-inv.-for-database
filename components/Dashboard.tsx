
import React, { useState, useMemo } from 'react';
import { Product, ScanSession, DiscrepancyReport, StoreInventoryRecord, ActivityLog } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { 
  Package, MapPin, DatabaseZap, PackagePlus, PackageMinus, ShieldAlert, 
  ClipboardCheck, Clock, Truck, CheckCircle2, AlertCircle, AlertTriangle, 
  ChevronRight, Activity, Zap, Users
} from 'lucide-react';

interface DashboardProps {
  products: Product[];
  sessions: ScanSession[];
  discrepancies: DiscrepancyReport[];
  storeInventory?: StoreInventoryRecord[];
  activities?: ActivityLog[];
}

const Dashboard: React.FC<DashboardProps> = ({ 
  products = [], 
  sessions = [], 
  discrepancies = [], 
  storeInventory = [],
  activities = []
}) => {
  const totalStock = products.reduce((acc, p) => acc + (p?.stock || 0), 0);
  const lowStockCount = products.filter(p => p && p.stock < 20).length;
  const activeDiscrepancies = discrepancies.filter(d => d && d.status === 'Open').length;
  
  const inboundCount = useMemo(() => sessions.filter(s => s && s.type === 'INBOUND').length, [sessions]);

  const poLifecycleData = useMemo(() => {
    const outboundSessions = sessions.filter(s => s && s.type === 'OUTBOUND' && s.poNumber);
    const uniquePos = Array.from(new Set(outboundSessions.map(s => s.poNumber!)));

    return uniquePos.map(poNo => {
      const relatedSessions = outboundSessions.filter(s => s.poNumber === poNo);
      const drNumbers = relatedSessions.map(s => s.drNumber).filter(Boolean);
      const linkedStoreItems = storeInventory.filter(si => si && drNumbers.includes(si.drNumber!));
      const totalDispatched = linkedStoreItems.reduce((acc, i) => acc + (i?.quantity || 0), 0);
      const totalValidated = linkedStoreItems.filter(i => i?.status === 'Validated').reduce((acc, i) => acc + (i?.quantity || 0), 0);
      const hasDiscrepancy = linkedStoreItems.some(i => i?.status === 'Discrepancy');
      
      let status: 'IN_TRANSIT' | 'PARTIAL' | 'VERIFIED' | 'ALERT' = 'IN_TRANSIT';
      if (hasDiscrepancy) status = 'ALERT';
      else if (totalValidated === totalDispatched && totalDispatched > 0) status = 'VERIFIED';
      else if (totalValidated > 0) status = 'PARTIAL';

      return {
        poNumber: poNo,
        recipient: relatedSessions[0]?.recipientName || 'General',
        dispatched: totalDispatched,
        validated: totalValidated,
        status,
        lastUpdate: relatedSessions[0]?.createdAt
      };
    }).sort((a, b) => new Date(b.lastUpdate || 0).getTime() - new Date(a.lastUpdate || 0).getTime());
  }, [sessions, storeInventory]);

  const chartData = useMemo(() => {
    return products
      .filter(p => p && p.stock > 0)
      .sort((a, b) => (b.stock || 0) - (a.stock || 0))
      .slice(0, 8)
      .map(p => ({
        name: p.itemCode || 'N/A',
        stock: p.stock || 0
      }));
  }, [products]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">HQ Inventory Intelligence</h1>
          <p className="text-sm md:text-base text-slate-500 font-medium">Monitoring inbound flow, outbound deliveries, and real-time personnel activity.</p>
        </div>
        <div className="flex items-center space-x-3 px-6 py-3 bg-blue-50 border-2 border-blue-200 text-blue-600 rounded-2xl shadow-sm">
           <Zap size={20} className="animate-pulse" />
           <span className="font-black text-xs uppercase tracking-widest">Global Sync Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard title="Master Stock" value={totalStock.toLocaleString()} icon={<Package className="text-slate-600" />} trend="Warehouse Total" positive={true} />
        <StatCard title="Sync Node Health" value="100%" icon={<Activity className="text-emerald-600" />} trend="SafeStep Cloud" positive={true} />
        <StatCard title="Active Protocols" value={sessions.length} icon={<DatabaseZap className="text-blue-600" />} trend="Ledger Depth" positive={true} />
        <StatCard title="Personnel Online" value="4" icon={<Users className="text-indigo-600" />} trend="Global Cluster" positive={true} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-8">
            {/* PO Tracker */}
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl overflow-hidden">
               <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <div className="flex items-center space-x-3">
                   <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-900/20"><ClipboardCheck size={20} /></div>
                   <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Active Purchase Orders</h3>
                 </div>
               </div>
               <div className="p-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {poLifecycleData.map(po => (
                     <div key={po.poNumber} className="bg-white border-2 border-slate-100 p-6 rounded-[32px] hover:border-blue-200 hover:shadow-lg transition-all group">
                       <div className="flex justify-between items-start mb-4">
                         <div><h4 className="font-black text-slate-900 text-lg">PO #{po.poNumber}</h4><p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mt-0.5"><Truck size={10}/> {po.recipient}</p></div>
                         <StatusBadge status={po.status} />
                       </div>
                       <div className="space-y-3">
                         <div className="flex justify-between items-end"><p className="text-[10px] font-black text-slate-500 uppercase">Verification Progress</p><p className="text-xs font-black text-slate-900">{po.validated} / {po.dispatched}</p></div>
                         <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ${po.status === 'ALERT' ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${po.dispatched > 0 ? (po.validated / po.dispatched) * 100 : 0}%` }}></div></div>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
            </div>

            {/* Top SKUs */}
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-xl h-[400px] flex flex-col">
               <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-6">Stock Profile (Top SKUs)</h3>
               <div className="flex-1 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 9, fontWeight: 700}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 9, fontWeight: 700}} />
                      <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                      <Bar dataKey="stock" radius={[8, 8, 0, 0]}>
                        {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
         </div>

         <div className="space-y-8">
            {/* Real-Time Activity Feed */}
            <div className="bg-slate-900 rounded-[48px] shadow-2xl overflow-hidden flex flex-col h-[850px] border border-slate-800">
               <div className="p-8 border-b border-white/5 bg-white/5 flex items-center justify-between">
                 <div className="flex items-center space-x-3">
                   <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-900/20"><Activity size={20} /></div>
                   <h3 className="text-lg font-black text-white uppercase tracking-tight">Real-Time Global Feed</h3>
                 </div>
                 <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] animate-pulse">Live</span>
               </div>
               <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {activities.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-white/10 space-y-4">
                       <Zap size={64} className="opacity-20" />
                       <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Network Signal...</p>
                    </div>
                  ) : (
                    activities.map((log) => (
                      <div key={log.id} className="bg-white/5 border border-white/5 p-5 rounded-[28px] hover:bg-white/10 transition-all group animate-in slide-in-from-bottom-2">
                         <div className="flex items-start space-x-4">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${log.userColor} flex items-center justify-center text-white font-black text-xs shadow-lg`}>
                               {log.userName.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div className="flex-1 min-w-0">
                               <div className="flex justify-between items-center mb-1">
                                  <p className="text-xs font-black text-white">{log.userName === 'You' ? 'You' : log.userName}</p>
                                  <span className="text-[8px] font-black text-white/30 uppercase">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                               </div>
                               <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">{log.action}</p>
                               <p className="text-[11px] text-white/60 font-medium leading-tight">{log.details}</p>
                            </div>
                         </div>
                      </div>
                    ))
                  )}
               </div>
               <div className="p-6 bg-white/5 border-t border-white/5 flex items-center justify-center">
                  <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">End-to-End Encrypted Terminal</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'VERIFIED': return <div className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase border border-emerald-100 flex items-center gap-1"><CheckCircle2 size={10}/> Complete</div>;
    case 'PARTIAL': return <div className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase border border-blue-100 flex items-center gap-1"><Clock size={10}/> Verifying</div>;
    case 'ALERT': return <div className="px-2 py-1 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase border border-rose-100 animate-pulse flex items-center gap-1"><AlertCircle size={10}/> Discrepancy</div>;
    default: return <div className="px-2 py-1 bg-slate-50 text-slate-400 rounded-lg text-[9px] font-black uppercase border border-slate-100 flex items-center gap-1"><Truck size={10}/> In Transit</div>;
  }
};

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; trend: string; positive: boolean }> = ({ title, value, icon, trend, positive }) => (
  <div className="bg-white p-6 rounded-[28px] border-2 border-slate-100 shadow-xl group transition-all">
    <div className="flex items-center justify-between mb-5">
      <div className="p-3 bg-slate-50 rounded-2xl group-hover:scale-110 transition-transform">{icon}</div>
      <div className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${positive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{trend}</div>
    </div>
    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{title}</p>
    <h4 className="text-2xl font-black text-slate-900 mt-1 tracking-tight truncate">{value}</h4>
  </div>
);

export default Dashboard;
