'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { importData } from './lib/services/dataService';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [dataReady, setDataReady] = useState(false);

  // Ensure initial demo data is loaded into IndexedDB so every page sees the same dataset
  useEffect(() => {
    async function initData() {
      try {
        const res = await fetch('/trades.json');
        if (res.ok) {
          const raw = await res.json();
          await importData(raw); // skip if already exist
        }
      } catch (_) {
        // optional: ignore errors when demo file missing
      } finally {
        setDataReady(true);
      }
    }
    initData();
  }, []);

  if (!dataReady) {
    return <div className="text-center p-10">数据加载中...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
} 