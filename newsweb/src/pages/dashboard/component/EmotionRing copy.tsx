import React from 'react';
import { Liquid } from '@antv/g2plot';
import { useEventContext } from '@/contexts/EventContext';

const EmotionRing: React.FC = () => {
  const { selectedEvent } = useEventContext();
  const containerId = React.useId();

  React.useEffect(() => {
    if (!selectedEvent) return;

    const liquidPlot = new Liquid('container', {
      percent: selectedEvent.emotion/100 | 0.5,
      outline: {
        border: 4,
        distance: 8,
      },
      wave: {
        length: 128,
      },
    });
    liquidPlot.render();

    return () => liquidPlot.destroy();
  }, [selectedEvent]);

  return <div id={containerId} style={{ height: 200, width: 200 }} />;
};

export default EmotionRing;