// src/contexts/EventContext.tsx
import React, { createContext, useContext, useState, useMemo, useEffect, ReactNode } from 'react';

// 定义事件数据类型
export interface EventData {
  id?: string;
  title?: string;
  introduction?: string;
  type?: string;
  area?: string;
  x?: number;
  y?: number;
  spreadSpeed?: number;
  spreadRange?: number;
  participants?: number;
  emotion?: {
    schema: Record<string, number>;
    rationale?: string;
  };
  stance?: {
    schema: Record<string, number>;
    rationale?: string;
  };
  wordCloud?: Array<{
    word: string;
    weight: number;
  }>;
  timeline?: Array<{
    date: string;
    event: string;
  }>;
  heatTrend?: Array<{
    date: string;
    value: number;
  }>;
  rank?: number;
  rank_change?: 'up' | 'down' | 'same' | 'new';
  heat_history?: Array<{
    comprehensive_heat: number;
    normalized_heat: number;
    timestamp: string;
    weighted_heat_value: number;
  }>;
}

// 上下文接口
interface EventContextType {
  selectedEvent: EventData | null;
  setSelectedEvent: (event: EventData) => void;
  allEvents: EventData[];
  setAllEvents: (events: EventData[]) => void;
  loading: boolean;
}

// 创建上下文
const EventContext = createContext<EventContextType>({
  selectedEvent: null,
  setSelectedEvent: () => {},
  allEvents: [],
  setAllEvents: () => {},
  loading: false,
});

// 提供者组件
export const EventProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [allEvents, setAllEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(false);

  // 获取事件数据
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/currentnews');
        const data = await response.json();

        if (data.data && Array.isArray(data.data)) {
          setAllEvents(data.data);
          if (data.data.length > 0 && !selectedEvent) {
            setSelectedEvent(data.data[0]);
          }
        }
      } catch (error) {
        console.error('获取事件数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const contextValue = useMemo(() => ({
    selectedEvent,
    setSelectedEvent,
    allEvents,
    setAllEvents,
    loading
  }), [selectedEvent, allEvents, loading]);

  return (
    <EventContext.Provider value={contextValue}>
      {children}
    </EventContext.Provider>
  );
};

// 自定义钩子
export const useEventContext = () => useContext(EventContext);
