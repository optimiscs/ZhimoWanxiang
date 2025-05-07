import { useEventContext } from '@/contexts/EventContext';
import { Liquid } from '@antv/g2plot';
import React from 'react';

const EmotionRing: React.FC = () => {
  const { selectedEvent } = useEventContext();
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!selectedEvent || !containerRef.current) return;
    
    const liquidPlot = new Liquid(containerRef.current, {
      percent: selectedEvent.emotion / 100 || 0.5,
      statistic: {
        content: {
          style: {
            color: '#666', // 灰色
            fontSize: '10', // 字体大小
          }
        }
      },
      wave: {
        length: 128,
      },
      animation: {
        appear: {
            animation: 'waveIn', // 入场动画类型，这里使用 waveIn 效果
            duration: 1000, // 动画持续时间，单位为毫秒
            easing: 'ease-in-out', // 动画缓动函数
        },
    },
    });
    liquidPlot.render();

    return () => liquidPlot.destroy();
  }, [selectedEvent]);

  return <div ref={containerRef}style={{
    height: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // 隐藏溢出内容 
    }} />;
};

export default EmotionRing;