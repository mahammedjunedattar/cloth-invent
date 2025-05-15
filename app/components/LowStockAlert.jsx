'use client';
import { useEffect } from 'react';
import { toast } from 'react-hot-toast';

export default function LowStockAlert({ items }) {
  useEffect(() => {
    const lowStockItems = items.filter(item => item.quantity <= item.minStock);
    if (lowStockItems.length > 0) {
      toast.error(
        `${lowStockItems.length} items below minimum stock!`,
        { duration: 6000 }
      );
    }
  }, [items]);

  return null;
}