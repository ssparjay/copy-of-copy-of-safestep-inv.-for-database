
import { Product } from '../types';

export const generateRandomProduct = (): Product => {
  const categories = ["Athletic", "Casual", "Formal", "Workwear", "Sandals"];
  const outsoles = ["Rubber", "Polyurethane", "Leather", "EVA", "Thermoplastic"];
  const brands = ["Nike", "Adidas", "Puma", "Timberland", "Clarks", "New Balance"];
  const chars = "0123456789";
  
  const barcode = Array.from({length: 13}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const code = `SKU-${Math.floor(Math.random() * 9000) + 1000}`;
  
  return {
    barcode,
    itemCode: code,
    brand: brands[Math.floor(Math.random() * brands.length)],
    description: `Professional ${categories[Math.floor(Math.random() * categories.length)]} Edition ${code}`,
    category: categories[Math.floor(Math.random() * categories.length)],
    outsole: outsoles[Math.floor(Math.random() * outsoles.length)],
    stock: Math.floor(Math.random() * 500),
    location: `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}-${Math.floor(Math.random() * 50)}-${Math.floor(Math.random() * 10)}`,
    rrp: parseFloat((Math.random() * 200 + 49).toFixed(2))
  };
};
