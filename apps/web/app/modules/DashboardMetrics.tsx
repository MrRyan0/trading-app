'use client';

import type { EnrichedTrade } from "@/lib/fifo";
import type { Position } from '@/lib/services/dataService';
import { useStore } from '@/lib/store';
import { formatCurrency } from '@/lib/metrics';
import type { Metrics } from '@/lib/metrics';

interface Props { enrichedTrades: EnrichedTrade[]; positions: Position[] }

export function DashboardMetrics({ enrichedTrades, positions }: Props) {
  // 从全局状态获取指标
  const metrics = useStore(state => state.metrics);

  // 如果指标未加载，显示加载中
  if (!metrics) {
    return <section id="stats" className="stats-grid">正在加载指标...</section>;
  }

  // 按顺序渲染所有指标卡片
  const order = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "M12", "M13"] as const;

  // 定义指标名称映射
  const metricNames: Record<keyof Metrics, string> = {
    M1: "账户总成本",
    M2: "当前市值",
    M3: "当前浮动盈亏",
    M4: "当日已实现盈亏",
    M5: "日内交易",
    M6: "当日浮动盈亏",
    M7: "当日交易次数",
    M8: "累计交易次数",
    M9: "历史已实现盈亏",
    M10: "胜率",
    M11: "WTD",
    M12: "MTD",
    M13: "YTD"
  };

  return (
    <section id="stats" className="stats-grid">
      {order.map(key => {
        const metricKey = key as keyof Metrics;
        const value = metrics[metricKey];
        let formattedValue: string;
        let colorClass = '';

        // 根据不同指标类型格式化值
        if (metricKey === 'M5') {
          const m5 = value as Metrics['M5'];
          formattedValue = `交易: ${formatCurrency(m5.trade)} | FIFO: ${formatCurrency(m5.fifo)}`;
        }
        else if (metricKey === 'M7' || metricKey === 'M8') {
          const counts = value as Metrics['M7'] | Metrics['M8'];
          formattedValue = `B/${counts.B} S/${counts.S} P/${counts.P} C/${counts.C} 【${counts.total}】`;
        }
        else if (metricKey === 'M10') {
          const m10 = value as Metrics['M10'];
          formattedValue = `W/${m10.W} L/${m10.L} ${m10.rate.toFixed(1)}%`;
        }
        else {
          const numValue = value as number;
          formattedValue = formatCurrency(numValue);

          // 设置颜色
          if (["M3", "M4", "M6", "M9", "M11", "M12", "M13"].includes(key)) {
            colorClass = numValue > 0 ? 'green' : numValue < 0 ? 'red' : '';
          }
        }

        return (
          <div className="box" key={key}>
            <div className="title">{metricNames[metricKey]}</div>
            <div
              className={`value ${colorClass}`}
              id={`${key}-value`}
            >
              {formattedValue}
            </div>
          </div>
        );
      })}
    </section>
  );
} 