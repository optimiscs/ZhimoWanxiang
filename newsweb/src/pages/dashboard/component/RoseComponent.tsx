import { Radar } from '@ant-design/plots';
import React, { useEffect, useRef, useState } from 'react';
import { Card, Flex, Typography, Button, Tooltip, Empty, Tag, Spin, Space } from 'antd';
import { AreaChartOutlined, FileTextOutlined, HeartOutlined, FlagOutlined, LoadingOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

// 雷达图组件接收的数据格式
interface RoseData {
  type: string;
  value: number;
}

// 扩展组件接口，接收情感和立场数据
interface RoseComponentProps {
  data?: RoseData[];
  stanceData?: RoseData[];
  emotion?: {
    schema?: {
      [key: string]: number;
    };
    rationale?: string;
  } | number;
  stance?: {
    schema?: {
      [key: string]: number;
    };
    rationale?: string;
  };
  title?: string; // 组件标题，默认为"情感立场分析"
  loading?: boolean; // 添加加载状态属性
}

// 视图类型枚举
type ViewType = 'chart' | 'analysis';
// 标签类型枚举
type TabType = 'emotion' | 'stance';

const RoseComponent: React.FC<RoseComponentProps> = ({
  data = [],
  stanceData = [],
  emotion,
  stance,
  title = "情感立场分析",
  loading = false
}) => {
  const container = useRef<HTMLDivElement>(null);
  // 使用随机key强制组件重新渲染
  const [chartKey, setChartKey] = useState<number>(Date.now());
  // 监控容器尺寸变化
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  // 视图切换状态
  const [viewType, setViewType] = useState<ViewType>('chart');
  // 分析视图中的活动标签
  const [activeTab, setActiveTab] = useState<TabType>('emotion');
  // 添加动画状态
  const [animating, setAnimating] = useState(false);
  // 存储转换后的情感和立场数据
  const [emotionData, setEmotionData] = useState<RoseData[]>([]);
  const [stanceChartData, setStanceChartData] = useState<RoseData[]>([]);



  // 提取emotion和stance的rationale
  const emotionRationale = typeof emotion === 'object' && emotion ? emotion.rationale : undefined;
  const stanceRationale = stance?.rationale;

  // 将emotion和stance的schema转换为组件需要的数据格式
  useEffect(() => {
    // 打印转换前的数据


    // 将schema直接转换为RoseData[]格式
    if (typeof emotion === 'object' && emotion?.schema) {
      const formattedData = Object.entries(emotion.schema).map(([type, value]) => ({
        type,
        value: value / 100 // 转换为0-1之间的数值
      }));

      setEmotionData(formattedData);
    }

    if (stance?.schema) {
      const formattedData = Object.entries(stance.schema).map(([type, value]) => ({
        type,
        value: value / 100 // 转换为0-1之间的数值
      }));

      setStanceChartData(formattedData);
    }

  }, [emotion, stance]);

  // 切换视图类型
  const toggleViewType = () => {
    setAnimating(true);
    setViewType(prev => prev === 'chart' ? 'analysis' : 'chart');

    // 添加动画延迟
    setTimeout(() => {
      setAnimating(false);
    }, 300);
  };

  // 切换分析标签
  const toggleTab = (tab: TabType) => {
    setAnimating(true);
    setActiveTab(tab);

    // 添加动画延迟
    setTimeout(() => {
      setAnimating(false);
    }, 300);
  };

  // 监听数据变化并强制重新渲染图表
  useEffect(() => {
    // 当数据变化时，生成新的key以强制图表重新渲染
    setChartKey(Date.now());
  }, [data, stanceData, emotionData, stanceChartData]);

  // 监听容器尺寸变化并触发重新渲染
  useEffect(() => {
    if (!container.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // 只有当尺寸发生实际变化时才更新状态
        if (containerSize.width !== width || containerSize.height !== height) {
          setContainerSize({ width, height });
          // 重置key以强制组件重新渲染
          setChartKey(Date.now());
        }
      }
    });

    resizeObserver.observe(container.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerSize]);

  // 当容器尺寸变化时自动调整图表大小
  useEffect(() => {
    const handleResize = () => {
      // 窗口大小变化时也强制图表重新渲染
      setChartKey(Date.now());
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 将情感和立场数据转换为雷达图格式
  const getRadarData = () => {
    // 优先使用转换后的数据，如果没有则使用props中直接传入的数据
    const useEmotionData = emotionData.length > 0 ? emotionData : data;
    const useStanceData = stanceChartData.length > 0 ? stanceChartData : stanceData;



    // 定义8对交替的数据项
    const emotionItems = ['喜悦', '期待', '平和', '惊讶', '恐惧', '悲伤', '厌恶', '愤怒'];
    const stanceItems = ['积极倡导', '中立陈述', '理性建议', '观望等待', '质疑探究', '情绪宣泄', '强烈反对', '扩散传播'];

    // 转换情感数据
    const emotionChartData = emotionItems.map(item => {
      // 查找对应类型的数据
      const found = useEmotionData?.find(d => d.type === item);
      return {
        item: item,
        type: '情感',
        score: found ? found.value*100 : 0, // 直接使用value，没有则为0
      };
    });

    // 转换立场数据
    const stanceChartResult = stanceItems.map(item => {
      // 查找对应类型的数据
      const found = useStanceData?.find(d => d.type === item);
      return {
        item: item,
        type: '立场',
        score: found ? found.value*100: 0, // 直接使用value，没有则为0
      };
    });

    // 按照交替顺序合并数据
    const result: Array<{item: string; type: string; score: number}> = [];
    for (let i = 0; i < 8; i++) {
      // 交替添加情感和立场数据
      result.push(emotionChartData[i]);
      result.push(stanceChartResult[i]);
    }


    return result;
  };

  // 渲染雷达图视图
  const renderChartView = () => {
    // 如果正在加载，显示加载状态
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

    // 雷达图数据为空时显示
    const hasEmotionData = emotionData.length > 0 || data.length > 0;
    const hasStanceData = stanceChartData.length > 0 || stanceData.length > 0;

    if (!hasEmotionData && !hasStanceData) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            minHeight: '180px',
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: '#999',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px'
          }}
        >
          暂无数据显示
        </div>
      );
    }

    // 使用简化的雷达图配置，避免高级配置项引起兼容性问题
    const config = {
      data: getRadarData(),
      xField: 'item',
      yField: 'score',
      colorField: 'type',
      // 设置渐变色系
      color: ['#1890ff', '#52c41a'],
      scale: {
        score: {
          min: 0,
          max: 10,
        },
      },
      area: {
        style: {
          fillOpacity: 0.2,
        },
      },
      // 添加浅色主题
      theme: {
        styleSheet: {
          backgroundColor: '#ffffff',
        }
      },
      animation: {
        appear: {
          animation: 'waveIn',
          duration: 500,
          easing: 'ease-in-out',
        },
      },
      legend: {
        position: 'bottom',
        itemHeight: 5,
        itemWidth: 10,
        marker: {
          symbol: 'circle',
        },
        itemName: {
          style: {
            fill: '#333',
            fontSize: 10,
          }
        },
      },
      // 添加深色坐标轴
      axis: {
        x: {
          grid: true,
          line: {
            style: {
              stroke: 'rgba(0, 0, 0, 0.15)',
            }
          },
          label: {
            style: {
              fill: '#333',
              fontSize: 9,
            }
          }
        },
        y: {
          grid: {
            line: {
              style: {
                stroke: 'rgba(0, 0, 0, 0.1)',
              }
            }
          },
          label: {
            style: {
              fill: '#333',
              fontSize: 9,
            }
          }
        }
      },
      // 线条样式
      style: {
        lineWidth: 2,
      },
      autoFit: true,
    };

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden'
        }}
      >
        {/* 使用key强制组件在数据或尺寸变化时重新渲染 */}
        <Radar
          key={chartKey}
          {...config}
          style={{ fontSize: '10px' }}
        />
      </div>
    );
  };

  // 渲染分析视图
  const renderAnalysisView = () => {
    // 如果正在加载，显示加载状态
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

    // 获取当前显示的分析数据
    const rationale = activeTab === 'emotion' ? emotionRationale : stanceRationale;
    const currentData = activeTab === 'emotion'
      ? (emotionData.length > 0 ? emotionData : data)
      : (stanceChartData.length > 0 ? stanceChartData : stanceData);

    // 没有数据时显示空状态
    if (!currentData || currentData.length === 0) {
      return (
        <Empty
          description={`暂无${activeTab === 'emotion' ? '情感' : '立场'}数据`}
          style={{ margin: '30px 0' }}
        />
      );
    }

    // 获取最大值项以突出显示
    const maxItem = currentData.reduce(
      (max, item) => (item.value > max.value ? item : max),
      currentData[0]
    );

    // 计算标签颜色
    const getTagColor = (item: RoseData, isActive: boolean) => {
      if (activeTab === 'emotion') {
        if (isActive) return 'linear-gradient(135deg, #1890ff 0%, #69c0ff 100%)';

        // 根据百分比生成不同深浅的蓝色
        const percentage = item.value * 100;
        if (percentage > 15) return 'linear-gradient(135deg, #69c0ff 0%, #91d5ff 100%)';
        if (percentage > 10) return 'linear-gradient(135deg, #91d5ff 0%, #bae7ff 100%)';
        return 'linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%)';
      } else {
        if (isActive) return 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)';

        // 根据百分比生成不同深浅的绿色
        const percentage = item.value * 100;
        if (percentage > 15) return 'linear-gradient(135deg, #95de64 0%, #b7eb8f 100%)';
        if (percentage > 10) return 'linear-gradient(135deg, #b7eb8f 0%, #d9f7be 100%)';
        return 'linear-gradient(135deg, #f6ffed 0%, #fcffe6 100%)';
      }
    };

    return (
      <div
        className="rose-analysis-view"
        style={{
          height: '100%',
          overflow: 'auto',
          padding: '4px 0 0',
          opacity: animating ? 0.5 : 1,
          transition: 'opacity 0.3s ease-in-out'
        }}
      >
        {/* 切换按钮组 - 更紧凑的设计 */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '8px'
        }}>
          <Space size={4}>
            <Button
              type={activeTab === 'emotion' ? 'primary' : 'text'}
              icon={<HeartOutlined />}
              onClick={() => toggleTab('emotion')}
              size="small"
              style={{
                borderRadius: '12px',
                boxShadow: activeTab === 'emotion' ? '0 2px 4px rgba(24, 144, 255, 0.2)' : 'none',
                transition: 'all 0.3s ease',
                padding: '0 10px',
                background: activeTab === 'emotion' ? 'linear-gradient(135deg, #1890ff 0%, #69c0ff 100%)' : undefined,
                border: activeTab === 'emotion' ? 'none' : undefined
              }}
            >
              情感
            </Button>
            <Button
              type={activeTab === 'stance' ? 'primary' : 'text'}
              icon={<FlagOutlined />}
              onClick={() => toggleTab('stance')}
              size="small"
              style={{
                borderRadius: '12px',
                boxShadow: activeTab === 'stance' ? '0 2px 4px rgba(82, 196, 26, 0.2)' : 'none',
                transition: 'all 0.3s ease',
                padding: '0 10px',
                background: activeTab === 'stance' ? 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)' : undefined,
                border: activeTab === 'stance' ? 'none' : undefined
              }}
            >
              立场
            </Button>
          </Space>
        </div>

        {/* 分析内容 - 更紧凑的版本 */}
        <div
          style={{
            padding: '0 12px',
            opacity: animating ? 0.5 : 1,
            transition: 'opacity 0.3s ease-in-out',
            height: 'calc(100% - 32px)',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          {/* 主要类型突出显示 - 采用带图标的设计 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: activeTab === 'emotion' ? 'linear-gradient(135deg, rgba(24, 144, 255, 0.08) 0%, rgba(105, 192, 255, 0.08) 100%)' : 'rgba(82, 196, 26, 0.08)',
            padding: '6px 10px',
            borderRadius: '6px',
            marginBottom: '4px',
            boxShadow: `0 1px 2px rgba(${activeTab === 'emotion' ? '24, 144, 255' : '82, 196, 26'}, 0.15)`
          }}>
            {activeTab === 'emotion' ?
              <HeartOutlined style={{ color: '#1890ff', marginRight: '6px' }} /> :
              <FlagOutlined style={{ color: '#52c41a', marginRight: '6px' }} />
            }
            <Text strong style={{ marginRight: '6px', fontSize: '13px' }}>
              主要{activeTab === 'emotion' ? '情感' : '立场'}:
            </Text>
            <Tag
              color={activeTab === 'emotion' ? 'blue' : 'green'}
              style={{
                margin: 0,
                fontWeight: 'bold',
                fontSize: '13px',
                background: activeTab === 'emotion' ? 'linear-gradient(135deg, #1890ff 0%, #69c0ff 100%)' : undefined,
                border: activeTab === 'emotion' ? 'none' : undefined
              }}
            >
              {maxItem.type} ({(maxItem.value * 100).toFixed(1)}%)
            </Tag>
          </div>

          {/* 所有类型列表 - 使用更紧凑的布局 */}
          <div>
            <Text strong style={{ fontSize: '13px', display: 'inline-block', marginBottom: '4px' }}>
              全部分布:
            </Text>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
              maxHeight: '100px',
              overflowY: 'auto',
              padding: '4px',
              background: 'rgba(0, 0, 0, 0.02)',
              borderRadius: '4px'
            }}>
              {[...currentData]
                .sort((a, b) => b.value - a.value) // 按照数值从大到小排序
                .map((item) => (
                <Tag
                  key={item.type}
                  style={{
                    margin: 0,
                    fontSize: '11px',
                    padding: '0 4px',
                    lineHeight: '18px',
                    transition: 'all 0.3s ease',
                    color: item.value * 100 <= 10 ? 'rgba(0, 0, 0, 0.65)' : undefined,
                    background: getTagColor(item, item === maxItem),
                    border: 'none'
                  }}
                >
                  {item.type}: {(item.value * 100).toFixed(1)}%
                </Tag>
              ))}
            </div>
          </div>

          {/* 分析文本 - 更紧凑和美观的设计 */}
          {rationale && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Text strong style={{ fontSize: '13px', marginBottom: '4px' }}>
                分析解释:
              </Text>
              <div
                style={{
                  padding: '8px 10px',
                  background: activeTab === 'emotion' ? 'linear-gradient(135deg, rgba(24, 144, 255, 0.04) 0%, rgba(105, 192, 255, 0.04) 100%)' : 'rgba(82, 196, 26, 0.04)',
                  borderRadius: '6px',
                  border: `1px solid ${activeTab === 'emotion' ? 'rgba(24, 144, 255, 0.15)' : 'rgba(82, 196, 26, 0.15)'}`,
                  position: 'relative'
                }}
              >
                <Paragraph
                  style={{
                    fontSize: '12px',
                    lineHeight: '1.6',
                    margin: 0,
                    color: 'rgba(0, 0, 0, 0.85)'
                  }}
                >
                  {rationale}
                </Paragraph>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 最终渲染组件
  return (
    <div ref={container} style={{ height: '415px', width: '100%' }}>
      <Card
        bordered={false}
        style={{
          height: '100%',
          width: '100%',
          borderRadius: '8px',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
          background: 'linear-gradient(to bottom, #ffffff, #f9fcff)'
        }}
        bodyStyle={{
          height: 'calc(100% - 42px)',  // 减去卡片头部的高度
          padding: '12px',
          overflow: 'hidden'
        }}
        title={
          <Flex justify="space-between" align="center">
            <Flex align="center" gap="small">
              {activeTab === 'emotion' ?
                <HeartOutlined style={{ color: '#1890ff' }} /> :
                <FlagOutlined style={{ color: '#52c41a' }} />
              }
              <Text style={{ fontSize: '16px' }}>{title}</Text>
            </Flex>
            <Tooltip title={viewType === 'chart' ? "查看文本分析" : "查看图表"}>
              <Button
                type="text"
                icon={viewType === 'chart' ? <FileTextOutlined /> : <AreaChartOutlined />}
                onClick={toggleViewType}
                size="small"
                style={{
                  color: viewType === 'chart' ?
                    (activeTab === 'emotion' ? '#1890ff' : '#52c41a') :
                    (activeTab === 'emotion' ? '#1890ff' : '#52c41a'),
                  background: viewType === 'chart' ?
                    (activeTab === 'emotion' ? 'rgba(24, 144, 255, 0.1)' : 'rgba(82, 196, 26, 0.1)') :
                    (activeTab === 'emotion' ? 'linear-gradient(135deg, rgba(24, 144, 255, 0.1) 0%, rgba(105, 192, 255, 0.1) 100%)' : 'linear-gradient(135deg, rgba(82, 196, 26, 0.1) 0%, rgba(149, 222, 100, 0.1) 100%)'),
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                  boxShadow: viewType === 'chart' ?
                    (activeTab === 'emotion' ? '0 2px 4px rgba(24, 144, 255, 0.1)' : '0 2px 4px rgba(82, 196, 26, 0.1)') :
                    (activeTab === 'emotion' ? '0 2px 4px rgba(24, 144, 255, 0.1)' : '0 2px 4px rgba(82, 196, 26, 0.1)')
                }}
              />
            </Tooltip>
          </Flex>
        }
      >
        <div style={{
          opacity: animating ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out',
          height: '100%'
        }}>
          {viewType === 'chart' ? renderChartView() : renderAnalysisView()}
        </div>
      </Card>
    </div>
  );
};

export default RoseComponent;

