import { Area } from '@antv/g2plot';
import React from 'react';

const HeatTrendChart: React.FC<any> = ({ data }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const primaryColor = 'rgba(30, 134, 242, 1)';

  React.useEffect(() => {
    if (!containerRef.current) return;

    const area = new Area(containerRef.current, {
      data,
      xField: 'date',
      yField: 'value',
      smooth: true,
      padding: [30, 20, 30, 40],
      height: 200,
      xAxis: {
        label: {
          style: {
            fill: 'rgba(0, 0, 0, 0.65)',
            fontSize: 10,
          },
          formatter: (text) => {
            // 缩短日期格式，如2024-08-10 → 08-10
            const parts = text.split('-');
            if (parts.length === 3) {
              return `${parts[1]}-${parts[2]}`;
            }
            return text;
          },
        },
        line: {
          style: {
            stroke: 'rgba(30, 134, 242, 0.2)',
          },
        },
        tickLine: null,
      },
      yAxis: {
        label: {
          style: {
            fill: 'rgba(0, 0, 0, 0.45)',
            fontSize: 10,
          },
        },
        grid: {
          line: {
            style: {
              stroke: 'rgba(30, 134, 242, 0.1)',
              lineDash: [4, 4],
            },
          },
        },
      },
      meta: {
        value: {
          alias: '热度值',
        },
      },
      areaStyle: () => {
        return {
          fill: `l(270) 0:rgba(255,255,255,0.2) 0.3:${primaryColor}20 0.6:${primaryColor}40 1:${primaryColor}70`,
          fillOpacity: 1,
        };
      },
      line: {
        color: primaryColor,
        size: 2,
      },
      point: {
        size: 3,
        shape: 'circle',
        style: () => {
          return {
            fill: 'white',
            stroke: primaryColor,
            lineWidth: 2,
          };
        },
      },
      tooltip: {
        domStyles: {
          'g2-tooltip': {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            borderRadius: '4px',
            color: 'rgba(0, 0, 0, 0.65)',
          },
          'g2-tooltip-title': {
            color: 'rgba(0, 0, 0, 0.85)',
            fontWeight: 'bold',
          },
          'g2-tooltip-value': {
            color: primaryColor,
            fontWeight: 'bold',
          },
        },
        formatter: (datum) => {
          return { name: '热度值', value: datum.value };
        },
      },
      animation: {
        appear: {
          animation: 'waveIn',
          duration: 1200,
          easing: 'ease-in-out',
        },
      },
    });
    area.render();

    return () => area.destroy();
  }, [data]);

  return data ? (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(30, 134, 242, 0.03), rgba(30, 134, 242, 0.01))',
        borderRadius: 8,
        padding: '0 10px',
        height: 220,
      }}
    />
  ) : null;
};

export default HeatTrendChart;
