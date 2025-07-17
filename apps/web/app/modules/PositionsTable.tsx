'use client';

import { useQueries } from "@tanstack/react-query";
import type { Position } from "@/lib/services/dataService";
import { fetchRealtimeQuote } from "@/lib/services/priceService";
import { useEffect, useState, useMemo } from "react";
import type { EnrichedTrade } from '@/lib/fifo';
import { useStore } from '@/lib/store';
import { formatCurrency } from '@/lib/metrics';

function formatNumber(value: number | undefined, decimals = 2) {
  if (value === undefined || value === null) return '--';
  return value.toFixed(decimals);
}

// 格式化百分比
function formatPercent(value: number | undefined) {
  if (value === undefined || value === null) return '--';
  return `${(value * 100).toFixed(2)}%`;
}

interface Props {
  positions: Position[];
  trades?: EnrichedTrade[];
}

export function PositionsTable({ positions, trades }: Props) {
  const metrics = useStore(state => state.metrics);

  const results = useQueries({
    queries: positions.map((pos) => ({
      queryKey: ['quote', pos.symbol],
      queryFn: () => fetchRealtimeQuote(pos.symbol),
      staleTime: 0, // 立即过期，每次都重新请求
      cacheTime: 0, // 不缓存
      refetchInterval: 1000 * 60, // 每分钟自动刷新
      retry: 2, // 失败时重试2次
      refetchOnWindowFocus: true,
      refetchOnMount: true
    })),
  });

  // Chinese name map
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch('/data/symbol_name_map.json')
      .then((res) => res.json())
      .then((json) => setNameMap(json))
      .catch(() => { });
  }, []);

  const getTradeCount = (symbol: string) => {
    if (!trades) return '--';
    return trades.filter((t) => t.symbol === symbol).length;
  };

  const getRealized = (symbol: string) => {
    if (!trades) return 0;
    return trades.filter(t => t.symbol === symbol && t.realizedPnl !== undefined)
      .reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
  };

  // 计算市值和浮动盈亏
  const marketValues = useMemo(() => {
    // 添加日志帮助调试
    console.log('持仓数据:', positions);
    console.log('Price API results:', positions.map((pos, idx) => ({
      symbol: pos.symbol,
      qty: pos.qty,
      avgPrice: pos.avgPrice,
      apiResult: results[idx]?.status,
      hasData: results[idx]?.data !== undefined,
      data: results[idx]?.data,
      error: results[idx]?.error
    })));

    return positions.map((pos, idx) => {
      const result = results[idx];
      // 修改：如果lastPrice为undefined，则使用平均价格作为回退值
      const lastPrice = result?.data !== undefined ? result.data : pos.avgPrice;

      // 修改：对于空头持仓，市值应该是正数（使用绝对值）
      const isShort = pos.qty < 0;
      const marketValue = isShort ? Math.abs(lastPrice * pos.qty) : lastPrice * pos.qty;
      const unrealized = (lastPrice - pos.avgPrice) * pos.qty;

      console.log(`${pos.symbol} 市值计算:`, {
        lastPrice,
        qty: pos.qty,
        isShort,
        rawMarket: lastPrice * pos.qty,
        market: marketValue,
        avgPrice: pos.avgPrice,
        unrealized
      });

      return { market: marketValue, unrealized };
    });
  }, [positions, results]);

  // 计算总计
  const totals = useMemo(() => {
    console.log('计算总计，marketValues:', marketValues);

    const totalMarketValue = marketValues.reduce((sum, item) => sum + item.market, 0);
    const totalUnrealized = marketValues.reduce((sum, item) => sum + item.unrealized, 0);
    const totalRealized = metrics?.M9 || 0; // 历史已实现盈亏
    const totalPnL = totalUnrealized + totalRealized;

    console.log('总计结果:', {
      totalMarketValue,
      totalUnrealized,
      totalRealized,
      totalPnL
    });

    return { marketValue: totalMarketValue, unrealized: totalUnrealized, realized: totalRealized, total: totalPnL };
  }, [marketValues, metrics?.M9]);

  return (
    <div>
      <table id="positions" className="table">
        <thead>
          <tr>
            <th>logo</th>
            <th>代码</th>
            <th>中文</th>
            <th>实时价格</th>
            <th>目前持仓</th>
            <th>持仓单价</th>
            <th>持仓金额</th>
            <th>盈亏平衡点</th>
            <th>当前浮盈亏</th>
            <th>浮动百分比</th>
            <th>标的盈亏</th>
            <th>历史交易次数</th>
            <th>详情</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos, idx) => {
            const result = results[idx];
            // 修改：如果lastPrice为undefined，则使用平均价格作为回退值
            const lastPrice = result?.data !== undefined ? result.data : pos.avgPrice;
            const isLoading = result?.isLoading;
            const isError = result?.isError;

            // 使用回退价格计算市值和浮动盈亏
            const isShort = pos.qty < 0;
            const marketValue = isShort ? Math.abs(lastPrice * pos.qty) : lastPrice * pos.qty;
            const unrealized = (lastPrice - pos.avgPrice) * pos.qty;
            const unrealizedPercent = lastPrice && pos.avgPrice ? (lastPrice - pos.avgPrice) / pos.avgPrice : undefined;

            const realized = getRealized(pos.symbol);
            const totalPNL = unrealized + realized;

            const pnlClass = unrealized > 0 ? 'green' : unrealized < 0 ? 'red' : '';
            const totalClass = totalPNL > 0 ? 'green' : totalPNL < 0 ? 'red' : '';
            const percentClass = unrealizedPercent !== undefined ? (unrealizedPercent > 0 ? 'green' : unrealizedPercent < 0 ? 'red' : '') : '';

            return (
              <tr key={pos.symbol}>
                <td><img className="logo" src={`/logos/${pos.symbol}.png`} alt={pos.symbol} /></td>
                <td>{pos.symbol}</td>
                <td>{nameMap[pos.symbol] || '--'}</td>
                <td>
                  {isLoading && <span className="loading">加载中...</span>}
                  {isError && <span className="error">获取失败</span>}
                  {!isLoading && !isError && formatNumber(lastPrice)}
                </td>
                <td>{pos.qty}</td>
                <td>{formatNumber(pos.avgPrice)}</td>
                <td>{formatNumber(marketValue)}</td>
                <td>{formatNumber(pos.avgPrice)}</td>
                <td className={pnlClass}>{formatNumber(unrealized)}</td>
                <td className={percentClass}>{unrealizedPercent !== undefined ? formatPercent(unrealizedPercent) : '--'}</td>
                <td className={totalClass}>{formatNumber(totalPNL)}</td>
                <td>{getTradeCount(pos.symbol)}</td>
                <td><a href={`/stock?symbol=${pos.symbol}`} className="details">详情</a></td>
              </tr>
            );
          })}
          {/* 总计行 */}
          <tr className="summary-row">
            <td colSpan={6}><strong>总计</strong></td>
            <td><strong>{formatCurrency(totals.marketValue)}</strong></td>
            <td></td>
            <td className={totals.unrealized > 0 ? 'green' : totals.unrealized < 0 ? 'red' : ''}>
              <strong>{formatCurrency(totals.unrealized)}</strong>
            </td>
            <td></td>
            <td className={totals.total > 0 ? 'green' : totals.total < 0 ? 'red' : ''}>
              <strong>{formatCurrency(totals.total)}</strong>
            </td>
            <td colSpan={2}></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
} 