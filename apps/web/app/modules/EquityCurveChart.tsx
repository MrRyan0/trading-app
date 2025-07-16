'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { EnrichedTrade } from '@/lib/fifo';

interface EquityCurveChartProps {
  enrichedTrades: EnrichedTrade[];
}

export function EquityCurveChart({ enrichedTrades }: EquityCurveChartProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const chartData = useMemo(() => {
    let cumulativePnl = 0;
    return enrichedTrades.map((trade, index) => {
      cumulativePnl += trade.realizedPnl;
      return {
        name: `Trade ${index + 1}`,
        date: trade.date,
        'Cumulative P&L': cumulativePnl,
      };
    });
  }, [enrichedTrades]);

  if (!isClient) {
    // Render a placeholder or nothing on the server and initial client render
    return <div style={{ width: '100%', height: '400px' }} />;
  }

  // This code now only runs on the client after hydration
  const isDarkMode = document.documentElement.classList.contains('dark');

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart
        data={chartData}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#d1d5db'} />
        <XAxis dataKey="date" stroke={isDarkMode ? '#9ca3af' : '#4b5563'} />
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
        />
        <Legend wrapperStyle={{ color: isDarkMode ? '#f9fafb' : '#111827' }} />
        <Line
          type="monotone"
          dataKey="Cumulative P&L"
          stroke="#8884d8"
          activeDot={{ r: 8 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
} 