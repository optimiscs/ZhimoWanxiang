export interface HeatTrendItem {
    date: string;
    value: number;
  }
  
  export interface EventData {
    id: string;
    title: string;
    introduction: string;
    emotion: number;
    spreadRange: number;
    heatTrend: HeatTrendItem[];
    timeline: Array<{ date: string; event: string }>;
  }