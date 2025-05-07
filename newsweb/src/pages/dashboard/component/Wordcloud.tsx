import { WordCloud } from '@antv/g2plot';
import React, { useEffect, useRef, useState, CSSProperties } from 'react';
import { Card, Button, Tooltip, Flex, Spin, Empty } from 'antd';
import { FullscreenOutlined, FullscreenExitOutlined, CloudOutlined, LoadingOutlined } from '@ant-design/icons';

// 词云组件接收的数据格式
interface WordCloudData {
  word: string;
  weight: number;
}

interface WordCloudComponentProps {
  data: WordCloudData[];
  title?: string;
  loading?: boolean; // 添加加载状态属性
}

const WordCloudComponent: React.FC<WordCloudComponentProps> = ({
  data,
  title = "热门关键词",
  loading = false
}) => {
  const container = useRef<HTMLDivElement>(null);
  const chartRef = useRef<WordCloud | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [animating, setAnimating] = useState<boolean>(false);

  // 切换全屏状态
  const toggleFullscreen = () => {
    setAnimating(true);
    setIsFullscreen(prev => !prev);

    // 添加动画延迟
    setTimeout(() => {
      setAnimating(false);
    }, 300);
  };

  // 渲染词云图表
  const renderChart = () => {
    if (!container.current) return;

    // 使用固定高度而不是动态调整高度
    // 确保容器尺寸自适应
    const parentElement = container.current.parentElement;
    if (parentElement) {
      container.current.style.width = '100%';
      // 不再基于父元素设置高度，避免无限增长问题
    }

    // 创建词云图实例
    const wordCloud = new WordCloud(container.current, {
      data,
      wordField: 'word',
      weightField: 'weight',
      wordStyle: {
        fontFamily: 'Verdana',
        fontSize: [14, 60],
        rotation: [0, 0],
        fontWeight: 'bold'
      },
      padding: 0,
      interactions: [{ type: 'element-active' }],
      theme: {
        styleSheet: {
          brandColor: '#1890ff',
          paletteQualitative10: [
            '#1890ff', '#52c41a', '#2f54eb',
            '#faad14', '#722ed1', '#eb2f96'
          ],
        }
      },
      state: {
        active: {
          style: {
            lineWidth: 3,
            shadowColor: '#1890ff',
            shadowBlur: 10,
            stroke: '#1890ff'
          },
        },
      },
      animation: {
        appear: {
          animation: 'waveIn',
          duration: 1000,
          easing: 'ease-in-out',
        },
      },
      color: ['#1890ff', '#52c41a', '#2f54eb', '#faad14', '#722ed1'],
      autoFit: true,
    });

    // 渲染图表
    wordCloud.render();
    chartRef.current = wordCloud;
  };

  // 监听窗口大小变化，重新渲染图表
  useEffect(() => {
    const handleResize = () => {
      if (container.current && chartRef.current) {
        // WordCloud doesn't have a resize method, so we need to recreate it
        chartRef.current.destroy();
        renderChart();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [data]);

  // 当数据变化时重新渲染图表
  useEffect(() => {
    // 防止没有数据或数据为空
    if (!data || data.length === 0) {
      console.log("词云数据为空，无法渲染");
      return;
    }

    try {
      // 销毁旧图表
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }

      // 渲染新图表
      renderChart();

      // 清理函数
      return () => {
        if (chartRef.current) {
          chartRef.current.destroy();
          chartRef.current = null;
        }
      };
    } catch (error) {
      console.error("词云渲染失败:", error);
    }
  }, [data, isFullscreen]);

  // 当全屏状态改变时重新渲染图表
  useEffect(() => {
    if (chartRef.current) {
      // 需要延迟一下，确保DOM已经更新
      setTimeout(() => {
        chartRef.current?.destroy();
        renderChart();
      }, 100);
    }
  }, [isFullscreen]);

  // 全屏模式的样式
  const fullscreenStyle: CSSProperties = isFullscreen ? {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 1000,
    backgroundColor: '#fff',
    padding: '20px',
    boxSizing: 'border-box',
    overflow: 'hidden'
  } : {};

  // 基本卡片样式
  const cardStyle: CSSProperties = {
    height: '100%',
    borderRadius: '8px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
    background: 'linear-gradient(to bottom, #ffffff, #f9fcff)',
    border: '1px solid #e6f7ff',
    ...(isFullscreen ? fullscreenStyle : {})
  };

  // 渲染加载状态或空状态
  const renderContent = () => {
    if (loading) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
        </div>
      );
    }

    if (!data || data.length === 0) {
      return (
        <Empty
          description="暂无关键词数据"
          style={{ margin: '30px 0' }}
        />
      );
    }

    return (
      <div
        ref={container}
        style={{
          width: '100%',
          height: '300px',
          position: 'relative',
          overflow: 'hidden'
        }}
      />
    );
  };

  return (
    <Card
      style={cardStyle}
      bodyStyle={{
        padding: '16px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CloudOutlined style={{
            color: '#1890ff',
            fontSize: '18px'
          }} />
          <span style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#333333',
            textShadow: '0 1px 2px rgba(24, 144, 255, 0.15)'
          }}>
            {title}
          </span>
        </div>
        <Flex gap="small">
          <Tooltip title={isFullscreen ? '退出全屏' : '全屏查看'}>
            <Button
              type="text"
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={toggleFullscreen}
              size="small"
              style={{
                color: '#1890ff',
                background: 'rgba(24, 144, 255, 0.1)',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s',
                boxShadow: '0 2px 4px rgba(24, 144, 255, 0.1)'
              }}
            />
          </Tooltip>
        </Flex>
      </div>

      <div style={{
        position: 'relative',
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: '8px',
        padding: '12px',
        border: '1px solid #f0f0f0',
        overflow: 'hidden',
        opacity: animating ? 0.5 : 1,
        transition: 'opacity 0.3s ease-in-out'
      }}>
        {renderContent()}
      </div>
    </Card>
  );
};

export default WordCloudComponent;
