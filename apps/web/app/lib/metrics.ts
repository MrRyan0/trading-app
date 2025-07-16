import type { EnrichedTrade } from "@/lib/fifo";
import type { Position } from '@/lib/services/dataService';

export interface Metrics {
  M1: number; // 账户总成本
  M2: number; // 当前市值
  M3: number; // 当前浮动盈亏
  M4: number; // 当日已实现盈亏
  M5: number; // 日内交易
  M6: number; // 当日浮动盈亏
  M7: number; // 当日交易次数
  M8: number; // 累计交易次数
  M9: number; // 历史已实现盈亏（不含今日）
  M10: number; // 胜率
  M11: number; // WTD
  M12: number; // MTD
  M13: number; // YTD
}

interface DailyResult {
  date: string;
  realized: number;
  float: number;
  pnl: number;
}

export type PriceMap = Record<string, Record<string, number>>;

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

// 计算日内交易：交易视角
function calcTodayTradePnL(enrichedTrades: EnrichedTrade[], todayStr: string): number {
  const map: Record<string, { qty: number; price: number }[]> = {};
  let pnl = 0;
  enrichedTrades
    .filter(t => t.date.startsWith(todayStr))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach(t => {
      const { symbol, action, quantity, price } = t;
      if (!map[symbol]) map[symbol] = [];
      const stack = map[symbol];
      if (action === 'buy' || action === 'cover') {
        stack.push({ qty: quantity, price });
      } else { // sell or short
        let remain = quantity;
        while (remain > 0 && stack.length) {
          const batch = stack[0]!;
          const q = Math.min(batch.qty, remain);
          pnl += (price - batch.price) * q;
          batch.qty -= q;
          remain -= q;
          if (batch.qty === 0) stack.shift();
        }
      }
    });
  return pnl;
}

// 计算今日 FIFO 盈亏
function calcTodayFifoPnL(enrichedTrades: EnrichedTrade[], todayStr: string): number {
  // 构建今日之前的 FIFO 栈
  const fifo: Record<string, { qty: number; price: number }[]> = {};
  enrichedTrades
    .filter(t => !t.date.startsWith(todayStr))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach(t => {
      const { symbol, action, quantity, price } = t;
      if (!fifo[symbol]) fifo[symbol] = [];
      const stack = fifo[symbol];
      if (action === 'buy' || action === 'cover') {
        stack.push({ qty: quantity, price });
      } else { // sell or short
        let remain = quantity;
        while (remain > 0 && stack.length) {
          const batch = stack[0]!;
          const q = Math.min(batch.qty, remain);
          batch.qty -= q;
          remain -= q;
          if (batch.qty === 0) stack.shift();
        }
      }
    });

  // 应用今日的卖出与 FIFO 栈
  let pnl = 0;
  enrichedTrades
    .filter(t => t.date.startsWith(todayStr) && (t.action === 'sell' || t.action === 'short'))
    .forEach(t => {
      const { symbol, quantity, price } = t;
      const stack = fifo[symbol] || [];
      let remain = quantity;
      while (remain > 0 && stack.length) {
        const batch = stack[0]!;
        const q = Math.min(batch.qty, remain);
        pnl += (price - batch.price) * q;
        batch.qty -= q;
        remain -= q;
        if (batch.qty === 0) stack.shift();
      }
    });
  return pnl;
}

// 计算日期相关的周期性指标
function calcPeriodMetrics(dailyResults: DailyResult[], todayStr: string): { wtd: number, mtd: number, ytd: number } {
  function sumSince(list: DailyResult[], since: string) {
    return list.filter(r => r.date >= since).reduce((acc, r) => acc + r.pnl, 0);
  }

  function calcWTD(list: DailyResult[]) {
    if (!list.length) return 0;
    const lastDate = new Date(list[list.length - 1]!.date);
    const day = (lastDate.getDay() + 6) % 7; // Monday=0
    const monday = new Date(lastDate);
    monday.setDate(lastDate.getDate() - day);
    const mondayStr = monday.toISOString().slice(0, 10);
    return sumSince(list, mondayStr);
  }

  const wtdTotal = calcWTD(dailyResults);
  const mtdTotal = sumSince(dailyResults, todayStr.slice(0, 8) + '01');
  const ytdTotal = sumSince(dailyResults, todayStr.slice(0, 5) + '01-01');

  return { wtd: wtdTotal, mtd: mtdTotal, ytd: ytdTotal };
}

export function calcMetrics(
  trades: EnrichedTrade[],
  positions: Position[],
  dailyResults: DailyResult[] = []
): Metrics {
  // 获取今日日期字符串
  const todayStr = new Date().toISOString().slice(0, 10);

  // M1: 账户总成本
  const totalCost = sum(positions.map(p => p.avgPrice * Math.abs(p.qty)));

  // M2: 当前市值
  const currentValue = sum(positions.map(p => p.last * p.qty));

  // M3: 当前浮动盈亏
  const floatPnl = currentValue - totalCost;

  // M4: 当日已实现盈亏
  const todayRealizedPnl = trades
    .filter(t => t.date.startsWith(todayStr))
    .reduce((acc, t) => acc + (t.realizedPnl || 0), 0);

  // M5: 日内交易
  const pnlTrade = calcTodayTradePnL(trades, todayStr);
  const pnlFifo = calcTodayFifoPnL(trades, todayStr);

  // M6: 当日浮动盈亏
  const todayFloatPnl = floatPnl + todayRealizedPnl;

  // M7: 当日交易次数
  const todayTradeCounts = trades.filter(t => t.date.startsWith(todayStr)).length;

  // M8: 累计交易次数
  const allCounts = {
    B: trades.filter(t => t.action === 'buy' || t.action === 'cover').length,
    S: trades.filter(t => t.action === 'sell' || t.action === 'short').length,
  };
  const totalTrades = allCounts.B + allCounts.S;

  // M9: 历史已实现盈亏（不含今日）
  const historicalRealizedPnl = trades
    .filter(t => !t.date.startsWith(todayStr))
    .reduce((acc, t) => acc + (t.realizedPnl || 0), 0);

  // M10: 胜率
  const winningTrades = trades.filter(t => (t.realizedPnl || 0) > 0).length;
  const losingTrades = trades.filter(t => (t.realizedPnl || 0) < 0).length;
  const winRate = winningTrades + losingTrades > 0
    ? (winningTrades / (winningTrades + losingTrades)) * 100
    : 0;

  // M11-13: 周期性指标
  const { wtd, mtd, ytd } = calcPeriodMetrics(dailyResults, todayStr);

  return {
    M1: totalCost,
    M2: currentValue,
    M3: floatPnl,
    M4: todayRealizedPnl,
    M5: pnlTrade,
    M6: todayFloatPnl,
    M7: todayTradeCounts,
    M8: totalTrades,
    M9: historicalRealizedPnl,
    M10: winRate,
    M11: wtd,
    M12: mtd,
    M13: ytd
  };
}

// 格式化数字为货币格式
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value).replace('$', '');
}

// 格式化数字为通用格式
export function formatNumber(value: number, decimals: number = 2): string {
  if (isNaN(value)) return 'N/A';
  return value.toFixed(decimals);
} 