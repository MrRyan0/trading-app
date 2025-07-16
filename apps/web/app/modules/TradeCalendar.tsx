'use client';

import { useState } from 'react';
import type { EnrichedTrade } from '@/lib/fifo';
import { useMemo } from 'react';

interface TradeCalendarProps {
  trades: EnrichedTrade[];
  title: string;
  id: string;
  isIntraday?: boolean;
}

export function TradeCalendar({ trades, title, id, isIntraday = false }: TradeCalendarProps) {
  const [view, setView] = useState<'day' | 'week' | 'month' | 'year'>('year');

  // 计算每日已实现盈亏
  const dailyData = useMemo<{ date: string; realized: number }[]>(() => {
    if (trades.length === 0) return [] as { date: string; realized: number }[];
    const map: Record<string, number> = {};
    trades.forEach(t => {
      const date = t.date;
      const pnl = t.realizedPnl || 0;
      if (!isIntraday) {
        map[date] = (map[date] || 0) + pnl;
      } else {
        // intraday: 只有买卖在同一天平仓的交易，简单判断 realizedPnl !==0
        if (pnl !== 0) map[date] = (map[date] || 0) + pnl;
      }
    });
    return Object.entries(map).map(([date, realized]) => ({ date, realized }));
  }, [trades, isIntraday]);

  // 按年月分组，生成日历网格
  const months = useMemo(() => {
    const byMonth: Record<string, { day: number; pnl: number | undefined }[]> = {};
    dailyData.forEach(d => {
      const [year, mon, day] = d.date.split('-').map(Number);
      const key = `${year}-${String(mon).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = [];
      // @ts-ignore - ensure pnl is treated as number
      byMonth[key].push({ day, pnl: (d.realized ?? 0) });
    });
    return byMonth;
  }, [dailyData]);

  return (
    <section>
      <h3 className="section-title">{title}</h3>
      <div className="calendar-controls">
        {/* 视图切换按钮（仅保留 UI） */}
        <div className="btn-group view-btns">
          {(['day', 'week', 'month', 'year'] as const).map(v => (
            <button key={v} className={`btn view-btn ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>{v === 'day' ? '日' : v === 'week' ? '周' : v === 'month' ? '月' : '年'}</button>
          ))}
        </div>
      </div>
      <div id={id} className="calendar-scroll">
        {Object.entries(months).map(([month, arr]) => {
          // 计算该月第一天星期几
          const [yStr, mStr] = month.split('-');
          const firstDate = new Date(Number(yStr), Number(mStr) - 1, 1);
          const firstWeekDay = firstDate.getDay();
          const daysInMonth = new Date(Number(yStr), Number(mStr), 0).getDate();
          const dayMap: Record<number, number> = {};
          arr.forEach(d => { dayMap[d.day] = d.pnl ?? 0; });
          return (
            <div key={month} style={{ marginBottom: 8 }}>
              <h4 style={{ margin: '6px 0 4px' }}>{month}</h4>
              <div className="calendar-grid">
                {Array.from({ length: firstWeekDay }).map((_, idx) => <div key={`empty-${idx}`} className="calendar-cell zero"></div>)}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const day = idx + 1;
                  const pnl = dayMap[day] || 0;
                  const cls = pnl > 0 ? 'positive' : pnl < 0 ? 'negative' : 'zero';
                  return (
                    <div key={day} className={`calendar-cell ${cls}`}>
                      <div>{day}</div>
                      {pnl !== 0 && <div>{pnl.toFixed(0)}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
} 