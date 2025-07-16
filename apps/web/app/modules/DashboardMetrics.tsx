'use client';

import type { EnrichedTrade } from "@/lib/fifo";
import type { Position } from '@/lib/services/dataService';
import { useStore } from '@/lib/store';
import { formatCurrency } from '@/lib/metrics';

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
  const metricNames: Record<keyof typeof metrics, string> = {
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

  // 确定应该格式化为百分比的指标
  const percentMetrics = new Set(["M10"]);

  return (
    <section id="stats" className="stats-grid">
      {order.map(key => {
        const value = metrics[key];
        const isPercent = percentMetrics.has(key);
        const formattedValue = isPercent
          ? `${value.toFixed(1)}%`
          : formatCurrency(value);

        const colorClass = value > 0 ? 'green' : value < 0 ? 'red' : 'white';
        const needsColor = ["M3", "M4", "M6", "M9", "M11", "M12", "M13"].includes(key);

        return (
          <div className="box" key={key}>
            <div className="title">{metricNames[key]}</div>
            <div
              className={`value ${needsColor ? colorClass : ''}`}
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