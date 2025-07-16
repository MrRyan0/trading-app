'use client';

import { useState, useEffect } from 'react';
import { findTrades, deleteTrade } from '@/lib/services/dataService';
import { computeFifo, type EnrichedTrade } from '@/lib/fifo';
import AddTradeModal from '@/components/AddTradeModal';

export default function TradesPage() {
  const [trades, setTrades] = useState<EnrichedTrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [editingTrade, setEditingTrade] = useState<EnrichedTrade | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const fetchedTrades = await findTrades();
        setTrades(computeFifo(fetchedTrades));

        // 加载中文名称
        fetch('/data/symbol_name_map.json')
          .then((r) => r.json())
          .then((j) => setNameMap(j))
          .catch(() => { });
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const reload = async () => {
    const fetched = await findTrades();
    setTrades(computeFifo(fetched));
  };

  function formatNumber(value: number | undefined, decimals = 2) {
    if (value === undefined || value === null) return '-';
    return value.toFixed(decimals);
  }

  const weekdayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (isLoading) {
    return <div className="text-center p-10">Loading trades...</div>;
  }

  // helper for side class
  const getSideClass = (action: string) => {
    if (action === 'buy') return 'green';
    if (action === 'sell') return 'red';
    if (action === 'short') return 'purple';
    if (action === 'cover') return 'blue';
    return '';
  };

  let histReal = trades.reduce((s, t) => s + (t.realizedPnl || 0), 0);

  return (
    <div>
      <h2 className="section-title">全部交易记录</h2>
      <table id="all-trades" className="table">
        <thead>
          <tr>
            {[
              '#', 'logo', '代码', '中文', '日期', '星期', '统计', '方向', '单价', '数量', '订单金额', '盈亏平衡点', '盈亏', '详情', '目前持仓', '持仓成本', '编辑', '删除'
            ].map(h => <th key={h} className={h === '中文' ? 'cn' : ''}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {trades.map((trade, idx) => {
            const dateObj = new Date(trade.date);
            const weekday = weekdayMap[dateObj.getUTCDay()];
            const sideCls = getSideClass(trade.action);
            const amt = trade.price * trade.quantity;
            const pnlCls = (trade.realizedPnl || 0) > 0 ? 'green' : (trade.realizedPnl || 0) < 0 ? 'red' : 'white';

            return (
              <tr key={idx}>
                <td>{idx + 1}</td>
                <td><img className="logo" src={`/logos/${trade.symbol}.png`} alt={trade.symbol} /></td>
                <td>{trade.symbol}</td>
                <td className="cn">{nameMap[trade.symbol] || '--'}</td>
                <td>{trade.date}</td>
                <td>{weekday}</td>
                <td>{trade.tradeCount}</td>
                <td className={sideCls}>{trade.action.toUpperCase()}</td>
                <td>{formatNumber(trade.price)}</td>
                <td className={sideCls}>{trade.quantity}</td>
                <td>{formatNumber(amt)}</td>
                <td>{formatNumber(trade.breakEvenPrice)}</td>
                <td className={pnlCls}>{formatNumber(trade.realizedPnl)}</td>
                <td><a href={`/stock?symbol=${trade.symbol}`} className="details">详情</a></td>
                <td>{trade.quantityAfter}</td>
                <td>{formatNumber(trade.averageCost)}</td>
                <td>
                  <button className="btn-action btn-edit" data-tooltip="编辑" onClick={() => {
                    console.log('编辑交易:', trade);
                    setEditingTrade(trade);
                  }}>✏️</button>
                </td>
                <td>
                  <button className="btn-action btn-del" data-tooltip="删除" onClick={async () => {
                    if (confirm('确定删除该交易?')) {
                      if (trade.id != null) {
                        console.log('删除交易:', trade.id);
                        await deleteTrade(trade.id);
                        await reload();
                      }
                    }
                  }}>🗑️</button>
                </td>
              </tr>
            );
          })}
          {/* footer for hist realized */}
          <tr>
            <td colSpan={11}>历史已实现盈亏</td>
            <td className={histReal > 0 ? 'green' : histReal < 0 ? 'red' : 'white'}>{formatNumber(histReal)}</td>
            <td colSpan={5}></td>
          </tr>
        </tbody>
      </table>
      {editingTrade && <AddTradeModal trade={editingTrade} onClose={() => setEditingTrade(null)} onAdded={async () => { await reload(); setEditingTrade(null); }} />}
    </div>
  );
} 