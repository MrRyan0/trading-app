import { create } from 'zustand';
import { Metrics } from './metrics';

interface StoreState {
  // 指标数据
  metrics: Metrics | null;
  // 设置指标方法
  setMetrics: (metrics: Metrics) => void;
}

export const useStore = create<StoreState>((set) => ({
  metrics: null,
  setMetrics: (metrics) => set({ metrics }),
})); 