import { useState, useEffect } from 'react';
import { addTrade, updateTrade } from '@/lib/services/dataService';

interface Props {
  onClose: () => void;
  onAdded: () => void;
  trade?: any; // Assuming trade object structure
}

function buildOptionSymbol(root: string, dateStr: string, cp: string, strike: number): string {
  if (!root || !dateStr || !cp || !strike) return '';

  // Format: AAPL230915C00165000
  const date = new Date(dateStr);
  const yy = date.getFullYear().toString().slice(-2);
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  const strikeStr = (strike * 1000).toFixed(0).padStart(8, '0');

  return `${root}${yy}${mm}${dd}${cp}${strikeStr}`;
}

export default function AddTradeModal({ onClose, onAdded, trade }: Props) {
  const editing = !!trade;
  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState<'BUY' | 'SELL' | 'SHORT' | 'COVER'>('BUY');
  const [qty, setQty] = useState<number>(0);
  const [price, setPrice] = useState<number>(0);
  const [isOption, setIsOption] = useState(false);

  // Option fields
  const [optRoot, setOptRoot] = useState('');
  const [optExp, setOptExp] = useState('');
  const [optType, setOptType] = useState<'C' | 'P'>('C');
  const [optStrike, setOptStrike] = useState<number>(0);

  // Get current NY time for default
  const now = new Date();
  const nyTime = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const nyDate = new Date(nyTime);
  const defaultDatetime = nyDate.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM format

  const [datetime, setDatetime] = useState(defaultDatetime);

  // Generate option symbol when fields change
  const generatedOptionSymbol = isOption
    ? buildOptionSymbol(optRoot, optExp, optType, optStrike)
    : '';

  // Update symbol when option fields change
  if (isOption && generatedOptionSymbol) {
    if (symbol !== generatedOptionSymbol) {
      setSymbol(generatedOptionSymbol);
    }
  }

  // ---------- 同步传入的 trade 数据 ----------
  useEffect(() => {
    if (trade) {
      console.log('[AddTradeModal] 编辑模式载入:', trade);
      setSymbol(trade.symbol);
      setSide(trade.action.toUpperCase() as 'BUY' | 'SELL' | 'SHORT' | 'COVER');
      setQty(trade.quantity);
      setPrice(trade.price);

      // 处理日期 -> datetime-local 格式 (YYYY-MM-DDTHH:MM)
      try {
        const d = new Date(trade.date);
        const iso = d.toISOString(); // YYYY-MM-DDTHH:MM:SSZ
        setDatetime(iso.slice(0, 16));
      } catch (e) {
        console.error('无法解析日期:', trade.date, e);
      }

      // 根据 symbol 判断是否为期权（简单判断：长度 > 6 且包含C或P第6位）
      const isOpt = trade.symbol.length > 6 && /[CP]\d{8}$/.test(trade.symbol);
      setIsOption(isOpt);
      if (isOpt) {
        // 尝试解析期权 symbol，若失败则忽略
        const root = trade.symbol.slice(0, trade.symbol.length - 15);
        setOptRoot(root);
        setOptType(trade.symbol.charAt(trade.symbol.length - 15) as 'C' | 'P');
        const expStr = trade.symbol.slice(root.length, root.length + 6); // YYMMDD
        if (expStr.length === 6) {
          const yy = '20' + expStr.slice(0, 2);
          const mm = expStr.slice(2, 4);
          const dd = expStr.slice(4, 6);
          setOptExp(`${yy}-${mm}-${dd}`);
        }
        const strikeStr = trade.symbol.slice(-8);
        const strike = parseInt(strikeStr, 10) / 1000;
        setOptStrike(strike);
      }
    }
  }, [trade]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || qty <= 0 || price <= 0) {
      alert('请输入完整信息');
      return;
    }

    const tradeDate = datetime.slice(0, 10); // YYYY-MM-DD

    const baseTrade = {
      symbol: symbol.toUpperCase(),
      price,
      quantity: qty,
      date: tradeDate,
      action: side.toLowerCase() as 'buy' | 'sell' | 'short' | 'cover',
    };

    if (editing && trade?.id != null) {
      console.log('[AddTradeModal] 更新交易:', { ...baseTrade, id: trade.id });
      await updateTrade({ ...baseTrade, id: trade.id });
    } else {
      console.log('[AddTradeModal] 新增交易:', baseTrade);
      await addTrade(baseTrade);
    }

    onAdded();
    onClose();
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>{editing ? '编辑交易' : '添加交易'}</h3>
        <form onSubmit={handleSubmit}>
          <label>是否期权</label>
          <input
            type="checkbox"
            checked={isOption}
            onChange={e => setIsOption(e.target.checked)}
            style={{ width: 'auto' }}
          />

          <label>交易时间</label>
          <input
            type="datetime-local"
            value={datetime}
            onChange={e => setDatetime(e.target.value)}
            required
          />

          {!isOption ? (
            <div>
              <label>股票代码</label>
              <input
                value={symbol}
                onChange={e => setSymbol(e.target.value)}
                required
              />
            </div>
          ) : (
            <div>
              <label>正股</label>
              <input
                value={optRoot}
                onChange={e => setOptRoot(e.target.value.trim().toUpperCase())}
                placeholder="AAPL"
                required
              />

              <label>到期日</label>
              <input
                type="date"
                value={optExp}
                onChange={e => setOptExp(e.target.value)}
                required
              />

              <label>期权类型</label>
              <select
                value={optType}
                onChange={e => setOptType(e.target.value as 'C' | 'P')}
              >
                <option value="C">Call</option>
                <option value="P">Put</option>
              </select>

              <label>行权价</label>
              <input
                type="number"
                step="0.01"
                value={optStrike || ''}
                onChange={e => setOptStrike(parseFloat(e.target.value) || 0)}
                required
              />

              <label>生成代码</label>
              <input
                value={generatedOptionSymbol}
                readOnly
              />
            </div>
          )}

          <label>交易方向</label>
          <select
            value={side}
            onChange={e => setSide(e.target.value as 'BUY' | 'SELL' | 'SHORT' | 'COVER')}
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
            <option value="SHORT">SHORT</option>
            <option value="COVER">COVER</option>
          </select>

          <label>数量(张)</label>
          <input
            type="number"
            value={qty || ''}
            onChange={e => setQty(parseInt(e.target.value || '0', 10))}
            required
          />

          <label>单价</label>
          <input
            type="number"
            step="0.01"
            value={price || ''}
            onChange={e => setPrice(parseFloat(e.target.value || '0'))}
            required
          />

          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button type="button" className="btn" style={{ marginRight: 6 }} onClick={onClose}>取消</button>
            <button type="submit" className="btn">确定</button>
          </div>
        </form>
      </div>
    </div>
  );
} 