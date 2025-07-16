import type { Trade } from './services/dataService';

const EPSILON = 1e-6;

type Position = {
  price: number;
  quantity: number;
};

type SymbolState = {
  positionList: Position[];
  direction: 'NONE' | 'LONG' | 'SHORT';
  accumulatedRealizedPnl: number;
  tradeCount: number;
};

export type EnrichedTrade = Trade & {
  id?: number; // 确保包含ID
  weekday: number;
  tradeCount: number;
  amount: number;
  breakEvenPrice: number;
  realizedPnl: number;
  quantityAfter: number;
  averageCost: number;
};

export function computeFifo(trades: Trade[]): EnrichedTrade[] {
  const symbolStateMap: Record<string, SymbolState> = {};

  // Sort trades by date to process them chronologically
  const sortedTrades = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return sortedTrades.map((trade): EnrichedTrade => {
    const state = symbolStateMap[trade.symbol] || (symbolStateMap[trade.symbol] = {
      positionList: [],
      direction: 'NONE',
      accumulatedRealizedPnl: 0,
      tradeCount: 0,
    });

    state.tradeCount += 1;
    let realizedPnl = 0;
    const { price, quantity, action } = trade;

    if (action === 'buy' || action === 'cover') {
      if (state.direction === 'NONE' || state.direction === 'LONG') {
        state.positionList.push({ price, quantity });
        state.direction = 'LONG';
      } else { // direction is 'SHORT', so this is a covering buy
        let remainingQuantity = quantity;
        while (remainingQuantity > EPSILON && state.positionList.length > 0) {
          const lot = state.positionList[0]!;
          const matchedQuantity = Math.min(remainingQuantity, lot.quantity);
          realizedPnl += (lot.price - price) * matchedQuantity;
          lot.quantity -= matchedQuantity;
          remainingQuantity -= matchedQuantity;
          if (lot.quantity <= EPSILON) {
            state.positionList.shift();
          }
        }
        state.accumulatedRealizedPnl += realizedPnl;
        if (remainingQuantity > EPSILON) {
          state.positionList = [{ price, quantity: remainingQuantity }];
          state.direction = 'LONG';
        } else if (state.positionList.length === 0) {
          state.direction = 'NONE';
        }
      }
    } else { // action is 'sell' or 'short'
      if (state.direction === 'NONE' || state.direction === 'SHORT') {
        state.positionList.push({ price, quantity });
        state.direction = 'SHORT';
      } else { // direction is 'LONG', so this is a closing sell
        let remainingQuantity = quantity;
        while (remainingQuantity > EPSILON && state.positionList.length > 0) {
          const lot = state.positionList[0]!;
          const matchedQuantity = Math.min(remainingQuantity, lot.quantity);
          realizedPnl += (price - lot.price) * matchedQuantity;
          lot.quantity -= matchedQuantity;
          remainingQuantity -= matchedQuantity;
          if (lot.quantity <= EPSILON) {
            state.positionList.shift();
          }
        }
        state.accumulatedRealizedPnl += realizedPnl;
        if (remainingQuantity > EPSILON) {
          state.positionList = [{ price, quantity: remainingQuantity }];
          state.direction = 'SHORT';
        } else if (state.positionList.length === 0) {
          state.direction = 'NONE';
        }
      }
    }

    const totalQuantity = state.positionList.reduce((sum, p) => sum + p.quantity, 0);
    const costOfPositions = state.positionList.reduce((sum, p) => sum + p.price * p.quantity, 0);

    const averageCost = totalQuantity > EPSILON ? costOfPositions / totalQuantity : 0;
    const breakEvenPrice = totalQuantity > EPSILON ? (costOfPositions - state.accumulatedRealizedPnl) / totalQuantity : 0;

    const date = new Date(trade.date);
    const weekday = ((date.getUTCDay() + 6) % 7) + 1; // Monday: 1, Sunday: 7

    return {
      ...trade,
      id: trade.id, // 确保保留原始ID
      weekday,
      tradeCount: state.tradeCount,
      amount: price * quantity,
      breakEvenPrice,
      realizedPnl,
      quantityAfter: state.direction === 'SHORT' ? -totalQuantity : totalQuantity,
      averageCost,
    };
  });
} 