import React, { useState, useMemo } from 'react';
import { InventoryRecord, Product } from '../types';
import { Search, MapPin, Box, Layers, Package, DatabaseZap, Sparkles, Navigation, X } from 'lucide-react';

interface FinderProps {
  inventory: InventoryRecord[];
  products: Product[];
}

const Finder: React.FC<FinderProps> = ({ inventory, products }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return null;

    // 1. Find the product master entry with robust normalization
    const matchedProduct = products.find(p => {
      if (!p) return false;
      const barcodeStr = String(p.barcode || '').trim().toLowerCase();
      const itemCodeStr = String(p.itemCode || '').trim().toLowerCase();
      return barcodeStr === term || itemCodeStr === term;
    });

    // 2. Find all inventory locations for this term
    // Match by the term directly OR if we found a product, use its primary barcode
    const targetBarcode = matchedProduct ? String(matchedProduct.barcode).trim().toLowerCase() : term;

    const locations = inventory.filter(i => {
      if (!i) return false;
      const invBarcode = String(i.barcode || '').trim().toLowerCase();
      const invItemCode = String(i.itemCode || '').trim().toLowerCase();
      
      return invBarcode === term || invItemCode === term || invBarcode === targetBarcode;
    });

    if (matchedProduct || (locations && locations.length > 0)) {
      return {
        product: matchedProduct || { 
          itemCode: locations[0]?.itemCode || 'UNKNOWN', 
          barcode: locations[0]?.barcode || searchTerm,
          description: 'No Metadata Found in Registry',
          brand: 'N/A'
        },
        locations: locations || []
      };
    }

    return null;
  }, [searchTerm, inventory, products]);

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="text-center space-y-4">
        <div className="inline-flex p-4 bg-blue-600 text-white rounded-3xl shadow-2xl shadow-blue-200 mb-2">
          <Navigation size={40} />
        </div>
        <h1 className="text-4xl font-[900] text-slate-900 uppercase tracking-tighter">Inventory GPS</h1>
        <p className="text-slate-500 font-medium">Pinpoint exact warehouse coordinates by Item Code or Barcode.</p>
      </div>

      <div className="relative group max-w-2xl mx-auto">
        <div className="absolute inset-0 bg-blue-600 rounded-[32px] blur-2xl opacity-10 group-focus-within:opacity-20 transition-opacity"></div>
        <div className="relative bg-white border-2 border-slate-100 rounded-[32px] shadow-xl p-2 flex items-center transition-all focus-within:border-blue-500">
          <div className="pl-6 text-slate-400">
            <Search size={28} />
          </div>
          <input 
            type="text" 
            placeholder="Input Item Code or Barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-6 py-6 bg-transparent outline-none font-black text-2xl uppercase tracking-tight placeholder:text-slate-200"
            autoFocus
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="p-4 mr-2 text-slate-300 hover:text-slate-600 bg-slate-50 rounded-2xl transition-all"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {searchResults ? (
        <div className="space-y-8 animate-in zoom-in-95 duration-500">
          {/* Header Card */}
          <div className="bg-slate-900 rounded-[48px] p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12">
              <DatabaseZap size={180} />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div className="space-y-4">
                <span className="px-4 py-1.5 bg-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest">Target Identified</span>
                <h2 className="text-4xl font-black tracking-tight uppercase leading-none">{searchResults.product.itemCode}</h2>
                <p className="text-xl font-medium text-slate-400">{searchResults.product.description}</p>
                <div className="flex gap-6 pt-2">
                   <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Barcode Index</p><p className="font-mono font-bold text-blue-400">{searchResults.product.barcode}</p></div>
                   <div className="h-10 w-px bg-slate-800"></div>
                   <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Registry Brand</p><p className="font-bold">{searchResults.product.brand}</p></div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Aggregate Total</p>
                <h3 className="text-6xl font-black text-blue-500">{searchResults.locations.reduce((acc, l) => acc + (l?.quantity || 0), 0)}<span className="text-lg text-slate-400 ml-2">Pairs</span></h3>
              </div>
            </div>
          </div>

          {/* Locations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {searchResults.locations.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-white rounded-[40px] border-4 border-dashed border-slate-100">
                <Package size={64} className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-400 font-black uppercase tracking-widest">Out of Stock In Main Ledger</p>
              </div>
            ) : (
              searchResults.locations.map((loc, idx) => (
                <div key={`${loc.location}-${loc.boxId}-${idx}`} className="bg-white p-8 rounded-[40px] border-2 border-slate-100 shadow-lg hover:border-blue-500 hover:shadow-2xl hover:-translate-y-1 transition-all group">
                  <div className="flex justify-between items-start mb-8">
                    <div className="p-4 bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white rounded-2xl transition-all shadow-inner">
                      <MapPin size={28} />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Node Status</p>
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase border border-emerald-100">Verified</span>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Storage Address</p>
                      <h4 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{loc.location}</h4>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                          <Box size={18} />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Container</p>
                          <p className="font-bold text-slate-900 leading-none">Box #{loc.boxId}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Qty</p>
                        <p className="text-2xl font-black text-blue-600 leading-none">{loc.quantity}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : searchTerm.trim() ? (
        <div className="py-32 text-center bg-white rounded-[60px] border-4 border-dashed border-slate-100 animate-in fade-in duration-700">
          <Layers size={80} className="mx-auto text-slate-100 mb-6" />
          <h3 className="text-2xl font-black text-slate-400 uppercase tracking-widest">Protocol Signal Lost</h3>
          <p className="text-slate-300 font-bold mt-2">No registry matching "{searchTerm}" found in global ledger.</p>
          <button 
            onClick={() => setSearchTerm('')}
            className="mt-8 px-8 py-3 bg-slate-900 text-white rounded-full font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all"
          >
            Reset Signal
          </button>
        </div>
      ) : (
        <div className="py-32 text-center">
          <Sparkles size={100} className="mx-auto text-slate-100 animate-pulse" />
          <p className="text-slate-300 font-black uppercase tracking-[0.3em] mt-8">Awaiting Input Query</p>
        </div>
      )}
    </div>
  );
};

export default Finder;
