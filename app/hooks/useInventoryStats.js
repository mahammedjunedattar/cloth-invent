// hooks/useInventoryStats.js
import { useState, useEffect } from 'react';

const CACHE = new Map();
const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes

export default function useInventoryStats(storeId) {
  const [stats, setStats] = useState({
    sizes: [],
    colors: [],
    sizeCounts: {},
    colorCounts: {}
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!storeId) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check cache first
        const cacheKey = `stats-${storeId}`;
        const cached = CACHE.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          setStats(cached.data);
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/Inventory/Stats?storeId=${storeId}`, {
          signal,
          credentials: 'include'
        });

        if (!response.ok) throw new Error('Failed to fetch stats');
        
        const data = await response.json();
        
        // Transform data for efficient lookups
        const transformed = {
          sizes: data.sizes,
          colors: data.colors,
          sizeCounts: data.sizeCounts || {},
          colorCounts: data.colorCounts || {}
        };

        CACHE.set(cacheKey, {
          data: transformed,
          timestamp: Date.now()
        });

        setStats(transformed);
        setError(null);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message);
          console.error('Inventory stats error:', err);
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };

    fetchStats();

    return () => controller.abort();
  }, [storeId]);

  // Optional: Refresh mechanism
  const refresh = () => {
    if (storeId) CACHE.delete(`stats-${storeId}`);
  };

  return {
    stats,
    loading,
    error,
    refresh
  };
}