'use client';

import type { EnrichedTrade } from "@/lib/fifo";
import { useEffect, useState } from "react";

function formatNumber(value: number | undefined, decimals = 2) {
  if (value === undefined || value === null) return '-';
  return value.toFixed(decimals);
}

export function TradesTable({ trades }: { trades: EnrichedTrade[] }) {
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch('/data/symbol_name_map.json')
      .then((r) => r.json())
      .then((j) => setNameMap(j))
      .catch(() => { });
  }, []);

  const weekdayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <table id="trades" className="table">
      <thead>
        <tr>
          <th>日期</th>
          <th>星期</th>
          <th>图标</th>
          <th>代码</th>
          <th>中文</th>
          <th>方向</th>
          <th>单价</th>
          <th>数量</th>
          <th>订单金额</th>
          <th>详情</th>
        </tr>
      </thead>
      <tbody>
        {trades.slice(0, 10).map((trade, idx) => {
          const dateObj = new Date(trade.date);
          const weekday = weekdayMap[dateObj.getUTCDay()];
          const colorSide = (trade.action === 'buy' || trade.action === 'cover') ? 'green' : 'red';
          const qtyColor = colorSide;
          const amount = trade.price * trade.quantity;
          return (
            <tr key={idx}>
              <td>{trade.date}</td>
              <td>{weekday}</td>
              <td><img className="logo" src={`/logos/${trade.symbol}.png`} alt={trade.symbol} /></td>
              <td>{trade.symbol}</td>
              <td className="cn">{nameMap[trade.symbol] || '--'}</td>
              <td className={colorSide}>{trade.action.toUpperCase()}</td>
              <td>{formatNumber(trade.price)}</td>
              <td className={qtyColor}>{trade.quantity}</td>
              <td>{formatNumber(amount)}</td>
              <td><a href={`/stock?symbol=${trade.symbol}`} className="details">详情</a></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
} 