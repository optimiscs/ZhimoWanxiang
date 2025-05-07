import { useEventContext } from '@/contexts/EventContext';
import { Bullet } from '@antv/g2plot';
import React from 'react';

const BulletChart: React.FC = () => {
  const { selectedEvent } = useEventContext();
  const containerId = React.useId();

  React.useEffect(() => {
    if (!selectedEvent) return;

    const bulletPlot = new Bullet(containerId, {
      data: [
        {
          title: '传播范围',
          measures: selectedEvent.spreadRange * 100,
          targets: [85],
          ranges: [100],
        },
      ],
      measureField: 'measures',
      targetField: 'targets',
      rangeField: 'ranges',
      color: { measure: '#5B8FF9' },
      animation: {
        appear: {
          animation: 'waveIn', // 入场动画类型，这里使用 waveIn 效果
          duration: 1000, // 动画持续时间，单位为毫秒
          easing: 'ease-in-out', // 动画缓动函数
        },
      },
    });

    bulletPlot.render();
    return () => bulletPlot.destroy();
  }, [selectedEvent]);

  return selectedEvent ? <div id={containerId} style={{ height: 120, width: 500 }} /> : null;
};

export default BulletChart;
