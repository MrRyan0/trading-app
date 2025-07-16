'use client';

import { useState, useMemo } from 'react';
import type { EnrichedTrade } from '@/lib/fifo';

interface RankingTableProps {
  trades: EnrichedTrade[];
  bySymbol?: boolean; // default true – aggregate per symbol
}

export function RankingTable({ trades, bySymbol = true }: RankingTableProps) {
  const [showProfits, setShowProfits] = useState<boolean>(true);

  const ranked = useMemo(() => {
    if (bySymbol) {
      // 累加每个标的的已实现盈亏
      const map: Record<string, number> = {};
      trades.forEach(t => {
        const pnl = t.realizedPnl || 0;
        map[t.symbol] = (map[t.symbol] || 0) + pnl;
      });
      const arr = Object.entries(map).map(([symbol, pnl]) => ({ symbol, pnl }));
      arr.sort((a, b) => showProfits ? b.pnl - a.pnl : a.pnl - b.pnl);
      return arr.slice(0, 10);
    } else {
      // 原按单笔交易排序
      const tradesWithPnl = trades.filter(t => t.realizedPnl !== undefined && t.realizedPnl !== 0);
      const sorted = [...tradesWithPnl].sort((a, b) => {
        const pnlA = a.realizedPnl || 0;
        const pnlB = b.realizedPnl || 0;
        return showProfits ? pnlB - pnlA : pnlA - pnlB;
      });
      return sorted.slice(0, 10);
    }
  }, [trades, bySymbol, showProfits]);

  return (
    <section>
      <h3 className="section-title">盈亏排行榜</h3>
      <div className="btn-group" style={{ marginBottom: '10px' }}>
        <button
          className={`btn ${showProfits ? 'active' : ''}`}
          id="rank-profit"
          onClick={() => setShowProfits(true)}
        >盈利 TOP 10</button>
        <button
          className={`btn ${!showProfits ? 'active' : ''}`}
          id="rank-loss"
          onClick={() => setShowProfits(false)}
        >亏损 TOP 10</button>
      </div>
      <table id="rankTable" className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>代码</th>
            <th>累计盈亏</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((row, idx) => {
            const pnl = bySymbol ? (row as any).pnl : (row as any).realizedPnl;
            const sym = bySymbol ? (row as any).symbol : (row as any).symbol;
            const cls = pnl > 0 ? 'green' : pnl < 0 ? 'red' : '';
            return (
              <tr key={idx}>
                <td>{idx + 1}</td>
                <td>{sym}</td>
                <td className={cls}>{pnl.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
} 