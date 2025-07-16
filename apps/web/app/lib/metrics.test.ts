import { calcMetrics } from './metrics';
import type { EnrichedTrade } from './fifo';
import type { Position } from './services/dataService';

// Mock current date to ensure consistent test results
const realDateNow = Date.now;
const realToISOString = Date.prototype.toISOString;

describe('metrics calculation', () => {
  // 设置固定的当前日期为2025-07-15
  beforeAll(() => {
    global.Date.now = jest.fn(() => new Date('2025-07-15T12:00:00Z').getTime());
    Date.prototype.toISOString = jest.fn(() => '2025-07-15T12:00:00.000Z');
  });

  // 恢复原始的 Date 函数
  afterAll(() => {
    global.Date.now = realDateNow;
    Date.prototype.toISOString = realToISOString;
  });

  test('正确计算所有指标', () => {
    // 准备测试数据
    const positions: Position[] = [
      { symbol: 'AAPL', qty: 10, avgPrice: 150, last: 160, priceOk: true },
      { symbol: 'MSFT', qty: -5, avgPrice: 300, last: 290, priceOk: true },
    ];

    const trades: EnrichedTrade[] = [
      // 今日交易
      {
        symbol: 'AAPL',
        date: '2025-07-15',
        price: 155,
        quantity: 5,
        action: 'buy',
        weekday: 2, // Tuesday
        tradeCount: 1,
        amount: 155 * 5,
        breakEvenPrice: 155,
        realizedPnl: 0,
        quantityAfter: 5,
        averageCost: 155,
      },
      {
        symbol: 'AAPL',
        date: '2025-07-15',
        price: 160,
        quantity: 5,
        action: 'buy',
        weekday: 2,
        tradeCount: 2,
        amount: 160 * 5,
        breakEvenPrice: 157.5,
        realizedPnl: 0,
        quantityAfter: 10,
        averageCost: 157.5,
      },
      // 历史交易
      {
        symbol: 'MSFT',
        date: '2025-07-10',
        price: 280,
        quantity: 10,
        action: 'buy',
        weekday: 4, // Thursday
        tradeCount: 1,
        amount: 280 * 10,
        breakEvenPrice: 280,
        realizedPnl: 0,
        quantityAfter: 10,
        averageCost: 280,
      },
      {
        symbol: 'MSFT',
        date: '2025-07-14',
        price: 300,
        quantity: 5,
        action: 'sell',
        weekday: 1, // Monday
        tradeCount: 2,
        amount: 300 * 5,
        breakEvenPrice: 280,
        realizedPnl: 100, // (300 - 280) * 5 = 100
        quantityAfter: 5,
        averageCost: 280,
      },
      {
        symbol: 'MSFT',
        date: '2025-07-15',
        price: 290,
        quantity: 10,
        action: 'short',
        weekday: 2, // Tuesday
        tradeCount: 3,
        amount: 290 * 10,
        breakEvenPrice: 290,
        realizedPnl: 0,
        quantityAfter: -5,
        averageCost: 290,
      },
    ];

    const dailyResults = [
      { date: '2025-07-01', realized: 50, float: 20, pnl: 70 },
      { date: '2025-07-10', realized: 30, float: 10, pnl: 40 },
      { date: '2025-07-14', realized: 100, float: -30, pnl: 70 },
      { date: '2025-07-15', realized: 0, float: 50, pnl: 50 },
    ];

    // 执行指标计算
    const metrics = calcMetrics(trades, positions, dailyResults);

    // 验证指标计算结果
    expect(metrics).toEqual({
      M1: 10 * 150 + 5 * 300, // 账户总成本: 10*150 + 5*300 = 3000
      M2: 10 * 160 + (-5) * 290, // 当前市值: 10*160 + (-5)*290 = 150
      M3: (10 * 160 + (-5) * 290) - (10 * 150 + 5 * 300), // 当前浮动盈亏: 150 - 3000 = -2850
      M4: 0, // 当日已实现盈亏: 0 (今日交易没有已实现盈亏)
      M5: 0, // 日内交易: (当日没有配对交易)
      M6: -2850 + 0, // 当日浮动盈亏: M3 + M4 = -2850
      M7: 3, // 当日交易次数: 2个AAPL买入 + 1个MSFT做空 = 3
      M8: 5, // 累计交易次数: 总共5笔交易
      M9: 100, // 历史已实现盈亏: MSFT卖出盈利100
      M10: 100, // 胜率: 1/(1+0)*100 = 100% (只有1笔有已实现盈亏的交易，且为盈利)
      M11: 50, // WTD: 根据实际计算方式, 只考虑当天 15日:50
      M12: 230, // MTD: 1日:70 + 10日:40 + 14日:70 + 15日:50 = 230
      M13: 230, // YTD: 所有日期之和 = 230
    });
  });

  test('处理空数据集', () => {
    const emptyMetrics = calcMetrics([], []);

    // 验证空数据集下的默认值
    expect(emptyMetrics).toEqual({
      M1: 0,
      M2: 0,
      M3: 0,
      M4: 0,
      M5: 0,
      M6: 0,
      M7: 0,
      M8: 0,
      M9: 0,
      M10: 0,
      M11: 0,
      M12: 0,
      M13: 0,
    });
  });
}); 