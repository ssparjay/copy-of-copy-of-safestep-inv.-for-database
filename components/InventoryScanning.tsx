
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ScanItem, ScanSession, Product, User, InventoryRecord } from '../types';
import { 
  ScanLine, 
  Trash2, 
  CheckCircle, 
  Zap, 
  X as CloseIcon,
  RefreshCw,
  FileText,
  Truck,
  ClipboardList,
  PackagePlus,
  PackageMinus,
  Calendar,
  History,
  Edit2,
  Box as BoxIcon,
  MapPin,
  AlertTriangle,
  ImageIcon,
  ChevronRight,
  Database,
  Building2,
  Tag,
  ArrowRight,
  Navigation,
  Search,
  CheckSquare,
  PackageSearch,
  Hash,
  MoveRight,
  Monitor,
  LayoutGrid,
  MapPinned,
  Info,
  UserCheck,
  ShieldCheck,
  UserPlus,
  Layers,
  Search as SearchIcon,
  PlusSquare,
  Activity,
  ListFilter,
  Sparkles,
  Package,
  TrendingUp,
  BoxSelect,
  PieChart,
  ListChecks,
  Boxes,
  ArrowLeft,
  FileSearch,
  ClipboardCheck,
  User as UserIcon,
  AlertCircle
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface InventoryScanningProps {
  products: Product[];
  inventory: InventoryRecord[];
  sessions: ScanSession[];
  onCompleteSession: (session: ScanSession) => void;
  onUpdateProduct: (barcode: string, updates: Partial<Product>) => void;
  onAddProduct: (p: Product | Product[]) => void;
  onUpdateSession: (id: string, updates: Partial<ScanSession>) => void;
  onDeleteSession: (id: string) => void;
  onExportSession: (session: ScanSession) => void;
  currentUser: User;
  users: User[];
  isActive?: boolean;

  // LIFTED DRAFT STATE PROPS
  externalDraftItems: ScanItem[];
  onUpdateDraftItems: (items: ScanItem[]) => void;
  externalDraftLocation: string;
  onUpdateDraftLocation: (loc: string) => void;
  externalDraftBoxId: string;
  onUpdateDraftBoxId: (box: string) => void;
  externalDraftScanType: 'INBOUND' | 'OUTBOUND';
  onUpdateDraftScanType: (type: 'INBOUND' | 'OUTBOUND') => void;
  externalDraftDrNumber: string;
  onUpdateDraftDrNumber: (dr: string) => void;
  externalIsTerminalActive: boolean;
  onUpdateTerminalActive: (active: boolean) => void;

  // Additional props for the new Inbound fields
  recipientName: string;
  setRecipientName: (val: string) => void;
}

const VENDORS = [
  { id: 'GENERAL', label: 'General' },
  { id: 'SM', label: 'SM Store' },
  { id: 'SPORTS_CENTRAL', label: 'Sports Central' },
  { id: 'ROBINSON', label: 'Robinson' },
  { id: 'KCC', label: 'KCC' },
  { id: 'CENTRO', label: 'Centro' },
  { id: 'STA_LUCIA', label: 'Sta. Lucia' },
  { id: 'LANDMARK', label: 'Landmark' },
  { id: 'RUSTANS', label: 'Rustans' },
  { id: 'METRO', label: 'Metro' },
  { id: 'ISLAND_MALL', label: 'Island Mall' },
  { id: 'GAISANO_GRAND', label: 'Gaisano Grand' },
  { id: 'GAISANO_FIESTA', label: 'Gaisano Fiesta' }
];

const SHIPPING_BOXES = Array.from({ length: 20 }, (_, i) => String(i + 1));

type OutboundScanStep = 'INITIAL' | 'SELECT_LOCATION' | 'SELECT_SHIP_BOX';
type SummaryMode = 'BY_EVENT' | 'BY_SKU' | 'BY_BOX';

const InventoryScanning: React.FC<InventoryScanningProps> = ({ 
  products, 
  inventory,
  sessions,
  onCompleteSession, 
  onAddProduct,
  currentUser,
  isActive = true,
  
  // SHARED STATE CONSUMPTION
  externalDraftItems,
  onUpdateDraftItems,
  externalDraftLocation,
  onUpdateDraftLocation,
  externalDraftBoxId,
  onUpdateDraftBoxId,
  externalDraftScanType,
  onUpdateDraftScanType,
  externalDraftDrNumber,
  onUpdateDraftDrNumber,
  externalIsTerminalActive,
  onUpdateTerminalActive,

  recipientName,
  setRecipientName
}) => {
  const [activeTab, setActiveTab] = useState<'TERMINAL' | 'HISTORY'>('TERMINAL');
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('BY_BOX');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  
  const [vendorCode, setVendorCode] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [via, setVia] = useState('');
  const [viaAddress, setViaAddress] = useState('');
  const [authorizedBy, setAuthorizedBy] = useState(currentUser.name);
  const [logisticPersonnel, setLogisticPersonnel] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryDate, setDeliveryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [targetVendor, setTargetVendor] = useState<string>('GENERAL');
  
  const [targetShippingBox, setTargetShippingBox] = useState<string>('1');
  const [scanStep, setScanStep] = useState<OutboundScanStep>('INITIAL');

  const [inputBarcode, setInputBarcode] = useState('');
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [showSuccessState, setShowSuccessState] = useState(false);

  // Manual Entry State
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [manualFormData, setManualFormData] = useState<Partial<Product>>({
    barcode: '', itemCode: '', description: '', category: 'FOOTWEAR', brand: ''
  });
  
  const [suggestedLocations, setSuggestedLocations] = useState<{location: string, boxId: string, quantity: number}[]>([]);
  const [locationSearchTerm, setLocationSearchTerm] = useState('');

  const barcodeRef = useRef<HTMLInputElement>(null);
  const locationSearchRef = useRef<HTMLInputElement>(null);
  const audioCtx = useRef<AudioContext | null>(null);

  // 1. Total Box Quantities (Calculated accurately based on item.boxId)
  const boxSummaryTotals = useMemo(() => {
    const summary: Record<string, number> = {};
    externalDraftItems.forEach(item => {
      summary[item.boxId] = (summary[item.boxId] || 0) + item.quantity;
    });
    return summary;
  }, [externalDraftItems]);

  const sortedBoxes = useMemo(() => {
    return Object.keys(boxSummaryTotals).sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      return (!isNaN(numA) && !isNaN(numB)) ? numA - numB : a.localeCompare(b);
    });
  }, [boxSummaryTotals]);

  // 2. Exact Breakdown: Box -> SKU -> Qty
  const detailedBoxBreakdown = useMemo(() => {
    const breakdown: Record<string, Record<string, { itemCode: string, description: string, quantity: number }>> = {};
    externalDraftItems.forEach(item => {
      if (!breakdown[item.boxId]) breakdown[item.boxId] = {};
      if (!breakdown[item.boxId][item.barcode]) {
        breakdown[item.boxId][item.barcode] = { 
          itemCode: item.itemCode, 
          description: item.description, 
          quantity: 0 
        };
      }
      breakdown[item.boxId][item.barcode].quantity += item.quantity;
    });
    return breakdown;
  }, [externalDraftItems]);

  // 3. Overall Batch SKU Totals
  const batchSkuTotals = useMemo(() => {
    const totals: Record<string, { itemCode: string, description: string, quantity: number }> = {};
    externalDraftItems.forEach(item => {
      if (!totals[item.barcode]) {
        totals[item.barcode] = { itemCode: item.itemCode, description: item.description, quantity: 0 };
      }
      totals[item.barcode].quantity += item.quantity;
    });
    return Object.entries(totals).sort((a, b) => (b[1] as any).quantity - (a[1] as any).quantity);
  }, [externalDraftItems]);

  const currentBoxQty = boxSummaryTotals[targetShippingBox] || 0;

  // DYNAMIC STOCK CALCULATION: Subtract current staged draft from ledger totals
  const locationsWithDraftSubtraction = useMemo(() => {
    return suggestedLocations.map(loc => {
      const alreadyInDraft = externalDraftItems
        .filter(i => 
          i.barcode === activeProduct?.barcode && 
          i.location === loc.location && 
          i.originBoxId === loc.boxId
        )
        .reduce((acc, curr) => acc + curr.quantity, 0);
      
      return {
        ...loc,
        availableQuantity: loc.quantity - alreadyInDraft
      };
    });
  }, [suggestedLocations, externalDraftItems, activeProduct]);

  const filteredSuggestedLocations = useMemo(() => {
    return locationsWithDraftSubtraction.filter(loc => 
      loc.location.toLowerCase().includes(locationSearchTerm.toLowerCase()) ||
      loc.boxId.toLowerCase().includes(locationSearchTerm.toLowerCase())
    );
  }, [locationsWithDraftSubtraction, locationSearchTerm]);

  const playBeep = (freq = 880) => {
    try {
      if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
      }
      const oscillator = audioCtx.current.createOscillator();
      const gainNode = audioCtx.current.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, audioCtx.current.currentTime);
      gainNode.gain.setValueAtTime(0.05, audioCtx.current.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.current.currentTime + 0.1);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.current.destination);
      oscillator.start();
      oscillator.stop(audioCtx.current.currentTime + 0.1);
    } catch (e) {}
  };

  useEffect(() => {
    if (isActive && externalIsTerminalActive && !showSuccessState && !isManualEntryOpen && !isReviewModalOpen) {
      if (scanStep === 'INITIAL') barcodeRef.current?.focus();
      else if (scanStep === 'SELECT_LOCATION') locationSearchRef.current?.focus();
    }
  }, [isActive, externalIsTerminalActive, showSuccessState, scanStep, isManualEntryOpen, isReviewModalOpen]);

  const processBarcode = (barcode: string) => {
    const clean = barcode.trim().toUpperCase();
    if (!clean) return;
    setStockError(null);
    setSuggestedLocations([]);
    setLocationSearchTerm('');

    if (externalDraftScanType === 'OUTBOUND') {
      const cleanNumeric = clean.replace(/[^0-9]/g, '');
      const product = products.find(p => p.barcode === (cleanNumeric || clean) || p.itemCode.toUpperCase() === clean);

      if (product) {
        const locations = inventory.filter(i => i.barcode === product.barcode && i.quantity > 0);
        
        // CHECK IF ENTIRE WAREHOUSE STOCK IS ALREADY IN DRAFT
        const totalInInventory = locations.reduce((acc, l) => acc + l.quantity, 0);
        const totalInDraft = externalDraftItems
          .filter(i => i.barcode === product.barcode)
          .reduce((acc, curr) => acc + curr.quantity, 0);

        if (totalInInventory - totalInDraft <= 0) {
          setStockError(`OUT OF STOCK: All available units of ${product.itemCode} are already staged in this batch.`);
          playBeep(220); setInputBarcode('');
          return;
        }

        if (locations.length > 0) {
          setActiveProduct(product);
          setSuggestedLocations(locations);
          setScanStep('SELECT_LOCATION');
          setInputBarcode('');
          playBeep(1200);
        } else {
          setStockError(`SKU RECOGNIZED: ${product.itemCode} has 0 units in the Warehouse Ledger.`);
          playBeep(220); setInputBarcode('');
        }
      } else {
        setStockError(`SIGNAL UNRECOGNIZED: ${clean} is not in the Master Metadata.`);
        playBeep(220); setInputBarcode('');
      }
    } else {
      // INBOUND logic
      if (!externalDraftLocation || !externalDraftBoxId) {
        setStockError("Protocol Error: Target node/box initialization incomplete.");
        playBeep(220); return;
      }
      const cleanNumeric = clean.replace(/[^0-9]/g, '');
      const product = products.find(p => p.barcode === cleanNumeric || p.itemCode.toUpperCase() === clean);
      
      if (!product) {
        setManualFormData({ barcode: cleanNumeric || clean, itemCode: '', description: '', category: 'FOOTWEAR', brand: '', rrp: 0 });
        setIsManualEntryOpen(true);
        playBeep(440);
        return;
      }
      
      executeAddItem(cleanNumeric || clean, externalDraftLocation, targetShippingBox, undefined, product);
    }
  };

  const executeAddItem = (barcode: string, itemLoc: string, targetBoxId: string, originBoxId?: string, product?: Product) => {
    setIsFlashing(true); 
    playBeep(externalDraftScanType === 'INBOUND' ? 880 : 660); 
    setTimeout(() => setIsFlashing(false), 150);

    const existingIdx = externalDraftItems.findIndex(i => 
      i.barcode === barcode && 
      i.location === itemLoc && 
      i.boxId === targetBoxId && 
      (externalDraftScanType === 'INBOUND' || i.originBoxId === originBoxId)
    );

    if (existingIdx !== -1) {
      const updated = [...externalDraftItems];
      updated[existingIdx] = { ...updated[existingIdx], quantity: updated[existingIdx].quantity + 1, timestamp: new Date().toISOString() };
      onUpdateDraftItems(updated);
    } else {
      const newItem: ScanItem = {
        id: Math.random().toString(36).substr(2, 9),
        barcode,
        itemCode: product?.itemCode || 'UNKNOWN',
        description: product?.description || 'Generic Asset',
        quantity: 1,
        timestamp: new Date().toISOString(),
        location: itemLoc,
        boxId: targetBoxId, 
        originBoxId,
        rrp: product?.rrp
      };
      onUpdateDraftItems([newItem, ...externalDraftItems]);
    }
    setInputBarcode('');
  };

  const handleManualEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualFormData.itemCode || !manualFormData.barcode) return;
    const newProduct: Product = {
      barcode: manualFormData.barcode!,
      itemCode: manualFormData.itemCode.toUpperCase(),
      description: manualFormData.description || 'Manual Entry Item',
      category: manualFormData.category || 'FOOTWEAR',
      brand: (manualFormData.brand || 'Generic').toUpperCase(),
      outsole: 'Standard', stock: 0, location: '', rrp: manualFormData.rrp || 0
    };
    onAddProduct(newProduct);
    executeAddItem(newProduct.barcode, externalDraftLocation, targetShippingBox, undefined, newProduct);
    setIsManualEntryOpen(false);
    setInputBarcode('');
  };

  const handleSelectSourceLocation = (loc: string, box: string) => {
    if (!activeProduct) return;
    
    const totalInLedger = inventory.find(i => i.barcode === activeProduct.barcode && i.location === loc && i.boxId === box)?.quantity || 0;
    const alreadyInDraft = externalDraftItems
      .filter(i => i.barcode === activeProduct.barcode && i.location === loc && i.originBoxId === box)
      .reduce((acc, curr) => acc + curr.quantity, 0);

    if (totalInLedger - alreadyInDraft <= 0) {
      setStockError(`ERROR: Node ${loc} (Box #${box}) is out of stock for this SKU.`);
      playBeep(220); return;
    }

    executeAddItem(activeProduct.barcode, loc, targetShippingBox, box, activeProduct);
    setScanStep('INITIAL');
    setActiveProduct(null);
    setSuggestedLocations([]);
    setLocationSearchTerm('');
    setStockError(null);
  };

  const handleAuthorizeCommit = () => {
    if (externalDraftItems.length === 0) return;
    const newSession: ScanSession = {
      id: Date.now().toString(),
      location: externalDraftScanType === 'INBOUND' ? externalDraftLocation : 'HQ-LOGISTICS',
      boxId: externalDraftScanType === 'INBOUND' ? externalDraftLocation : `BATCH-${externalDraftDrNumber}`,
      items: externalDraftItems,
      createdAt: new Date().toISOString(),
      userId: currentUser.id,
      userName: authorizedBy, 
      type: externalDraftScanType,
      recipientName, deliveryAddress, deliveryDate, vendorCode, branchCode, poNumber: externalDraftScanType === 'INBOUND' ? externalDraftBoxId : poNumber, via, viaAddress, authorizedBy,
      drNumber: externalDraftDrNumber, 
      logisticPersonnel,
      targetVendor: targetVendor as any,
      status: 'Finalized'
    };
    onCompleteSession(newSession);
    setShowSuccessState(true);
    setIsReviewModalOpen(false);
    playBeep(1100);
  };

  const handleInitializeHub = () => {
    if (externalDraftScanType === 'INBOUND' && (!externalDraftLocation || !externalDraftBoxId || !recipientName)) {
      setStockError("Protocol Error: Node, PO Number, and Location initialization mandatory.");
      playBeep(220); return;
    }
    if (externalDraftScanType === 'OUTBOUND' && (!externalDraftDrNumber || !recipientName || !poNumber)) {
      setStockError("Protocol Error: DR Number, PO Number, and Recipient required.");
      playBeep(220); return;
    }
    onUpdateTerminalActive(true);
    setStockError(null);
    playBeep(1100);
  };

  const generateAntaDR = (session: ScanSession) => {
    const doc: any = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 12;
    
    doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(46, 88, 163);
    doc.text("SafeStep", pageWidth / 2, 16, { align: "center" });
    doc.setFontSize(12).setTextColor(20).text("Philippines", pageWidth / 2, 21, { align: "center" });
    
    doc.setFontSize(8).setTextColor(80).setFont("helvetica", "normal");
    doc.text("Blk 7 Lot 1 Micro St. Corner Tombow, Sterling Industrial Park, Iba Meycauayan, Bulacan", pageWidth / 2, 27, { align: "center" });
    doc.text("Tel #.: (02) 8519-4245 / (044) 802-7730", pageWidth / 2, 31, { align: "center" });
    
    doc.setFontSize(12).setTextColor(0).setFont("helvetica", "bold");
    doc.text("DELIVERY RECEIPT", pageWidth / 2, 40, { align: "center" });

    const startY = 48;
    const rightMargin = pageWidth - margin;
    doc.setFontSize(9);
    
    doc.text("Vendor Code:", margin, startY);
    doc.setFont("helvetica", "normal").text(session.vendorCode || "", margin + 25, startY);
    
    doc.setFont("helvetica", "bold").text("Branch Code:", margin, startY + 6);
    doc.setFont("helvetica", "normal").text(session.branchCode || "", margin + 25, startY + 6);
    
    doc.setFont("helvetica", "bold").text("Delivered to:", margin, startY + 12);
    doc.setFont("helvetica", "bold").text(session.recipientName || "", margin + 25, startY + 12);
    doc.setFont("helvetica", "normal").setFontSize(8);
    const splitAddr = doc.splitTextToSize(session.deliveryAddress || "", 60);
    doc.text(splitAddr, margin + 25, startY + 17);
    
    doc.setFontSize(9).setFont("helvetica", "bold").text("Via:", margin, startY + 32);
    doc.setFont("helvetica", "normal").text(session.via || "", margin + 25, startY + 32);
    
    doc.setFont("helvetica", "bold").text("Address:", margin, startY + 38);

    doc.setFont("helvetica", "bold");
    doc.text("DR Number:", rightMargin - 45, startY);
    doc.setFont("helvetica", "normal").text(session.drNumber || "", rightMargin, startY, { align: "right" });
    
    doc.setFont("helvetica", "bold").text("Delivery Date:", rightMargin - 45, startY + 6);
    doc.setFont("helvetica", "normal").text(session.deliveryDate || new Date().toISOString().split('T')[0], rightMargin, startY + 6, { align: "right" });
    
    doc.setFont("helvetica", "bold").text("PO#:", rightMargin - 45, startY + 12);
    doc.setFont("helvetica", "normal").text(session.poNumber || session.boxId || "", rightMargin, startY + 12, { align: "right" });

    doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(180, 0, 0);
    doc.text("ANTA", margin, startY + 60);
    doc.setLineWidth(0.5).setDrawColor(180, 0, 0);
    doc.line(margin, startY + 62, margin + 25, startY + 62);

    const tableData = [...session.items].reverse().map(item => {
      const p = products.find(prod => prod.barcode === item.barcode);
      const srp = p?.rrp || item.rrp || 0;
      const total = srp * item.quantity;
      return [
        item.itemCode,
        item.barcode,
        item.quantity,
        "PRS",
        p?.category || "Footwear",
        p?.description || item.description,
        srp.toLocaleString(undefined, { minimumFractionDigits: 0 }),
        total.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        `BOX ${item.boxId}`
      ];
    });

    const totalQty = session.items.reduce((acc, i) => acc + i.quantity, 0);
    const totalVal = session.items.reduce((acc, i) => {
        const p = products.find(prod => prod.barcode === i.barcode);
        return acc + ((p?.rrp || i.rrp || 0) * i.quantity);
    }, 0);

    doc.autoTable({
      startY: startY + 68,
      head: [['PRODUCT ID', 'SKU', 'QT', 'UNIT', 'PRODUCT TYPE', 'DESCRIPTION', 'SRP', 'TOTAL AMOUNT', 'SHIP BOX']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5, halign: 'left', lineWidth: 0.1, lineColor: [200, 200, 200] },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1 },
      columnStyles: {
        2: { halign: 'center', cellWidth: 10 },
        6: { halign: 'right', cellWidth: 15 },
        7: { halign: 'right', cellWidth: 25 },
        8: { halign: 'center', cellWidth: 18 }
      },
      didDrawPage: (data: any) => {
          const finalY = data.cursor.y;
          doc.setFont("helvetica", "bold").setFontSize(9);
          doc.text("===", 72, finalY + 5);
          doc.text("======", 158, finalY + 5);
          doc.text(totalQty.toString(), 72, finalY + 12);
          doc.text(totalVal.toLocaleString(undefined, { minimumFractionDigits: 2 }), 158, finalY + 12);
      }
    });

    const footerY = doc.internal.pageSize.getHeight() - 60;
    const uniqueBoxes = new Set(session.items.map(i => i.boxId)).size;
    
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(0);
    doc.text(`No. of boxes: ${uniqueBoxes}`, 155, footerY - 15);

    doc.setFontSize(10).text(session.authorizedBy || "Safestep Authorized", margin, footerY + 10);
    doc.setLineWidth(0.2).line(margin, footerY + 12, margin + 50, footerY + 12);
    doc.setFontSize(8).setFont("helvetica", "bold").text("Safestep Authorized", margin, footerY + 16);
    
    doc.setFontSize(9).text("Delivered by:", margin, footerY + 30);
    doc.setFontSize(9).text("Safestep Philippines", margin + 25, footerY + 30);
    doc.text("Logistics Personnel", margin + 25, footerY + 35);
    doc.setLineWidth(0.2).line(margin + 25, footerY + 31, margin + 65, footerY + 31);

    doc.setFontSize(9).text("Received by:", 135, footerY);
    doc.setLineWidth(0.2).line(160, footerY + 1, pageWidth - margin, footerY + 1);
    
    doc.setLineWidth(0.2).line(135, footerY + 15, pageWidth - margin, footerY + 15);
    doc.setFontSize(8).text("Printed Name & Signature", 145, footerY + 20);
    
    doc.setFontSize(9).text("Date:", 135, footerY + 30);
    doc.setLineWidth(0.2).line(145, footerY + 31, pageWidth - margin, footerY + 31);

    doc.save(`SafeStep_DR_${session.drNumber || session.id}.pdf`);
  };

  const handleRemoveItemsBySkuAndBox = (barcode: string, boxId: string) => {
    const itemIdx = externalDraftItems.findIndex(i => i.barcode === barcode && i.boxId === boxId);
    if (itemIdx === -1) return;

    const updated = [...externalDraftItems];
    const item = updated[itemIdx];

    if (item.quantity > 1) {
      updated[itemIdx] = { ...item, quantity: item.quantity - 1, timestamp: new Date().toISOString() };
    } else {
      updated.splice(itemIdx, 1);
    }

    onUpdateDraftItems(updated);
    playBeep(440);
  };

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-300 w-full max-w-[1920px] mx-auto overflow-hidden">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-[24px] border border-slate-200 shadow-sm shrink-0">
          <button onClick={() => setActiveTab('TERMINAL')} className={`px-8 py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2.5 ${activeTab === 'TERMINAL' ? 'bg-white text-blue-600 shadow-lg ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}><Monitor size={16} /> Console</button>
          <button onClick={() => setActiveTab('HISTORY')} className={`px-8 py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2.5 ${activeTab === 'HISTORY' ? 'bg-white text-blue-600 shadow-lg ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}><History size={16} /> Archives</button>
        </div>
      </div>

      {activeTab === 'HISTORY' ? (
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 p-2 custom-scrollbar">
          {sessions.map(session => (
            <div key={session.id} className="bg-white p-7 rounded-[40px] border border-slate-100 shadow-xl hover:shadow-2xl transition-all group relative overflow-hidden flex flex-col">
               <div className="flex justify-between items-start mb-6"><div className={`p-3 rounded-xl ${session.type === 'INBOUND' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>{session.type === 'INBOUND' ? <PackagePlus size={24} /> : <Truck size={24} />}</div></div>
               <div className="flex-1"><h3 className="text-xl font-black text-slate-900 truncate uppercase tracking-tight">{session.drNumber || 'BATCH-MANIFEST'}</h3><p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Target: {session.recipientName || session.location}</p></div>
               <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between"><button onClick={() => generateAntaDR(session)} className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2"><FileText size={16} /><span className="text-[9px] font-black uppercase tracking-widest">DR PDF</span></button></div>
            </div>
          ))}
        </div>
      ) : showSuccessState ? (
        <div className="flex-1 flex items-center justify-center">
           <div className="bg-white p-16 rounded-[64px] shadow-2xl space-y-10 max-w-2xl w-full border border-slate-100 text-center animate-in zoom-in-95 duration-500">
              <div className="w-32 h-32 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner"><CheckCircle size={64} /></div>
              <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter">Manifest Authorized</h2>
              <button onClick={() => { setShowSuccessState(false); onUpdateTerminalActive(false); setScanStep('INITIAL'); }} className="w-full py-7 bg-slate-900 text-white rounded-3xl font-black text-2xl hover:bg-slate-800 transition-all uppercase tracking-widest shadow-xl shadow-slate-200">Return to Hub</button>
           </div>
        </div>
      ) : externalIsTerminalActive ? (
        <div className="flex-1 flex flex-col space-y-6 overflow-hidden">
          {/* Main Status Header */}
          <div className={`text-white px-10 py-7 rounded-[48px] flex items-center justify-between shadow-2xl border-b-8 shrink-0 ${externalDraftScanType === 'INBOUND' ? 'bg-emerald-950 border-emerald-900' : 'bg-slate-950 border-slate-900'}`}>
            <div className="flex items-center space-x-12">
              <div className="flex flex-col"><span className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-1.5">Context Protocol</span><div className="flex items-center gap-3"><span className="font-mono text-3xl font-black uppercase tracking-tighter">{externalDraftScanType === 'INBOUND' ? `NODE: ${externalDraftLocation}` : `DR: ${externalDraftDrNumber}`}</span></div></div>
              <div className="h-14 w-px bg-white/5"></div>
              <div className="flex flex-col"><span className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-1.5">Total Units in Batch</span><span className="font-black text-5xl tabular-nums text-blue-400">{externalDraftItems.reduce((acc, i) => acc + i.quantity, 0)}</span></div>
            </div>
            <div className="flex items-center space-x-6">
              <button onClick={() => setIsReviewModalOpen(true)} className={`px-12 py-5 rounded-[24px] text-xl font-black text-white shadow-2xl uppercase transition-all tracking-widest flex items-center gap-3 ${externalDraftScanType === 'INBOUND' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/40'}`}><FileSearch size={28} /> Review Manifest</button>
              <button onClick={() => onUpdateTerminalActive(false)} className="p-5 text-slate-500 hover:text-rose-500 bg-white/5 hover:bg-white/10 rounded-[20px] transition-all"><CloseIcon size={28} /></button>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            {scanStep === 'SELECT_LOCATION' && activeProduct ? (
              <div className="flex-1 flex flex-col space-y-6 animate-in zoom-in-95 duration-500 overflow-hidden px-2">
                <div className="bg-slate-900 rounded-[48px] p-8 text-white shadow-2xl relative overflow-hidden shrink-0">
                  <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12"><Database size={150} /></div>
                  <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-3"><span className="px-4 py-1.5 bg-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest">Pick Target Identified</span><h2 className="text-3xl font-black tracking-tight uppercase leading-none">{activeProduct.itemCode}</h2><p className="text-lg font-medium text-slate-400">{activeProduct.description}</p></div>
                    <div className="flex items-center gap-4">
                      <div className="bg-white/10 px-6 py-4 rounded-2xl border border-white/20">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Batch Total Scanned</p>
                         <p className="text-2xl font-black text-blue-400">{externalDraftItems.filter(i => i.barcode === activeProduct.barcode).reduce((acc, curr) => acc + curr.quantity, 0)} units</p>
                      </div>
                      <input ref={locationSearchRef} type="text" placeholder="Filter Nodes..." value={locationSearchTerm} onChange={(e) => setLocationSearchTerm(e.target.value.toUpperCase())} className="w-full md:w-80 px-6 py-4 bg-white/5 border-2 border-white/10 rounded-2xl outline-none font-bold text-sm focus:border-blue-500 focus:bg-white focus:text-slate-900 transition-all uppercase" />
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {filteredSuggestedLocations.map((loc, idx) => {
                        const isDepleted = loc.availableQuantity <= 0;
                        return (
                          <button 
                            key={`${loc.location}-${loc.boxId}-${idx}`} 
                            disabled={isDepleted}
                            onClick={() => handleSelectSourceLocation(loc.location, loc.boxId)} 
                            className={`bg-white p-8 rounded-[40px] border-2 shadow-lg text-left flex flex-col group transition-all relative overflow-hidden ${isDepleted ? 'border-rose-100 opacity-60 grayscale' : 'border-slate-100 hover:border-blue-500 hover:-translate-y-1'}`}
                          >
                            <div className="flex justify-between items-start mb-8">
                              <div className={`p-4 rounded-2xl shadow-inner transition-colors ${isDepleted ? 'bg-rose-50 text-rose-300' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white'}`}><MapPin size={28} /></div>
                              {isDepleted ? (
                                <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[9px] font-black uppercase border border-rose-100 flex items-center gap-1"><AlertTriangle size={10} /> Depleted</span>
                              ) : (
                                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase border border-emerald-100">Stock OK</span>
                              )}
                            </div>
                            <div className="space-y-6 flex-1">
                              <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Storage Address</p><h4 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-tight">{loc.location}</h4></div>
                              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${isDepleted ? 'bg-slate-300' : 'bg-slate-900'}`}><BoxIcon size={18} /></div><div><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Container</p><p className="font-bold text-slate-900">Box #{loc.boxId}</p></div></div>
                                <div className="text-right">
                                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Available</p>
                                  <p className={`text-2xl font-black leading-none tabular-nums ${isDepleted ? 'text-rose-500' : 'text-blue-600'}`}>{loc.availableQuantity}</p>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                   </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 flex-1 min-h-0 px-2">
                <div className="xl:col-span-4 flex flex-col space-y-6 overflow-hidden">
                  <div className={`bg-white p-10 rounded-[56px] border-4 shadow-2xl transition-all flex flex-col shrink-0 ${isFlashing ? 'border-blue-400 ring-[12px] ring-blue-50 scale-[1.02]' : 'border-slate-100'} ${stockError ? 'border-rose-400 ring-[12px] ring-rose-50' : ''}`}>
                    <div className="flex items-center justify-between mb-8">
                       <div className="flex items-center gap-4"><div className="p-4 bg-blue-50 rounded-full shadow-inner animate-pulse"><ScanLine size={32} className="text-blue-600" /></div><div><h3 className="font-black text-sm uppercase tracking-widest text-slate-400">Registry Sync</h3><p className="text-[10px] font-bold text-slate-300 uppercase">Input Item Signal</p></div></div>
                       <div className="bg-slate-900 text-white px-5 py-4 rounded-[28px] flex items-center gap-5 shadow-xl border-b-4 border-slate-950">
                          <div className="flex flex-col"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Active Box</span><span className="text-lg font-black leading-none">#{targetShippingBox}</span></div>
                          <div className="h-6 w-px bg-white/10"></div>
                          <div className="flex flex-col text-right"><span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Box Total</span><span className="text-2xl font-black leading-none text-blue-500 tabular-nums">{currentBoxQty}</span></div>
                       </div>
                    </div>
                    <input ref={barcodeRef} type="text" value={inputBarcode} onKeyDown={(e) => e.key === 'Enter' && processBarcode(inputBarcode)} onChange={(e) => setInputBarcode(e.target.value)} placeholder="SCAN ITEM..." className="w-full px-6 py-8 bg-slate-50 border-4 border-slate-100 rounded-[40px] outline-none font-black text-5xl uppercase text-center focus:border-blue-500 focus:bg-white transition-all shadow-inner tabular-nums" />
                    {stockError && <div className="mt-6 p-5 bg-rose-50 text-rose-600 border-2 border-rose-100 rounded-[28px] flex items-start gap-3 animate-in slide-in-from-top-4"><AlertTriangle size={20} className="shrink-0 mt-1" /><p className="text-xs font-black uppercase text-left leading-relaxed">{stockError}</p></div>}
                  </div>

                  <div className="bg-slate-900 p-8 rounded-[56px] shadow-2xl flex flex-col min-h-0 flex-1 border border-slate-800">
                    <div className="flex items-center justify-between mb-6 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-lg"><BoxSelect size={20} /></div>
                        <div><h4 className="font-black text-sm uppercase tracking-tight text-white">Live Box #{targetShippingBox} Audit</h4><p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Current Internal Manifest</p></div>
                      </div>
                      <div className="text-right"><span className="text-[9px] font-black text-blue-400 uppercase tracking-widest block mb-0.5">Sum</span><span className="text-2xl font-black text-white tabular-nums leading-none">{currentBoxQty} <span className="text-xs text-slate-500">units</span></span></div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                      {detailedBoxBreakdown[targetShippingBox] ? Object.entries(detailedBoxBreakdown[targetShippingBox]).map(([barcode, item]: [string, any]) => (
                        <div key={barcode} className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center justify-between group animate-in fade-in">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-inner tabular-nums">{item.quantity}</div>
                             <div className="min-w-0"><h5 className="text-white font-black text-xs uppercase truncate w-40">{item.itemCode}</h5><p className="text-[9px] text-slate-500 font-bold uppercase truncate w-40">{item.description}</p></div>
                          </div>
                          <div className="flex items-center gap-2"><span className="text-[8px] font-black text-slate-600 uppercase bg-white/5 px-2 py-1 rounded-md">packed</span></div>
                        </div>
                      )) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-700 space-y-4"><div className="p-4 rounded-full border-2 border-slate-800 border-dashed opacity-20"><Package size={40} /></div><p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 text-center px-6">Box Container empty.</p></div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-8 flex flex-col space-y-6 overflow-hidden">
                  <div className="bg-white p-8 rounded-[56px] border border-slate-100 shadow-2xl overflow-hidden flex flex-col h-[260px] shrink-0">
                    <div className="mb-6 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-3"><LayoutGrid size={24} className="text-blue-600" /><h4 className="font-black text-lg uppercase tracking-tight text-slate-900">Ship Box Matrix</h4></div>
                      <div className="flex items-center gap-4">
                        <div className="relative group min-w-[200px]"><PlusSquare className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={18} /><input type="text" placeholder="Manual Box ID..." value={targetShippingBox} onChange={(e) => setTargetShippingBox(e.target.value.toUpperCase())} className="w-full pl-11 pr-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs uppercase outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner" /></div>
                        <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100"><TrendingUp size={14} className="text-blue-500" /><span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{sortedBoxes.length} Boxes in Batch</span></div>
                      </div>
                    </div>
                    <div className="grid grid-flow-col auto-cols-[80px] gap-4 flex-1 overflow-x-auto no-scrollbar pb-2 items-center">
                      {SHIPPING_BOXES.map(box => {
                        const qtyInBox = boxSummaryTotals[box] || 0;
                        const isTarget = targetShippingBox === box;
                        return (
                          <button key={box} onClick={() => { setTargetShippingBox(box); playBeep(1100); }} className={`aspect-square flex flex-col items-center justify-center rounded-[28px] text-lg font-black transition-all border-4 relative overflow-hidden group ${isTarget ? 'bg-blue-600 text-white border-blue-600 shadow-2xl scale-105 z-10' : 'bg-slate-50 text-slate-300 border-slate-100 hover:border-blue-300 hover:text-blue-500'}`}>
                            <span className={`text-[8px] mb-0.5 opacity-50 uppercase tracking-tighter ${isTarget ? 'text-blue-200' : ''}`}>Box</span><span className="leading-none">{box}</span>
                            {qtyInBox > 0 && <div className={`absolute -bottom-1 -right-1 min-w-[26px] h-[26px] flex items-center justify-center rounded-tl-xl border-t-2 border-l-2 font-black text-[10px] tabular-nums ${isTarget ? 'bg-white text-blue-600 border-blue-500' : 'bg-blue-600 text-white border-white shadow-lg'}`}>{qtyInBox}</div>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex-1 bg-white rounded-[56px] border border-slate-100 overflow-hidden flex flex-col shadow-2xl min-h-0">
                    <div className="px-10 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between shrink-0">
                       <div className="flex items-center gap-4 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                          <button onClick={() => setSummaryMode('BY_BOX')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${summaryMode === 'BY_BOX' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}><Boxes size={16}/> Box Audit</button>
                          <button onClick={() => setSummaryMode('BY_SKU')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${summaryMode === 'BY_SKU' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}><PieChart size={16}/> SKU Totals</button>
                          <button onClick={() => setSummaryMode('BY_EVENT')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${summaryMode === 'BY_EVENT' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}><ListChecks size={16}/> Live Flow</button>
                       </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                       {summaryMode === 'BY_BOX' ? (
                         <div className="space-y-8">
                            {sortedBoxes.length === 0 ? (
                              <div className="py-24 flex flex-col items-center justify-center text-slate-200 space-y-4"><Boxes size={80} className="opacity-10" /><p className="font-black uppercase tracking-widest text-xs">No containers initialized in current batch</p></div>
                            ) : (
                              sortedBoxes.map(boxId => (
                                <div key={boxId} className="bg-slate-50/50 rounded-[40px] border-2 border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                                   <div className="px-8 py-5 bg-slate-100/50 border-b border-slate-100 flex items-center justify-between">
                                      <div className="flex items-center gap-4">
                                         <div className="p-2 bg-slate-900 text-white rounded-xl"><BoxIcon size={18} /></div>
                                         <h4 className="font-black text-slate-900 uppercase tracking-tight">Box #{boxId} Packing List</h4>
                                      </div>
                                      <span className="px-4 py-1.5 bg-blue-600 text-white rounded-full font-black text-xs tabular-nums shadow-lg">{boxSummaryTotals[boxId]} Units</span>
                                   </div>
                                   <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {detailedBoxBreakdown[boxId] ? Object.entries(detailedBoxBreakdown[boxId]).map(([barcode, data]: [string, any]) => (
                                        <div key={barcode} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm group hover:border-blue-200 transition-all">
                                           <div className="flex items-center gap-4">
                                              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center font-black text-blue-600 border border-slate-100 group-hover:scale-105 transition-transform tabular-nums">{data.quantity}</div>
                                              <div className="min-w-0"><h5 className="font-black text-slate-900 uppercase text-xs truncate">{data.itemCode}</h5><p className="text-[9px] font-bold text-slate-400 uppercase truncate">{data.description}</p></div>
                                           </div>
                                           <button 
                                              onClick={(e) => { e.stopPropagation(); handleRemoveItemsBySkuAndBox(barcode, boxId); }}
                                              className="p-2.5 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                              title="Remove 1 unit from Box"
                                           >
                                              <Trash2 size={16} />
                                           </button>
                                        </div>
                                      )) : null}
                                   </div>
                                </div>
                              ))
                            )}
                         </div>
                       ) : summaryMode === 'BY_SKU' ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {batchSkuTotals.map(([barcode, data]: [string, any]) => (
                              <div key={barcode} className="bg-white p-6 rounded-[32px] border-2 border-slate-50 flex items-center justify-between hover:border-blue-100 transition-all group shadow-sm hover:shadow-xl">
                                 <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-3xl shadow-lg group-hover:scale-110 transition-transform tabular-nums">{data.quantity}</div>
                                    <div><h4 className="font-black text-slate-900 uppercase text-sm tracking-tight">{data.itemCode}</h4><p className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[240px]">{data.description}</p></div>
                                 </div>
                                 <span className="text-[9px] font-black text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 uppercase tracking-widest whitespace-nowrap">Dist. in {new Set(externalDraftItems.filter(i => i.barcode === barcode).map(i => i.boxId)).size} Boxes</span>
                              </div>
                            ))}
                         </div>
                       ) : (
                         <div className="divide-y divide-slate-50">
                            {externalDraftItems.map(item => (
                              <div key={item.id} className="py-6 flex items-center justify-between hover:bg-slate-50/50 transition-all group px-4 rounded-3xl animate-in slide-in-from-right-4">
                                <div className="flex items-center space-x-8">
                                  <div className="relative"><div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl tabular-nums">{item.quantity}</div><div className="absolute -top-2 -right-2 w-7 h-7 bg-blue-600 rounded-full border-4 border-white flex items-center justify-center text-white text-[9px] font-black shadow-lg">#{item.boxId}</div></div>
                                  <div><h4 className="text-xl font-black text-slate-900 tracking-tighter leading-none uppercase">{item.description}</h4><div className="flex flex-wrap items-center gap-4 mt-2.5"><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-2.5 py-1 rounded-lg border">{item.itemCode}</span><div className="flex items-center gap-1.5 py-1 px-2.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase"><MapPin size={12}/>{item.location}</div><div className="flex items-center gap-1.5 py-1 px-2.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase"><MoveRight size={12}/>BOX {item.boxId}</div></div></div>
                                </div>
                                <button onClick={() => onUpdateDraftItems(externalDraftItems.filter(i => i.id !== item.id))} className="p-5 text-slate-200 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100 active:scale-90"><Trash2 size={24} /></button>
                              </div>
                            ))}
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center max-w-[1600px] mx-auto w-full px-4">
           <div className="bg-white p-16 rounded-[72px] border shadow-2xl relative overflow-hidden flex flex-col lg:flex-row gap-20">
            <div className="lg:w-[380px] space-y-10 relative z-10 border-r border-slate-100 pr-20 shrink-0">
              <div className="flex items-center space-x-6"><div className={`p-8 rounded-[36px] text-white shadow-2xl transition-colors ${externalDraftScanType === 'INBOUND' ? 'bg-emerald-600' : 'bg-blue-600'}`}>{externalDraftScanType === 'INBOUND' ? <PackagePlus size={64} /> : <PackageMinus size={64} />}</div><div className="space-y-1"><h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">Global Hub</h1><p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest ml-1">Dispatch Initialization</p></div></div>
              <div className="flex flex-col gap-5">
                <button onClick={() => onUpdateDraftScanType('INBOUND')} className={`p-8 rounded-[36px] border-4 transition-all flex items-center gap-8 group text-left ${externalDraftScanType === 'INBOUND' ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xl' : 'bg-white border-slate-100 text-slate-400 hover:border-emerald-200'}`}><div className={`p-5 rounded-2xl transition-colors ${externalDraftScanType === 'INBOUND' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}><PackagePlus size={28} /></div><div><span className="font-black uppercase tracking-widest text-xl block">Inbound</span></div></button>
                <button onClick={() => onUpdateDraftScanType('OUTBOUND')} className={`p-8 rounded-[36px] border-4 transition-all flex items-center gap-8 group text-left ${externalDraftScanType === 'OUTBOUND' ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-xl' : 'bg-white border-slate-100 text-slate-400 hover:border-blue-200'}`}><div className={`p-5 rounded-2xl transition-colors ${externalDraftScanType === 'OUTBOUND' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}><PackageMinus size={28} /></div><div><span className="font-black uppercase tracking-widest text-xl block">Outbound</span></div></button>
              </div>
              <button onClick={handleInitializeHub} className={`w-full py-8 text-white rounded-[40px] font-black text-2xl flex items-center justify-center space-x-4 shadow-2xl transition-all active:scale-95 group ${externalDraftScanType === 'INBOUND' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}><Zap size={32} fill="currentColor" /><span>{externalDraftItems.length > 0 ? 'Resume Session' : 'Initialize Console'}</span></button>
            </div>
            <div className="flex-1 flex flex-col relative z-10 overflow-y-auto no-scrollbar max-h-[80vh] custom-scrollbar">
              <div className="bg-slate-50/50 p-12 rounded-[56px] border-2 border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-10 h-full content-start">
                {externalDraftScanType === 'INBOUND' ? (
                  <>
                    <div className="col-span-full border-b border-slate-200 pb-6 flex items-center gap-4 text-emerald-700"><MapPin size={32} /><h3 className="font-black text-xl uppercase tracking-widest">Inbound Target Coordinates</h3></div>
                    <div className="space-y-3"><label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">Warehouse Node</label><input type="text" value={externalDraftLocation} onChange={e => onUpdateDraftLocation(e.target.value.toUpperCase())} placeholder="e.g. ALPHA-01" className="w-full px-8 py-6 bg-white border-2 border-slate-200 rounded-[32px] outline-none font-black text-3xl focus:border-emerald-500 uppercase shadow-lg shadow-emerald-950/5" /></div>
                    <div className="space-y-3"><label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">PO Number</label><input type="text" value={externalDraftBoxId} onChange={e => onUpdateDraftBoxId(e.target.value.toUpperCase())} placeholder="PO-XXXX" className="w-full px-8 py-6 bg-white border-2 border-slate-200 rounded-[32px] outline-none font-black text-3xl focus:border-emerald-500 uppercase shadow-lg shadow-emerald-950/5" /></div>
                    <div className="space-y-3 col-span-full"><label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">Inbound Location</label><input type="text" value={recipientName} onChange={e => setRecipientName(e.target.value.toUpperCase())} placeholder="e.g. MANILA MAIN HUB" className="w-full px-8 py-6 bg-white border-2 border-slate-200 rounded-[32px] outline-none font-black text-3xl focus:border-emerald-500 uppercase shadow-lg shadow-emerald-950/5" /></div>
                    <div className="col-span-full space-y-3 pt-6 border-t border-slate-100">
                       <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">Operator Identity</label>
                       <div className="w-full relative group">
                          <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-600" size={24} />
                          <input 
                            type="text" 
                            value={authorizedBy} 
                            onChange={e => setAuthorizedBy(e.target.value)} 
                            placeholder="Type Operator Name..." 
                            className="w-full pl-16 pr-8 py-6 bg-white border-2 border-slate-200 rounded-[32px] outline-none font-black text-xl focus:border-emerald-500 uppercase shadow-lg shadow-emerald-950/5 transition-all" 
                          />
                       </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-span-full flex items-center justify-between border-b border-slate-200 pb-6"><h3 className="font-black text-xl uppercase tracking-[0.3em] text-blue-700 flex items-center"><ClipboardList size={32} className="mr-4" /> Logistics Hub Configuration</h3></div>
                    <div className="col-span-full space-y-4 bg-white p-8 rounded-[40px] border-2 border-slate-100 shadow-xl mb-4"><label className="text-[11px] font-black text-blue-500 uppercase tracking-[0.2em] ml-2 flex items-center gap-3"><Building2 size={20}/> Partner SKU Mapping Intelligence</label><div className="flex wrap gap-3">{VENDORS.map(v => (<button key={v.id} onClick={() => setTargetVendor(v.id as any)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${targetVendor === v.id ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-105' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-300'}`}>{v.label}</button>))}</div></div>
                    
                    <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">Vendor Code</label>
                        <input type="text" value={vendorCode} onChange={e => setVendorCode(e.target.value.toUpperCase())} placeholder="V-000" className="w-full px-6 py-5 bg-white border-2 border-slate-200 rounded-[28px] outline-none font-black text-xl focus:border-blue-500 shadow-lg shadow-blue-950/5 transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">Branch Code</label>
                        <input type="text" value={branchCode} onChange={e => setBranchCode(e.target.value.toUpperCase())} placeholder="B-000" className="w-full px-6 py-5 bg-white border-2 border-slate-200 rounded-[28px] outline-none font-black text-xl focus:border-blue-500 shadow-lg shadow-blue-950/5 transition-all" />
                      </div>
                    </div>

                    <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">DR Number</label>
                        <input type="text" value={externalDraftDrNumber} onChange={e => onUpdateDraftDrNumber(e.target.value.toUpperCase())} placeholder="REQUIRED" className="w-full px-6 py-5 bg-white border-2 border-blue-100 rounded-[28px] outline-none font-black text-xl focus:border-blue-500" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">PO Number</label>
                        <input type="text" value={poNumber} onChange={e => setPoNumber(e.target.value.toUpperCase())} placeholder="PO-XXXXX" className="w-full px-6 py-5 bg-white border-2 border-slate-200 rounded-[28px] outline-none font-black text-xl focus:border-blue-500 shadow-lg shadow-blue-950/5 transition-all" />
                      </div>
                    </div>

                    <div className="col-span-full 2xl:col-span-2 space-y-2"><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">Delivered to:</label><input type="text" value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="MARILAO" className="w-full px-8 py-6 bg-white border-2 border-slate-200 rounded-[32px] outline-none font-black text-2xl focus:border-blue-500 shadow-xl shadow-slate-900/5" /></div>
                    <div className="col-span-full space-y-2"><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">Logistics Hub Address</label><textarea value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Complete Warehouse/Store Dispatch Address..." className="w-full px-8 py-6 bg-white border-2 border-slate-200 rounded-[32px] outline-none font-bold text-xl focus:border-blue-500 h-32 resize-none" /></div>
                    <div className="col-span-full space-y-3 pt-6 border-t border-slate-100">
                       <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">Operator Identity</label>
                       <div className="w-full relative group">
                          <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-blue-600" size={24} />
                          <input 
                            type="text" 
                            value={authorizedBy} 
                            onChange={e => setAuthorizedBy(e.target.value)} 
                            placeholder="Type Operator Name..." 
                            className="w-full pl-16 pr-8 py-6 bg-white border-2 border-slate-200 rounded-[32px] outline-none font-black text-xl focus:border-blue-500 uppercase shadow-lg shadow-blue-950/5 transition-all" 
                          />
                       </div>
                    </div>
                  </>
                )}
              </div>
            </div>
           </div>
        </div>
      )}

      {/* MANIFEST REVIEW SUMMARY OVERLAY */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/80 backdrop-blur-2xl animate-in fade-in">
          <div className="bg-white w-full h-full lg:max-w-7xl lg:h-[90vh] lg:rounded-[64px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
             <div className={`p-10 flex items-center justify-between border-b shrink-0 ${externalDraftScanType === 'INBOUND' ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'}`}>
                <div className="flex items-center space-x-6">
                   <div className={`p-5 rounded-3xl text-white shadow-xl ${externalDraftScanType === 'INBOUND' ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                      <ClipboardCheck size={32} />
                   </div>
                   <div>
                      <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Manifest Review Protocol</h2>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Audit the batch structure before registry commitment</p>
                   </div>
                </div>
                <button onClick={() => setIsReviewModalOpen(false)} className="p-4 bg-white text-slate-400 hover:text-rose-500 rounded-full shadow-lg transition-all"><CloseIcon size={28} /></button>
             </div>

             <div className="flex-1 overflow-y-auto custom-scrollbar p-12 space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                   <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><MapPin size={12}/> Target Node</p>
                      <p className="text-2xl font-black text-slate-900 uppercase">{externalDraftLocation}</p>
                   </div>
                   <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><FileSearch size={12}/> PO Number / ID</p>
                      <p className="text-2xl font-black text-slate-900 uppercase">{externalDraftScanType === 'INBOUND' ? externalDraftBoxId : poNumber}</p>
                   </div>
                   <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><UserIcon size={12}/> Scanned by:</p>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${currentUser.color} flex items-center justify-center text-white font-black text-[10px] shadow-md`}>{authorizedBy.split(' ').map(n => n[0]).join('')}</div>
                        <p className="text-xl font-black text-slate-900 uppercase truncate">{authorizedBy}</p>
                      </div>
                   </div>
                   <div className="bg-slate-900 p-8 rounded-[40px] text-white">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Aggregate Units</p>
                      <p className="text-4xl font-black tabular-nums">{externalDraftItems.reduce((acc, i) => acc + i.quantity, 0)} <span className="text-sm text-slate-500 uppercase font-bold tracking-widest ml-2">Units in Batch</span></p>
                   </div>
                </div>

                <div className="space-y-8">
                   <div className="flex items-center gap-4"><div className="w-10 h-1 border-t-4 border-blue-600 rounded-full"></div><h3 className="font-black text-xl uppercase tracking-widest text-slate-900">Container Audit Breakdown</h3></div>
                   
                   <div className="grid grid-cols-1 gap-8">
                      {sortedBoxes.map(boxId => (
                        <div key={boxId} className="bg-white rounded-[48px] border-2 border-slate-100 shadow-sm overflow-hidden group">
                           <div className="px-10 py-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                 <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg">#{boxId}</div>
                                 <div><h4 className="font-black text-slate-900 uppercase tracking-tight">Container Packing List</h4><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Physical Location Verified</p></div>
                              </div>
                              <div className="text-right">
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Quantity</p>
                                 <p className="text-2xl font-black text-blue-600 tabular-nums">{boxSummaryTotals[boxId]} Units</p>
                              </div>
                           </div>
                           <div className="p-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                              {Object.entries(detailedBoxBreakdown[boxId]).map(([barcode, data]: [string, any]) => (
                                <div key={barcode} className="flex items-center justify-between p-5 bg-slate-50/30 rounded-3xl border border-slate-50 group-hover:border-slate-100 transition-colors">
                                   <div className="flex items-center gap-5">
                                      <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center font-black text-blue-600 shadow-sm tabular-nums">{data.quantity}</div>
                                      <div className="min-w-0"><h5 className="font-black text-slate-900 uppercase text-xs truncate leading-none">{data.itemCode}</h5><p className="text-[9px] font-bold text-slate-400 uppercase truncate mt-1.5">{data.description}</p></div>
                                   </div>
                                </div>
                              ))}
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
             </div>

             <div className="p-10 border-t bg-slate-50 flex items-center justify-between shrink-0">
                <button onClick={() => setIsReviewModalOpen(false)} className="flex items-center gap-3 px-10 py-6 bg-white border-2 border-slate-200 rounded-[32px] font-black text-slate-500 uppercase tracking-widest hover:border-slate-300 transition-all"><ArrowLeft size={24}/> Return to Terminal</button>
                <div className="flex items-center gap-6">
                   <div className="text-right hidden sm:block"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Authorization State</p><p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Certified by: {authorizedBy}</p></div>
                   <button onClick={handleAuthorizeCommit} className={`flex items-center gap-4 px-16 py-6 rounded-[32px] font-black text-white text-xl uppercase tracking-widest shadow-2xl transition-all active:scale-95 ${externalDraftScanType === 'INBOUND' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/30'}`}><CheckCircle size={28} /> Confirm & Commit Batch</button>
                </div>
             </div>
          </div>
        </div>
      )}

      {isManualEntryOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[48px] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col border border-slate-100">
             <div className="p-8 border-b flex items-center justify-between bg-slate-50 shrink-0"><div className="flex items-center space-x-5"><div className="p-4 bg-blue-600 text-white rounded-3xl shadow-xl"><Sparkles size={28} /></div><div><h2 className="text-2xl font-black text-slate-900 uppercase leading-none">Unknown Asset</h2><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Manual Registry Entry Required</p></div></div><button onClick={() => setIsManualEntryOpen(false)} className="p-2.5 text-slate-400 hover:text-slate-600 bg-white rounded-full"><CloseIcon size={22} /></button></div>
             <form onSubmit={handleManualEntrySubmit} className="p-10 space-y-6 overflow-y-auto custom-scrollbar">
                <div className="p-6 bg-blue-50 rounded-3xl border-2 border-blue-100 mb-2"><p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Detected Barcode</p><p className="font-mono font-black text-2xl text-blue-600 tabular-nums">{manualFormData.barcode}</p></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Item Code / Model</label><input required autoFocus type="text" value={manualFormData.itemCode} onChange={e => setManualFormData({...manualFormData, itemCode: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-2 rounded-2xl outline-none font-bold text-lg uppercase focus:border-blue-500" placeholder="e.g. CORE-123" /></div>
                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Brand</label><input required type="text" value={manualFormData.brand} onChange={e => setManualFormData({...manualFormData, brand: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-2 rounded-2xl outline-none font-bold uppercase focus:border-blue-500" placeholder="e.g. ANTA" /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Price (PHP)</label><input type="number" value={manualFormData.rrp || ''} onChange={e => setManualFormData({...manualFormData, rrp: Number(e.target.value)})} className="w-full px-6 py-4 bg-slate-50 border-2 rounded-2xl outline-none font-black text-lg focus:border-blue-500" placeholder="0.00" /></div></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Description</label><textarea required value={manualFormData.description} onChange={setFormDataDescription(manualFormData, setManualFormData)} className="w-full px-6 py-4 bg-slate-50 border-2 rounded-2xl outline-none font-bold text-sm h-24 resize-none focus:border-blue-500" placeholder="Add model details..." /></div>
                <button type="submit" className="w-full py-6 bg-slate-900 text-white rounded-[32px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 mt-4"><CheckCircle size={24} /> Register & Add to Batch</button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

const setFormDataDescription = (data: any, setter: any) => (e: any) => setter({...data, description: e.target.value});

export default InventoryScanning;
