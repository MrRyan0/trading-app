import { openDB, DBSchema, IDBPDatabase } from 'idb';

const DB_NAME = 'TradingApp';
const DB_VERSION = 2; // Incremented version for schema change
const TRADES_STORE_NAME = 'trades';
const POSITIONS_STORE_NAME = 'positions';
const PRICES_STORE_NAME = 'prices'; // New store for prices

// Matches the structure in trades.json -> trades array
export interface RawTrade {
  date: string; // "2025-07-04"
  symbol: string;
  side: 'BUY' | 'SELL' | 'SHORT' | 'COVER';
  qty: number;
  price: number;
  pl?: number;
  closed?: boolean;
}

// Matches the structure in trades.json -> positions array
export interface Position {
  symbol: string;
  qty: number;
  avgPrice: number;
  last: number;
  priceOk: boolean;
}

// New interface for cached prices
export interface CachedPrice {
  symbol: string;
  date: string;
  close: number;
  source: 'finnhub' | 'alphavantage' | 'import';
}

// Internal representation, adapted for the app
export interface Trade {
  id?: number;
  symbol: string;
  price: number;
  quantity: number;
  date: string;
  action: 'buy' | 'sell' | 'short' | 'cover';
}


interface TradingDB extends DBSchema {
  [TRADES_STORE_NAME]: {
    key: number;
    value: Trade;
    indexes: { 'by-date': string };
  };
  [POSITIONS_STORE_NAME]: {
    key: string;
    value: Position;
  };
  [PRICES_STORE_NAME]: {
    key: [string, string]; // [symbol, date]
    value: CachedPrice;
    indexes: { 'by-symbol': string };
  }
}

let dbPromise: Promise<IDBPDatabase<TradingDB>>;

function getDb(): Promise<IDBPDatabase<TradingDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TradingDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains(TRADES_STORE_NAME)) {
            const store = db.createObjectStore(TRADES_STORE_NAME, {
              keyPath: 'id',
              autoIncrement: true,
            });
            store.createIndex('by-date', 'date');
          }
          if (!db.objectStoreNames.contains(POSITIONS_STORE_NAME)) {
            db.createObjectStore(POSITIONS_STORE_NAME, { keyPath: 'symbol' });
          }
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains(PRICES_STORE_NAME)) {
            const store = db.createObjectStore(PRICES_STORE_NAME, {
              keyPath: ['symbol', 'date'],
            });
            store.createIndex('by-symbol', 'symbol');
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function importData(rawData: { positions: Position[], trades: RawTrade[] }) {
  const db = await getDb();
  const tradeCount = await db.count(TRADES_STORE_NAME);
  if (tradeCount > 0) {
    console.log('Data already exists. Skipping import.');
    return;
  }

  console.log('Importing data...');
  const tx = db.transaction([TRADES_STORE_NAME, POSITIONS_STORE_NAME], 'readwrite');

  // Import trades
  const tradeStore = tx.objectStore(TRADES_STORE_NAME);
  const tradePromises = rawData.trades.map(rawTrade => {
    const sideMap: Record<RawTrade["side"], Trade["action"]> = {
      BUY: 'buy',
      SELL: 'sell',
      SHORT: 'short',
      COVER: 'cover',
    };
    const action = sideMap[rawTrade.side];
    const trade: Trade = {
      symbol: rawTrade.symbol,
      price: rawTrade.price,
      quantity: rawTrade.qty,
      date: rawTrade.date,
      action,
    };
    return tradeStore.add(trade);
  });

  // Import positions
  const positionStore = tx.objectStore(POSITIONS_STORE_NAME);
  const positionPromises = rawData.positions.map(position => positionStore.add(position));

  await Promise.all([...tradePromises, ...positionPromises]);
  await tx.done;
  console.log('Data imported successfully.');
}

export async function clearAllData(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([TRADES_STORE_NAME, POSITIONS_STORE_NAME], 'readwrite');
  await Promise.all([
    tx.objectStore(TRADES_STORE_NAME).clear(),
    tx.objectStore(POSITIONS_STORE_NAME).clear(),
  ]);
  await tx.done;
  console.log('All trade and position data cleared.');
}

export async function clearAndImportData(rawData: { positions: Position[], trades: RawTrade[] }): Promise<void> {
  await clearAllData();

  const db = await getDb();
  console.log('Importing data...');
  const tx = db.transaction([TRADES_STORE_NAME, POSITIONS_STORE_NAME], 'readwrite');

  const tradeStore = tx.objectStore(TRADES_STORE_NAME);
  const tradePromises = rawData.trades.map(rawTrade => {
    const sideMap: Record<RawTrade["side"], Trade["action"]> = {
      BUY: 'buy',
      SELL: 'sell',
      SHORT: 'short',
      COVER: 'cover',
    };
    const action = sideMap[rawTrade.side];
    const trade: Trade = {
      symbol: rawTrade.symbol,
      price: rawTrade.price,
      quantity: rawTrade.qty,
      date: rawTrade.date,
      action,
    };
    return tradeStore.add(trade);
  });

  const positionStore = tx.objectStore(POSITIONS_STORE_NAME);
  const positionPromises = rawData.positions.map(position => positionStore.add(position));

  await Promise.all([...tradePromises, ...positionPromises]);
  await tx.done;
  console.log('Data imported successfully after clearing.');
}

export async function exportData(): Promise<{ positions: Position[], trades: Trade[] }> {
  const [positions, trades] = await Promise.all([
    findPositions(),
    findTrades(),
  ]);
  return { positions, trades };
}

export async function findTrades(): Promise<Trade[]> {
  const db = await getDb();
  const tx = db.transaction(TRADES_STORE_NAME, 'readonly');
  const store = tx.objectStore(TRADES_STORE_NAME);
  const list: Trade[] = [];
  let cursor = await store.openCursor();

  while (cursor) {
    const trade = cursor.value as Trade;
    const id = cursor.key as number;
    list.push({ ...trade, id });
    console.log('获取交易:', { ...trade, id });
    cursor = await cursor.continue();
  }

  console.log(`总共获取到 ${list.length} 条交易记录`);
  return list;
}

export async function findPositions(): Promise<Position[]> {
  const db = await getDb();
  return db.getAll(POSITIONS_STORE_NAME);
}

// --- New functions for price cache ---

export async function getPrice(symbol: string, date: string): Promise<CachedPrice | undefined> {
  const db = await getDb();
  return db.get(PRICES_STORE_NAME, [symbol, date]);
}

export async function putPrice(price: CachedPrice): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(PRICES_STORE_NAME, 'readwrite');
  await tx.store.put(price);
  await tx.done;
}

export async function importClosePrices(nestedPrices: Record<string, Record<string, number>>): Promise<number> {
  // nestedPrices format: { '2025-07-05': { 'AAPL': 123.45, ... }, ... }
  let imported = 0;
  const promises: Promise<void>[] = [];
  for (const date in nestedPrices) {
    const dayObj = nestedPrices[date];
    if (dayObj && typeof dayObj === 'object') {
      for (const symbol in dayObj) {
        const close = dayObj[symbol];
        if (typeof close === 'number') {
          promises.push(putPrice({ symbol, date, close, source: 'import' }));
          imported++;
        }
      }
    }
  }
  await Promise.all(promises);
  return imported;
}

export async function getAllPrices(): Promise<CachedPrice[]> {
  const db = await getDb();
  return db.getAll(PRICES_STORE_NAME);
}

export async function addTrade(trade: Trade): Promise<number> {
  const db = await getDb();
  const id = await db.add(TRADES_STORE_NAME, trade as Trade);
  return id;
}

// Update existing trade (by id)
export async function updateTrade(trade: Trade): Promise<void> {
  if (trade.id == null) throw new Error('Trade id is required for update');
  const db = await getDb();
  console.log('更新交易:', trade);
  await db.put(TRADES_STORE_NAME, trade);
  console.log('交易更新成功');
}

export async function deleteTrade(id: number): Promise<void> {
  const db = await getDb();
  await db.delete(TRADES_STORE_NAME, id);
} 