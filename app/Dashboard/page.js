'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import debounce from 'lodash.debounce';
import { toast } from 'react-hot-toast';
import { useSession } from 'next-auth/react';

import LowStockAlert from '../components/LowStockAlert';
import InventoryTable from '../components/InventoryTable';
import AddItemForm from '../components/AddItemForm';
import CollectionFilter from '../components/collectionFilter';
import SizeColorFilter from '../components/SizeColorFilter';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Filter states
  const [selectedCollection, setSelectedCollection] = useState('all');
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);

  // Data states
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  // Ref for debounced fetch
  const debouncedFetch = useRef();

  // Define the actual fetch logic
  const doFetchItems = useCallback(async (collection, sizes, colors, signal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        collection,
        sizes: sizes.join(','),
        colors: colors.join(','),
      });
      const res = await fetch(`/api/items?${params}`, {
        credentials: 'include',
        next: { tags: ['inventory'] },
        signal,
      });
      if (!res.ok) throw new Error('Failed to fetch items');
      const { data } = await res.json();
      setItems(data ?? []);
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Wrap it in debounce on mount
  useEffect(() => {
    debouncedFetch.current = debounce((collection, sizes, colors, signal) => {
      doFetchItems(collection, sizes, colors, signal);
    }, 300);

    return () => {
      // Cancel any pending debounce on unmount
      debouncedFetch.current.cancel();
    };
  }, [doFetchItems]);

  // fire on filter/session change
  const fetchItems = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      // you can skip in dev, or still call if you prefer
    }

    const controller = new AbortController();
    debouncedFetch.current(
      selectedCollection,
      selectedSizes,
      selectedColors,
      controller.signal
    );

    // cleanup: abort fetch + clear pending debounce
    return () => {
      controller.abort();
      debouncedFetch.current.cancel();
    };
  }, [selectedCollection, selectedSizes, selectedColors]);

  // Auth check + initial load
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      const cleanup = fetchItems();
      return cleanup;
    }
  }, [status, fetchItems, router]);

  // Handle variant updates
  const handleVariantChange = async (sku, size, color, newQty) => {
    try {
      const res = await fetch(`/api/items/${sku}/variants`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size, color, quantity: newQty }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${size}/${color} stock updated`);
      fetchItems();
    } catch {
      toast.error('Failed to update variant');
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">
              {session?.user?.storeName || 'Fashion Inventory Manager'}
            </h1>
            <p className="text-gray-600 mt-2">
              {selectedCollection === 'all'
                ? 'All Collections'
                : `${selectedCollection} Collection`}
            </p>
          </div>
          <AddItemForm onSuccess={fetchItems} />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <CollectionFilter
            currentCollection={selectedCollection}
            onChange={setSelectedCollection}
          />
          <SizeColorFilter
            type="sizes"
            selected={selectedSizes}
            onChange={setSelectedSizes}
            storeId={session?.user?.storeId}
          />
          <SizeColorFilter
            type="colors"
            selected={selectedColors}
            onChange={setSelectedColors}
            storeId={session?.user?.storeId}
            enableCustomColors
          />
        </div>

        {/* Content */}
        <LowStockAlert items={items} threshold={10} variantThreshold={5} />

        {loading ? (
          <div className="text-center py-8 text-gray-500">
            Loading inventory...
          </div>
        ) : (
          <InventoryTable
            items={items}
            selectedCollection={selectedCollection}
            selectedSizes={selectedSizes}
            selectedColors={selectedColors}
            onVariantUpdate={handleVariantChange}
            onVariantDelete={fetchItems}
          />
        )}
      </div>
    </main>
  );
}
