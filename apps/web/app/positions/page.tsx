'use client';

import { useEffect, useState } from 'react';
import { importData } from '@/lib/services/dataService';
import { findTrades } from '@/lib/services/dataService';
import type { Position } from '@/lib/services/dataService';
import { computeFifo, type EnrichedTrade } from '@/lib/fifo';
import { PositionsTable } from '@/modules/PositionsTable';

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<EnrichedTrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        // 初次使用时导入数据（若已存在则自动跳过）
        const response = await fetch('/trades.json');
        if (response.ok) {
          const rawData = await response.json();
          await importData(rawData);
        }

        const allTrades = await findTrades();
        const enriched = computeFifo(allTrades);
        setTrades(enriched);

        // 根据 enriched 计算最新持仓（quantityAfter / averageCost）
        const lastMap: Record<string, EnrichedTrade> = {};
        for (const t of enriched) {
          lastMap[t.symbol] = t; // 由于 computeFifo 已按日期升序，遍历结束时即为最后状态
        }

        const posList: Position[] = Object.values(lastMap).map(t => ({
          symbol: t.symbol,
          qty: t.quantityAfter,
          avgPrice: t.averageCost,
          last: 0,
          priceOk: true,
        }));

        setPositions(posList);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  if (isLoading) {
    return <div>Loading positions...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Current Positions</h1>
      <PositionsTable positions={positions} trades={trades} />
    </main>
  );
} 