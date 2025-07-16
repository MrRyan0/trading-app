import { useState, useEffect } from 'react';
import { addTrade, updateTrade } from '@/lib/services/dataService';
import type { EnrichedTrade } from '@/lib/fifo';

type Side = 'BUY' | 'SELL' | 'SHORT' | 'COVER';

interface Props {
  onClose: () => void;
  onAdded: () => void;
  trade?: EnrichedTrade;
}

export default function AddTradeModal({ onClose, onAdded, trade }: Props) {
  const editing = !!trade;

  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState<Side>('BUY');
  const [qty, setQty] = useState(0);
  const [price, setPrice] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (trade) {
      console.log('编辑交易:', trade);
      setSymbol(trade.symbol);
      // 将action转换为大写，确保匹配Side类型
      setSide(trade.action.toUpperCase() as Side);
      setQty(trade.quantity);
      setPrice(trade.price);

      // 确保日期格式正确
      try {
        const tradeDate = new Date(trade.date);
        const formattedDate = tradeDate.toISOString().slice(0, 10);
        setDate(formattedDate);
        console.log('设置日期:', formattedDate, '原始日期:', trade.date);
      } catch (e) {
        console.error('日期格式错误:', trade.date, e);
        // 回退到当前日期
        setDate(new Date().toISOString().slice(0, 10));
      }
    }
  }, [trade]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || qty <= 0 || price <= 0) {
      alert('请输入完整信息');
      return;
    }

    // 确保action是小写的
    const action = side.toLowerCase() as 'buy' | 'sell' | 'short' | 'cover';

    console.log('提交交易:', {
      id: editing ? trade?.id : undefined,
      symbol,
      price,
      quantity: qty,
      date,
      action
    });

    if (editing && trade?.id != null) {
      await updateTrade({
        id: trade.id,
        symbol: symbol.toUpperCase(),
        price,
        quantity: qty,
        date,
        action
      });
    } else {
      await addTrade({
        symbol: symbol.toUpperCase(),
        price,
        quantity: qty,
        date,
        action
      });
    }
    onAdded();
    onClose();
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>{editing ? '编辑交易' : '新增交易'}</h3>
        <form onSubmit={handleSubmit}>
          <label>日期</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required />

          <label>代码</label>
          <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} required />

          <label>方向</label>
          <select value={side} onChange={e => setSide(e.target.value as Side)}>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
            <option value="SHORT">SHORT</option>
            <option value="COVER">COVER</option>
          </select>

          <label>数量</label>
          <input type="number" value={qty} onChange={e => setQty(parseInt(e.target.value || '0', 10))} required />

          <label>单价</label>
          <input type="number" step="0.01" value={price} onChange={e => setPrice(parseFloat(e.target.value || '0'))} required />

          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button type="button" className="btn" style={{ marginRight: 6 }} onClick={onClose}>取消</button>
            <button type="submit" className="btn">保存</button>
          </div>
        </form>
      </div>
    </div>
  );
} 