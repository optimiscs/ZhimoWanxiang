import { useEventContext } from '@/contexts/EventContext';
import { Area } from '@antv/g2plot';
import React from 'react';

const HeatTrendChart: React.FC = () => {
  const { selectedEvent } = useEventContext();
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!selectedEvent || !containerRef.current) return;
    const data = selectedEvent.heatTrend;

    const area = new Area(containerRef.current, {
      data,
      xField: 'date',
      yField: 'value',
      smooth: true,
      padding: 0, // 移除图表内边距
      height: 100, // 固定图表高度
      // 隐藏x轴相关元素
      xAxis: {
        line: null, // 隐藏轴线
        grid: null // 隐藏网格线
      },
      // 完全隐藏y轴相关元素
      yAxis: {
        line: null,
        grid: null, // 新增：隐藏y轴网格线（横线）

      },
      areaStyle: {
        fill: 'l(270) 0:rgba(255,255,255,0.8) 0.5:rgba(126,194,243,0.6) 1:rgba(30,134,242,0.4)',
        fillOpacity: 0.8,
        stroke: 'transparent' // 移除描边
      },
      animation: {
        appear: {
            animation: 'waveIn', // 入场动画类型，这里使用 waveIn 效果
            duration: 1000, // 动画持续时间，单位为毫秒
            easing: 'ease-in-out', // 动画缓动函数
        },
    },
    });
    area.render();

    return () => area.destroy();
  }, [selectedEvent]);

  return selectedEvent ? (
    <div
      ref={containerRef}
      style={{
        height: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden', // 隐藏溢出内容

      }}
    />
  ) : null;
};

export default HeatTrendChart;