import { Pie, measureTextWidth } from '@antv/g2plot';
import React from 'react';

function renderStatistic(containerWidth: number, text: string, style: any) {
  const textWidth = measureTextWidth(text, style);
  const textHeight = style.lineHeight || style.fontSize;
  const R = containerWidth / 2;
  let scale = 1;
  if (containerWidth < textWidth) {
    scale = Math.min(
      Math.sqrt(Math.abs(Math.pow(R, 2) / (Math.pow(textWidth / 2, 2) + Math.pow(textHeight, 2)))),
      1,
    );
  }
  const textStyleStr = `width:${containerWidth}px;`;
  return `<div style="${textStyleStr};font-size:${scale}em;line-height:${
    scale < 1 ? 1 : 'inherit'
  };">${text}</div>`;
}

const EmotionRing: React.FC<any> = ({ data }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!containerRef.current) return;

    // 定义主题色和渐变色系
    const primaryColor = 'rgba(30, 134, 242, 1)';
    const colorMap: Record<string, string[]> = {
      正面: ['rgba(30, 134, 242, 0.9)', 'rgba(30, 134, 242, 0.7)'],
      中性: ['rgba(30, 134, 242, 0.6)', 'rgba(30, 134, 242, 0.4)'],
      负面: ['rgba(30, 134, 242, 0.3)', 'rgba(30, 134, 242, 0.1)'],
    };

    const piePlot = new Pie(containerRef.current, {
      appendPadding: 10,
      data,
      angleField: 'value',
      colorField: 'type',
      radius: 1,
      innerRadius: 0.64,
      color: ({ type }) => {
        const colors = colorMap[type] || [primaryColor, 'rgba(30, 134, 242, 0.5)'];
        return `l(45) 0:${colors[0]} 1:${colors[1]}`;
      },
      label: {
        type: 'inner',
        offset: '-50%',
        style: {
          textAlign: 'center',
          fill: '#fff',
          fontWeight: 'bold',
          textShadow: '0 1px 3px rgba(0,0,0,0.3)',
        },
        autoRotate: false,
        content: '{value}',
      },
      statistic: {
        title: {
          offsetY: -4,
          style: {
            color: primaryColor,
            fontWeight: 'bold',
          },
          customHtml: (container, view, datum) => {
            const { width, height } = container.getBoundingClientRect();
            const d = Math.sqrt(Math.pow(width / 2, 2) + Math.pow(height / 2, 2));
            const text = datum ? datum.type : '总计';
            return renderStatistic(d, text, { fontSize: 28 });
          },
        },
        content: {
          offsetY: 4,
          style: {
            fontSize: '32px',
            color: primaryColor,
            fontWeight: 'bold',
          },
          customHtml: (container, view, datum, data = []) => {
            const { width } = container.getBoundingClientRect();
            const text = datum ? `${datum.value}` : `${data.reduce((r, d) => r + d.value, 0)}`;
            return renderStatistic(width, text, { fontSize: 32 });
          },
        },
      },
      legend: {
        position: 'bottom',
        itemName: {
          style: {
            fill: primaryColor,
          },
        },
      },
      interactions: [
        { type: 'element-selected' },
        { type: 'element-active' },
        { type: 'pie-statistic-active' },
      ],
      animation: {
        appear: {
          animation: 'wave-in',
          duration: 1500,
        },
      },
    });

    piePlot.render();

    return () => piePlot.destroy();
  }, [data]);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        height: 220,
        background: 'linear-gradient(135deg, rgba(30, 134, 242, 0.05), rgba(30, 134, 242, 0.01))',
        borderRadius: 8,
        padding: 16,
        boxShadow: 'inset 0 0 10px rgba(30, 134, 242, 0.1)',
      }}
    />
  );
};

export default EmotionRing;
