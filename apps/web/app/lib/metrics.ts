import type { EnrichedTrade } from "@/lib/fifo";
import type { Position } from '@/lib/services/dataService';

/**
 * 交易系统指标接口
 * 定义了所有需要计算和展示的指标
 */
export interface Metrics {
  /** M1: 账户总成本 - 所有持仓的成本总和 */
  M1: number;

  /** M2: 当前市值 - 所有持仓的当前市场价值总和 */
  M2: number;

  /** M3: 当前浮动盈亏 - 所有持仓的未实现盈亏总和 */
  M3: number;

  /** M4: 当日已实现盈亏 - 今日所有已平仓交易的盈亏总和 */
  M4: number;

  /** 
   * M5: 日内交易盈亏 - 同一天内开仓并平仓的交易盈亏
   * trade: 交易视角，按交易匹配计算
   * fifo: FIFO视角，按先进先出原则计算
   */
  M5: {
    trade: number;
    fifo: number;
  };

  /** M6: 当日浮动盈亏 - 当日持仓的未实现盈亏 */
  M6: number;

  /** 
   * M7: 当日交易次数 - 今日各类型交易的次数统计
   * B: 买入次数
   * S: 卖出次数
   * P: 做空次数
   * C: 回补次数
   * total: 总交易次数
   */
  M7: {
    B: number;
    S: number;
    P: number;
    C: number;
    total: number;
  };

  /** 
   * M8: 累计交易次数 - 历史各类型交易的次数统计
   * B: 买入次数
   * S: 卖出次数
   * P: 做空次数
   * C: 回补次数
   * total: 总交易次数
   */
  M8: {
    B: number;
    S: number;
    P: number;
    C: number;
    total: number;
  };

  /** M9: 历史已实现盈亏 - 不含今日的所有已平仓交易盈亏总和 */
  M9: number;

  /** 
   * M10: 胜率统计
   * W: 盈利交易次数
   * L: 亏损交易次数
   * rate: 胜率百分比
   */
  M10: {
    W: number;
    L: number;
    rate: number;
  };

  /** M11: WTD (Week-To-Date) - 本周至今的盈亏总和 */
  M11: number;

  /** M12: MTD (Month-To-Date) - 本月至今的盈亏总和 */
  M12: number;

  /** M13: YTD (Year-To-Date) - 本年至今的盈亏总和 */
  M13: number;
}

/**
 * 每日交易结果接口
 */
interface DailyResult {
  /** 日期，格式为 YYYY-MM-DD */
  date: string;

  /** 已实现盈亏 */
  realized: number;

  /** 浮动盈亏 */
  float: number;

  /** 总盈亏 (realized + float) */
  pnl: number;
}

/** 价格映射类型，格式为 { 日期: { 股票代码: 价格 } } */
export type PriceMap = Record<string, Record<string, number>>;

/**
 * 计算数组总和的辅助函数
 * @param arr 数字数组
 * @returns 数组元素之和
 */
function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

/**
 * 计算日内交易盈亏（交易视角）
 * 按照交易匹配的方式，计算同一天内开仓并平仓的交易盈亏
 * 
 * @param enrichedTrades 交易记录数组
 * @param todayStr 今日日期字符串，格式为 YYYY-MM-DD
 * @returns 日内交易盈亏
 */
function calcTodayTradePnL(enrichedTrades: EnrichedTrade[], todayStr: string): number {
  // 为多头和空头分别维护栈
  const longMap: Record<string, { qty: number; price: number }[]> = {};
  const shortMap: Record<string, { qty: number; price: number }[]> = {};
  let pnl = 0;

  // 按时间顺序处理今日交易
  enrichedTrades
    .filter(t => t.date.startsWith(todayStr))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach(t => {
      const { symbol, action, quantity, price } = t;

      // 初始化栈
      if (!longMap[symbol]) longMap[symbol] = [];
      if (!shortMap[symbol]) shortMap[symbol] = [];

      if (action === 'buy') {
        // 买入：直接加入多头栈
        longMap[symbol].push({ qty: quantity, price });
      }
      else if (action === 'sell') {
        // 卖出：匹配今日多头栈
        const longStack = longMap[symbol];
        let remain = quantity;

        while (remain > 0 && longStack.length > 0) {
          const batch = longStack[0]!;
          const q = Math.min(batch.qty, remain);
          // 多头平仓：卖出价 > 买入价 = 盈利
          pnl += (price - batch.price) * q;
          batch.qty -= q;
          remain -= q;
          if (batch.qty === 0) longStack.shift();
        }

        // 剩余的不处理（可能是平历史仓位，不计入日内交易）
      }
      else if (action === 'short') {
        // 做空：直接加入空头栈
        shortMap[symbol].push({ qty: quantity, price });
      }
      else if (action === 'cover') {
        // 回补：匹配今日空头栈
        const shortStack = shortMap[symbol];
        let remain = quantity;

        while (remain > 0 && shortStack.length > 0) {
          const batch = shortStack[0]!;
          const q = Math.min(batch.qty, remain);
          // 空头平仓：回补价 < 做空价 = 盈利
          pnl += (batch.price - price) * q;
          batch.qty -= q;
          remain -= q;
          if (batch.qty === 0) shortStack.shift();
        }

        // 剩余的不处理（可能是平历史仓位，不计入日内交易）
      }
    });

  return pnl;
}

/**
 * 计算日内交易盈亏（FIFO视角）
 * 按照先进先出原则，计算同一天内开仓并平仓的交易盈亏
 * 
 * @param enrichedTrades 交易记录数组
 * @param todayStr 今日日期字符串，格式为 YYYY-MM-DD
 * @returns 日内交易盈亏
 */
function calcTodayFifoPnL(enrichedTrades: EnrichedTrade[], todayStr: string): number {
  // 构建今日之前的 FIFO 栈
  const fifo: Record<string, { qty: number; price: number }[]> = {};

  // 1. 先构建今日交易的行为栈（与M5.1相同）
  const longMap: Record<string, { qty: number; price: number }[]> = {};
  const shortMap: Record<string, { qty: number; price: number }[]> = {};

  // 2. 记录日内交易匹配的数量
  const dayTradeMatches: {
    symbol: string;
    action: 'sell' | 'cover';
    price: number;
    qty: number;
  }[] = [];

  // 按时间顺序处理今日交易，找出日内交易匹配
  enrichedTrades
    .filter(t => t.date.startsWith(todayStr))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach(t => {
      const { symbol, action, quantity, price } = t;

      // 初始化栈
      if (!longMap[symbol]) longMap[symbol] = [];
      if (!shortMap[symbol]) shortMap[symbol] = [];

      if (action === 'buy') {
        // 买入：直接加入多头栈
        longMap[symbol].push({ qty: quantity, price });
      }
      else if (action === 'sell') {
        // 卖出：匹配今日多头栈
        const longStack = longMap[symbol];
        let remain = quantity;
        let matchedQty = 0;

        while (remain > 0 && longStack.length > 0) {
          const batch = longStack[0]!;
          const q = Math.min(batch.qty, remain);
          batch.qty -= q;
          remain -= q;
          matchedQty += q;
          if (batch.qty === 0) longStack.shift();
        }

        // 记录匹配的日内交易
        if (matchedQty > 0) {
          dayTradeMatches.push({
            symbol,
            action: 'sell',
            price,
            qty: matchedQty
          });
        }
      }
      else if (action === 'short') {
        // 做空：直接加入空头栈
        shortMap[symbol].push({ qty: quantity, price });
      }
      else if (action === 'cover') {
        // 回补：匹配今日空头栈
        const shortStack = shortMap[symbol];
        let remain = quantity;
        let matchedQty = 0;

        while (remain > 0 && shortStack.length > 0) {
          const batch = shortStack[0]!;
          const q = Math.min(batch.qty, remain);
          batch.qty -= q;
          remain -= q;
          matchedQty += q;
          if (batch.qty === 0) shortStack.shift();
        }

        // 记录匹配的日内交易
        if (matchedQty > 0) {
          dayTradeMatches.push({
            symbol,
            action: 'cover',
            price,
            qty: matchedQty
          });
        }
      }
    });

  // 3. 构建历史FIFO栈
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

  // 4. 对日内交易匹配的部分，应用FIFO计算
  let pnl = 0;
  for (const match of dayTradeMatches) {
    const { symbol, action, price, qty } = match;
    const stack = fifo[symbol] || [];
    let remain = qty;

    while (remain > 0 && stack.length) {
      const batch = stack[0]!;
      const q = Math.min(batch.qty, remain);

      if (action === 'sell') {
        pnl += (price - batch.price) * q;
      } else { // cover
        pnl += (batch.price - price) * q;
      }

      batch.qty -= q;
      remain -= q;
      if (batch.qty === 0) stack.shift();
    }
  }

  return pnl;
}

/**
 * 计算周期性指标（WTD、MTD、YTD）
 * 
 * @param dailyResults 每日交易结果数组
 * @param todayStr 今日日期字符串，格式为 YYYY-MM-DD
 * @returns 包含 wtd、mtd、ytd 的对象
 */
function calcPeriodMetrics(dailyResults: DailyResult[], todayStr: string): { wtd: number, mtd: number, ytd: number } {
  /**
   * 计算从指定日期开始的盈亏总和
   * @param list 每日交易结果数组
   * @param since 开始日期，格式为 YYYY-MM-DD
   * @returns 盈亏总和
   */
  function sumSince(list: DailyResult[], since: string) {
    return list.filter(r => r.date >= since).reduce((acc, r) => acc + r.pnl, 0);
  }

  /**
   * 计算本周至今的盈亏总和
   * @param list 每日交易结果数组
   * @returns 本周至今的盈亏总和
   */
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

/**
 * 计算所有交易指标
 * 
 * @param trades 交易记录数组
 * @param positions 持仓数组
 * @param dailyResults 每日交易结果数组
 * @returns 所有指标的计算结果
 */
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
  console.log('计算M2(当前市值)，持仓数据:', positions);
  const currentValue = sum(positions.map(p => {
    const isShort = p.qty < 0;
    const marketValue = isShort ? Math.abs(p.last * p.qty) : p.last * p.qty;
    console.log(`${p.symbol} 市值计算:`, { last: p.last, qty: p.qty, isShort, marketValue });
    return marketValue;
  }));
  console.log('M2(当前市值)计算结果:', currentValue);

  // M3: 当前浮动盈亏
  const floatPnl = positions.reduce((acc, pos) => {
    if (pos.qty >= 0) {
      // 多头: 市值 - 成本
      return acc + (pos.last * pos.qty - pos.avgPrice * pos.qty);
    } else {
      // 空头: 成本 - 市值的绝对值
      return acc + (pos.avgPrice * Math.abs(pos.qty) - Math.abs(pos.last * pos.qty));
    }
  }, 0);

  // M5: 日内交易（先计算，后续 M4 需要用到 pnlFifo）
  const pnlTrade = calcTodayTradePnL(trades, todayStr);
  const pnlFifo = calcTodayFifoPnL(trades, todayStr);

  // M4: 今天持仓平仓盈利（仅历史仓位，不含日内交易）
  const todayRealizedPnlAll = trades
    .filter(t => t.date.startsWith(todayStr))
    .reduce((acc, t) => acc + (t.realizedPnl || 0), 0);

  // 日内交易的 FIFO 盈亏已包含在 pnlFifo，需要剔除
  const todayHistoricalRealizedPnl = todayRealizedPnlAll - pnlFifo;

  // M6: 今日总盈利变化 = 当日浮动盈亏 + 今天历史仓位平仓盈亏
  const todayFloatPnl = floatPnl; // 当日浮动盈亏（持仓浮盈）
  const todayTotalPnlChange = todayFloatPnl + todayHistoricalRealizedPnl;

  // M7: 当日交易次数
  const todayTrades = trades.filter(t => t.date.startsWith(todayStr));
  const todayTradesByType = {
    B: todayTrades.filter(t => t.action === 'buy').length,
    S: todayTrades.filter(t => t.action === 'sell').length,
    P: todayTrades.filter(t => t.action === 'short').length,
    C: todayTrades.filter(t => t.action === 'cover').length
  };
  const todayTradeCounts = todayTradesByType.B + todayTradesByType.S + todayTradesByType.P + todayTradesByType.C;

  // M8: 累计交易次数
  const allTradesByType = {
    B: trades.filter(t => t.action === 'buy').length,
    S: trades.filter(t => t.action === 'sell').length,
    P: trades.filter(t => t.action === 'short').length,
    C: trades.filter(t => t.action === 'cover').length
  };
  const totalTrades = allTradesByType.B + allTradesByType.S + allTradesByType.P + allTradesByType.C;

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
    M4: todayHistoricalRealizedPnl,
    M5: {
      trade: pnlTrade,
      fifo: pnlFifo
    },
    M6: todayTotalPnlChange,
    M7: {
      B: todayTradesByType.B,
      S: todayTradesByType.S,
      P: todayTradesByType.P,
      C: todayTradesByType.C,
      total: todayTradeCounts
    },
    M8: {
      B: allTradesByType.B,
      S: allTradesByType.S,
      P: allTradesByType.P,
      C: allTradesByType.C,
      total: totalTrades
    },
    M9: historicalRealizedPnl,
    M10: {
      W: winningTrades,
      L: losingTrades,
      rate: winRate
    },
    M11: wtd,
    M12: mtd,
    M13: ytd
  };
}

/**
 * 格式化数字为货币格式
 * @param value 要格式化的数值
 * @returns 格式化后的字符串，包含美元符号 ($)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * 格式化数字为通用格式
 * @param value 要格式化的数值
 * @param decimals 小数位数，默认为2
 * @returns 格式化后的字符串
 */
export function formatNumber(value: number, decimals: number = 2): string {
  if (isNaN(value)) return 'N/A';
  return value.toFixed(decimals);
} 