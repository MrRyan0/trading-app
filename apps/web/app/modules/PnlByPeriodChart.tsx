'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { EnrichedTrade } from '@/lib/fifo';

interface PnlByPeriodChartProps {
  trades: EnrichedTrade[];
  period: 'monthly' | 'yearly';
}

export function PnlByPeriodChart({ trades, period }: PnlByPeriodChartProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const chartData = useMemo(() => {
    const pnlByPeriod: Record<string, number> = {};

    trades.forEach((trade) => {
      const date = new Date(trade.date);
      const key =
        period === 'monthly'
          ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          : `${date.getFullYear()}`;

      if (!pnlByPeriod[key]) {
        pnlByPeriod[key] = 0;
      }
      pnlByPeriod[key] += trade.realizedPnl;
    });

    return Object.entries(pnlByPeriod)
      .map(([name, pnl]) => ({ name, 'P&L': pnl }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [trades, period]);

  if (!isClient) {
    return <div style={{ width: '100%', height: '400px' }} />;
  }

  const isDarkMode = document.documentElement.classList.contains('dark');

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart
        data={chartData}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#d1d5db'} />
        <XAxis dataKey="name" stroke={isDarkMode ? '#9ca3af' : '#4b5563'} />
        <YAxis
          stroke={isDarkMode ? '#9ca3af' : '#4b5563'}
          tickFormatter={(value) =>
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              notation: 'compact',
            }).format(value)
          }
        />
        <Tooltip
          contentStyle={{
            backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
            borderColor: isDarkMode ? '#374151' : '#d1d5db',
          }}
          labelStyle={{ color: isDarkMode ? '#f9fafb' : '#111827' }}
          formatter={(value: number) => [
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(value),
            'P&L'
          ]}
        />
        <Legend wrapperStyle={{ color: isDarkMode ? '#f9fafb' : '#111827' }} />
        <Bar dataKey="P&L">
          {chartData.map((entry, index) => (
            <Bar
              key={`cell-${index}`}
              dataKey="P&L"
              fill={entry['P&L'] >= 0 ? '#22c55e' : '#ef4444'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
} 