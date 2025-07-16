'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { findTrades } from '@/lib/services/dataService';
import { computeFifo, type EnrichedTrade } from '@/lib/fifo';

function formatNumber(value: number | undefined, decimals = 2) {
  if (value === undefined || value === null) return '-';
  return value.toFixed(decimals);
}

function fmtSign(n: number) {
  const cls = n > 0 ? 'green' : n < 0 ? 'red' : 'white';
  const val = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <span className={cls}>{n < 0 ? '-' : ''}{val}</span>;
}

function fmtDollar(n: number) { return <><span className="white">$&nbsp;</span>{fmtSign(n)}</>; }
function fmtInt(n: number) { return <span className="white">{Number(n).toLocaleString()}</span>; }
function fmtWL(w: number, l: number) { return <><span className="green">W{w}</span>/<span className="red">L{l}</span></>; }

export default function StockPage() {
  const searchParams = useSearchParams();
  const symbol = searchParams.get('symbol') || '';
  const [trades, setTrades] = useState<EnrichedTrade[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;

    async function loadData() {
      try {
        setIsLoading(true);
        const allTrades = await findTrades();
        const symbolTrades = computeFifo(allTrades.filter(t => t.symbol === symbol));
        setTrades(symbolTrades);

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
  }, [symbol]);

  const zhName = nameMap[symbol] || '';
  const weekdayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // 计算个股统计数据
  const longCnt = trades.filter(t => t.action === 'buy').length;
  const shortCnt = trades.filter(t => t.action === 'sell').length;
  const totalCnt = trades.length;
  const wins = trades.filter(t => (t.realizedPnl || 0) > 0).length;
  const losses = trades.filter(t => (t.realizedPnl || 0) < 0).length;
  const realized = trades.reduce((s, t) => s + (t.realizedPnl || 0), 0);

  const statsArr = [
    ['做多次数', fmtInt(longCnt)],
    ['做空次数', fmtInt(shortCnt)],
    ['个股交易次数', fmtInt(totalCnt)],
    ['盈亏笔数', fmtWL(wins, losses)],
    ['个股已实现盈亏', fmtDollar(realized)],
  ];

  if (isLoading) {
    return <div className="text-center p-10">Loading stock data...</div>;
  }

  return (
    <div>
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <img id="stock-logo" src={`/logos/${symbol}.png`} alt="Logo" style={{ height: '150px', objectFit: 'contain' }} />
        <h2 className="section-title" id="title" style={{ marginTop: '10px' }}>
          {symbol}{zhName ? ` (${zhName})` : ''} 交易详情
        </h2>
      </div>

      <section className="stats-grid" id="stock-stats" style={{ gridTemplateColumns: `repeat(${statsArr.length}, 180px)` }}>
        {statsArr.map((stat, i) => (
          <div className="box" id={`stock-stat-${i + 1}`} key={i}>
            <div className="box-title">{stat[0]}</div>
            <div className="box-value">{stat[1]}</div>
          </div>
        ))}
      </section>

      <table id="detail-table" className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>日期</th>
            <th>星期</th>
            <th>统计</th>
            <th>方向</th>
            <th>单价</th>
            <th>数量</th>
            <th>订单金额</th>
            <th>盈亏平衡点</th>
            <th>盈亏</th>
            <th>目前持仓</th>
            <th>持仓成本</th>
          </tr>
        </thead>
        <tbody>
          {trades.length > 0 ? (
            trades.map((trade, idx) => {
              const dateObj = new Date(trade.date);
              const weekday = weekdayMap[dateObj.getUTCDay()];
              const plCls = (trade.realizedPnl || 0) > 0 ? 'green' : (trade.realizedPnl || 0) < 0 ? 'red' : 'white';
              const sideCls = (trade.action === 'buy' || trade.action === 'cover') ? 'green' : 'red';
              const amount = trade.price * trade.quantity;

              return (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>{trade.date}</td>
                  <td>{weekday}</td>
                  <td>{trade.id}</td>
                  <td className={sideCls}>{trade.action.toUpperCase()}</td>
                  <td>{formatNumber(trade.price)}</td>
                  <td className={sideCls}>{trade.quantity}</td>
                  <td>{formatNumber(amount)}</td>
                  <td>{formatNumber(trade.price)}</td>
                  <td className={plCls}>{formatNumber(trade.realizedPnl)}</td>
                  <td>{trade.quantity || 0}</td>
                  <td>{formatNumber(trade.averageCost)}</td>
                </tr>
              );
            })
          ) : (
            <tr><td colSpan={12}>暂无数据</td></tr>
          )}
        </tbody>
      </table>

      <div id="watermark" className="watermark">
        {symbol} {zhName}
      </div>
    </div>
  );
} 