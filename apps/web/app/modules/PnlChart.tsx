'use client';

import { useEffect, useRef, useState } from 'react';
import type { EnrichedTrade } from '@/lib/fifo';
import Script from 'next/script';

interface PnlChartProps {
  trades: EnrichedTrade[];
}

export function PnlChart({ trades }: PnlChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [chartLoaded, setChartLoaded] = useState(false);
  const [activeView, setActiveView] = useState<'day' | 'week' | 'month'>('day');
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current || !chartLoaded) return;

    // Clean up existing chart
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Group trades by date for daily view, week for weekly view, or month for monthly view
    const pnlData: Record<string, number> = {};
    trades.forEach(trade => {
      if (!trade.date) return; // Skip trades without a date

      const date = new Date(trade.date);
      let key = '';

      if (activeView === 'day') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      } else if (activeView === 'week') {
        // Get the week number
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
        const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        key = `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
      } else { // month
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      // Safely initialize and update the pnlData
      pnlData[key] = (pnlData[key] || 0) + (trade.realizedPnl || 0);
    });

    // Sort keys chronologically
    const sortedKeys = Object.keys(pnlData).sort();

    // Calculate cumulative P&L
    const cumulativePnl: Record<string, number> = {};
    let runningTotal = 0;
    sortedKeys.forEach(key => {
      // Use type assertion to tell TypeScript that pnlData[key] is a number
      runningTotal += (pnlData[key] as number);
      cumulativePnl[key] = runningTotal;
    });

    // Format labels based on the active view
    const labels = sortedKeys.map(key => {
      if (activeView === 'day') {
        return key.split('-').slice(1).join('/'); // MM/DD format
      } else if (activeView === 'week') {
        const weekParts = key.split('-W');
        return weekParts.length > 1 && weekParts[1] ? `W${weekParts[1]}` : key;
      } else { // month
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const parts = key.split('-');
        if (parts.length >= 2 && parts[1]) {
          const monthIdx = parseInt(parts[1], 10) - 1;
          if (monthIdx >= 0 && monthIdx < monthNames.length) {
            return `${monthNames[monthIdx]} ${parts[0] || ''}`;
          }
        }
        return key; // Fallback for invalid data
      }
    });

    // Create the chart
    const Chart = (window as any).Chart;
    if (!Chart) return;

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'P&L',
            data: sortedKeys.map(key => pnlData[key] || 0),
            borderColor: '#00e676',
            backgroundColor: 'rgba(0, 230, 118, 0.2)',
            borderWidth: 2,
            pointBackgroundColor: '#00e676',
          },
          {
            label: 'Cumulative P&L',
            data: sortedKeys.map(key => cumulativePnl[key] || 0),
            borderColor: '#0090ff',
            backgroundColor: 'rgba(0, 144, 255, 0.1)',
            borderWidth: 2,
            pointBackgroundColor: '#0090ff',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            ticks: {
              callback: function (value: any) {
                return '$' + value.toLocaleString();
              }
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function (context: any) {
                return context.dataset.label + ': $' + context.parsed.y.toLocaleString();
              }
            }
          }
        }
      }
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [trades, activeView, chartLoaded]);

  const handleViewChange = (view: 'day' | 'week' | 'month') => {
    setActiveView(view);
  };

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"
        onLoad={() => setChartLoaded(true)}
      />
      <div className="btn-group" style={{ marginBottom: '10px' }}>
        <button
          className={`btn ${activeView === 'day' ? 'active' : ''}`}
          id="btn-day"
          onClick={() => handleViewChange('day')}
        >
          日
        </button>
        <button
          className={`btn ${activeView === 'week' ? 'active' : ''}`}
          id="btn-week"
          onClick={() => handleViewChange('week')}
        >
          周
        </button>
        <button
          className={`btn ${activeView === 'month' ? 'active' : ''}`}
          id="btn-month"
          onClick={() => handleViewChange('month')}
        >
          月
        </button>
      </div>
      <div style={{ position: 'relative', height: '220px' }}>
        <canvas id="pnlCanvas" ref={canvasRef} height="220"></canvas>
      </div>
    </>
  );
} 