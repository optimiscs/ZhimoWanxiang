import { WordCloud } from '@antv/g2plot';
import React, { useEffect, useRef } from 'react';

const WordCloudComponent: React.FC<{
  data: Array<{ value: number; text: string; name: string }>;
}> = ({ data }) => {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (container.current && data.length > 0) {
      const wordCloud = new WordCloud(container.current, {
        data,
        wordField: 'word', // 假设使用 text 字段作为词云的文本
        weightField: 'weight',
        color: 'rgba(30, 134, 242,1)',
        wordStyle: {
          fontFamily: 'Verdana',
          fontSize: [24, 80],
        },
        // 设置交互类型
        interactions: [{ type: 'element-active' }],
        state: {
          active: {
            // 这里可以设置 active 时的样式
            style: {
              lineWidth: 3,
            },
          },
        },
        animation: {
          appear: {
            animation: 'waveIn', // 入场动画类型，这里使用 waveIn 效果
            duration: 10000, // 动画持续时间，单位为毫秒
            easing: 'ease-in-out', // 动画缓动函数
          },
        },
      });

      wordCloud.render();

      return () => {
        // 组件卸载时销毁词云图
        wordCloud.destroy();
      };
    }
  }, [data]);

  return <div ref={container} />;
};

export default WordCloudComponent;
