import * as XLSX from 'xlsx';
import { Product, InventoryRecord } from '../types';

export const exportToExcel = (data: any[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "InventoryData");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportMultiSheetToExcel = (sheets: { [key: string]: any[] }, fileName: string) => {
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, data]) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  });
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const downloadProductTemplate = () => {
  const headers = [
    'Barcode', 
    'Item Code', 
    'Description', 
    'Category', 
    'Brand', 
    'RRP',
    'SKU Family',
    'SM SKU',
    'Robinson SKU',
    'KCC SKU',
    'Centro SKU',
    'Sta. Lucia SKU',
    'Landmark SKU',
    'Rustans SKU',
    'Sports Central SKU',
    'Island Mall SKU',
    'Gaisano Grand SKU',
    'Gaisano Fiesta Mall SKU',
    'Metro SKU'
  ];
  
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Product_Master_Template");
  XLSX.writeFile(workbook, "SafeStep_Product_Master_Template.xlsx");
};

export const downloadLedgerTemplate = () => {
  const headers = [
    'Location',
    'Box ID',
    'Operator',
    'Barcode',
    'Item Code',
    'Description',
    'Brand',
    'Category',
    'RRP',
    'Quantity',
    'Total Price',
    'Scan Timestamp'
  ];
  
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Ledger_Template");
  XLSX.writeFile(workbook, "SafeStep_Ledger_Import_Template.xlsx");
};

const sanitizeExcelValue = (val: any): string => {
  const str = String(val || '').trim();
  const errorStrings = ['#REF!', '#VALUE!', '#N/A', '#NAME?', '#DIV/0!', '#NULL!', '#NUM!'];
  return errorStrings.includes(str) ? '' : str;
};

/**
 * Ensures barcode contains only numeric digits.
 * Strips scientific notation 'E+' and non-numeric chars.
 */
const sanitizeBarcode = (val: any): string => {
  if (val === null || val === undefined) return '';
  // Convert to string and strip scientific notation artifacts if present
  let str = String(val).trim();
  if (str.includes('E+') || str.includes('e+')) {
    // If it's a number, convert properly to string to avoid scientific notation
    const num = Number(val);
    if (!isNaN(num)) str = num.toLocaleString('fullwide', {useGrouping:false});
  }
  // Replace all non-numeric characters
  return str.replace(/[^0-9]/g, '');
};

const findKey = (row: any, target: string): string => {
  const keys = Object.keys(row);
  const normalizedTarget = target.toLowerCase().replace(/\s/g, '');
  const found = keys.find(k => k.toLowerCase().replace(/\s/g, '') === normalizedTarget);
  return found || target;
};

export const parseProductExcel = (file: File): Promise<Product[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false }) as any[];

        const mappedProducts: Product[] = jsonData.map(row => {
          const barcode = sanitizeBarcode(row[findKey(row, 'Barcode')]);
          const itemCode = sanitizeExcelValue(row[findKey(row, 'Item Code')]);
          const description = sanitizeExcelValue(row[findKey(row, 'Description')]);
          const category = sanitizeExcelValue(row[findKey(row, 'Category')]) || 'FOOTWEAR';
          const brand = sanitizeExcelValue(row[findKey(row, 'Brand')]) || 'Generic';
          const skuFamily = sanitizeExcelValue(row[findKey(row, 'SKU Family')]);
          
          const rawRrp = row[findKey(row, 'RRP')];
          let rrp = 0;
          if (typeof rawRrp === 'number') {
            rrp = rawRrp;
          } else {
            const cleanedRrp = sanitizeExcelValue(rawRrp).replace(/[^0-9.]/g, '');
            rrp = cleanedRrp ? parseFloat(cleanedRrp) : 0;
          }

          return {
            barcode,
            itemCode,
            description,
            category,
            brand,
            outsole: 'Standard',
            stock: 0,
            location: '',
            rrp: isNaN(rrp) ? 0 : rrp,
            skuFamily,
            smItemCode: sanitizeExcelValue(row[findKey(row, 'SM SKU')]),
            robinsonsItemCode: sanitizeExcelValue(row[findKey(row, 'Robinson SKU')]),
            kccItemCode: sanitizeExcelValue(row[findKey(row, 'KCC SKU')]),
            centroItemCode: sanitizeExcelValue(row[findKey(row, 'Centro SKU')]),
            staLuciaItemCode: sanitizeExcelValue(row[findKey(row, 'Sta. Lucia SKU')]),
            landmarkItemCode: sanitizeExcelValue(row[findKey(row, 'Landmark SKU')]),
            rustansItemCode: sanitizeExcelValue(row[findKey(row, 'Rustans SKU')]),
            sportsCentralItemCode: sanitizeExcelValue(row[findKey(row, 'Sports Central SKU')]),
            islandMallItemCode: sanitizeExcelValue(row[findKey(row, 'Island Mall SKU')]),
            gaisanoGrandItemCode: sanitizeExcelValue(row[findKey(row, 'Gaisano Grand SKU')]),
            gaisanoFiestaItemCode: sanitizeExcelValue(row[findKey(row, 'Gaisano Fiesta Mall SKU')]),
            metroItemCode: sanitizeExcelValue(row[findKey(row, 'Metro SKU')])
          };
        }).filter(p => p.barcode && p.itemCode);

        resolve(mappedProducts);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export const parseLedgerExcel = (file: File): Promise<InventoryRecord[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false }) as any[];

        const mappedRecords: InventoryRecord[] = jsonData.map(row => {
          const barcode = sanitizeBarcode(row[findKey(row, 'Barcode')]);
          const itemCode = sanitizeExcelValue(row[findKey(row, 'Item Code')]);
          const location = sanitizeExcelValue(row[findKey(row, 'Location')]) || 'UNASSIGNED';
          const boxId = sanitizeExcelValue(row[findKey(row, 'Box ID')]) || '0';
          const rawQty = row[findKey(row, 'Quantity')];
          
          let quantity = 0;
          if (typeof rawQty === 'number') {
            quantity = rawQty;
          } else {
            quantity = parseInt(sanitizeExcelValue(rawQty)) || 0;
          }

          return {
            barcode,
            itemCode,
            location,
            boxId,
            quantity
          };
        }).filter(r => r.barcode && r.quantity > 0);

        resolve(mappedRecords);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};
