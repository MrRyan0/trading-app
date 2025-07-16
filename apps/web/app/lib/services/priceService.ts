import { getPrice, putPrice, CachedPrice } from './dataService';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const finnhubToken = process.env.NEXT_PUBLIC_FINNHUB_TOKEN;
// 新增: 运行时从 /KEY.txt 解析 token 的回退逻辑
let _runtimeKeys: { finnhub?: string; alpha?: string } | null = null;
async function loadKeysFromTxt() {
  if (_runtimeKeys) return _runtimeKeys;
  try {
    const txt = await fetch('/KEY.txt').then(r => r.text());
    const fh = txt.match(/Finnhub\s+key：([A-Za-z0-9]+)/i);
    const av = txt.match(/Alpha\s+key：([A-Za-z0-9]+)/i);
    _runtimeKeys = {
      finnhub: fh ? (fh[1] as string).trim() : undefined,
      alpha: av ? (av[1] as string).trim() : undefined,
    };
  } catch (e) {
    console.warn('[priceService] loadKeysFromTxt failed', e);
    _runtimeKeys = {};
  }
  return _runtimeKeys;
}
async function getFinnhubToken() {
  return finnhubToken || (await loadKeysFromTxt()).finnhub;
}
async function getAlphaToken() {
  return alphaVantageToken || (await loadKeysFromTxt()).alpha;
}

const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';
const alphaVantageToken = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_TOKEN;

/**
 * Fetches daily close price from Finnhub API.
 * @param symbol The stock symbol.
 * @param date The date in YYYY-MM-DD format.
 * @returns The close price or null if not found.
 */
async function fetchFinnhubDailyClose(symbol: string, date: string): Promise<number | null> {
  const token = await getFinnhubToken();
  if (!token) {
    console.warn('Finnhub token is not set.');
    return null;
  }

  const fromTs = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
  const toTs = Math.floor(new Date(`${date}T23:59:59Z`).getTime() / 1000);
  const url = `${FINNHUB_BASE_URL}/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${fromTs}&to=${toTs}&token=${token}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Finnhub API error for ${symbol}: ${response.statusText}`);
      return null;
    }
    const json = await response.json();

    if (json && json.c && json.c.length > 0) {
      const close = json.c[0];
      await putPrice({ symbol, date, close, source: 'finnhub' });
      return close;
    }
  } catch (error) {
    console.warn(`Failed to fetch from Finnhub for ${symbol}`, error);
  }

  return null;
}

/**
 * Fetches daily close price from Alpha Vantage API as a fallback.
 * @param symbol The stock symbol.
 * @param date The date in YYYY-MM-DD format.
 * @returns The close price or null if not found.
 */
async function fetchAlphaVantageDailyClose(symbol: string, date: string): Promise<number | null> {
  const token = await getAlphaToken();
  if (!token) {
    console.warn('Alpha Vantage token is not set.');
    return null;
  }

  const url = `${ALPHA_VANTAGE_BASE_URL}?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${token}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Alpha Vantage API error for ${symbol}: ${response.statusText}`);
      return null;
    }
    const json = await response.json();

    // Note: Check for API limit message
    if (json['Note']) {
      console.warn(`Alpha Vantage API limit reached for ${symbol}: ${json['Note']}`);
      return null;
    }

    const series = json['Time Series (Daily)'];
    if (series && series[date] && series[date]['4. close']) {
      const close = parseFloat(series[date]['4. close']);
      await putPrice({ symbol, date, close, source: 'alphavantage' });
      return close;
    }
  } catch (error) {
    console.warn(`Failed to fetch from Alpha Vantage for ${symbol}`, error);
  }

  return null;
}

async function fetchFinnhubRealtimeQuote(symbol: string): Promise<number | null> {
  const token = await getFinnhubToken();
  if (!token) {
    console.warn('Finnhub token is not set.');
    return null;
  }
  const url = `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Finnhub quote API error for ${symbol}: ${response.statusText}`);
      return null;
    }
    const json = await response.json();

    // 'c' is current price in Finnhub's quote response
    if (json && typeof json.c === 'number' && json.c > 0) {
      return json.c;
    }
  } catch (error) {
    console.warn(`Failed to fetch quote from Finnhub for ${symbol}`, error);
  }

  return null;
}

async function fetchAlphaVantageRealtimeQuote(symbol: string): Promise<number | null> {
  const token = await getAlphaToken();
  if (!token) {
    console.warn('Alpha Vantage token is not set.');
    return null;
  }

  const url = `${ALPHA_VANTAGE_BASE_URL}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${token}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Alpha Vantage quote API error for ${symbol}: ${response.statusText}`);
      return null;
    }
    const json = await response.json();

    if (json['Note']) {
      console.warn(`Alpha Vantage API limit reached for ${symbol}: ${json['Note']}`);
      return null;
    }

    const quote = json['Global Quote'];
    if (quote && quote['05. price']) {
      return parseFloat(quote['05. price']);
    }
  } catch (error) {
    console.warn(`Failed to fetch quote from Alpha Vantage for ${symbol}`, error);
  }

  return null;
}

/**
 * Fetches the daily close price for a symbol, using a cache-first strategy.
 * Tries cache -> Finnhub -> Alpha Vantage.
 * @param symbol The stock symbol.
 * @param date The date in YYYY-MM-DD format.
 * @returns The close price.
 * @throws An error if the price cannot be fetched from any source.
 */
export async function fetchDailyClose(symbol: string, date: string): Promise<number> {
  const cachedPrice = await getPrice(symbol, date);
  if (cachedPrice) {
    return cachedPrice.close;
  }

  const finnhubPrice = await fetchFinnhubDailyClose(symbol, date);
  if (finnhubPrice !== null) {
    return finnhubPrice;
  }

  console.log(`Finnhub failed for ${symbol}, trying Alpha Vantage...`);
  const alphaVantagePrice = await fetchAlphaVantageDailyClose(symbol, date);
  if (alphaVantagePrice !== null) {
    return alphaVantagePrice;
  }

  throw new Error(`Unable to fetch close price for ${symbol} on ${date}`);
}

/**
 * Fetches the real-time quote for a symbol.
 * Tries Finnhub -> Alpha Vantage.
 * @param symbol The stock symbol.
 * @returns The real-time price.
 * @throws An error if the price cannot be fetched from any source.
 */
export async function fetchRealtimeQuote(symbol: string): Promise<number> {
  const finnhubPrice = await fetchFinnhubRealtimeQuote(symbol);
  if (finnhubPrice !== null) {
    return finnhubPrice;
  }

  console.log(`Finnhub quote failed for ${symbol}, trying Alpha Vantage...`);
  const alphaVantagePrice = await fetchAlphaVantageRealtimeQuote(symbol);
  if (alphaVantagePrice !== null) {
    return alphaVantagePrice;
  }

  throw new Error(`Unable to fetch real-time quote for ${symbol}`);
}

// 兼容旧版 API：导出同名函数 fetchRealtimePrice
export async function fetchRealtimePrice(symbol: string): Promise<number> {
  return fetchRealtimeQuote(symbol);
} 