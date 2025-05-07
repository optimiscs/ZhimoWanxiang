import { useEventContext } from '@/contexts/EventContext';
import {
  CaretDownOutlined,
  CaretUpOutlined,
  InfoCircleOutlined,
  ReadOutlined,
  HistoryOutlined,
  SearchOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { Card, Empty, Flex, Progress, Tag, Typography, Button, Timeline, Tooltip, Input, List } from 'antd';
import React, { useState, useEffect } from 'react';
import HeatTrendChart from './HeatTrendChart';

const { Title, Paragraph, Text } = Typography;

// 视图类型枚举
type ViewType = 'summary' | 'timeline';

// 定义事件数据类型
interface EventData {
  title?: string;
  introduction?: string;
  type?: string;
  area?: string;
  rank?: number;
  rank_change?: 'up' | 'down' | 'same' | 'new';
  heat_history?: Array<{
    comprehensive_heat: number;
    normalized_heat: number;
    timestamp: string;
    weighted_heat_value: number;
  }>;
  heatTrend?: Array<{
    date: string;
    value: number;
  }>;
  timeline?: Array<{
    date: string;
    event: string;
  }>;
  spreadRange?: number;
}

const PublicOpinionCard: React.FC = () => {
  const { selectedEvent, setSelectedEvent, allEvents } = useEventContext();
  const [viewType, setViewType] = useState<ViewType>('summary');
  const [searchText, setSearchText] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchExpanded, setSearchExpanded] = useState<boolean>(false);

  // Helper functions
  const getFirstChar = (title: string | undefined): string => {
    return title ? title.charAt(0) : '新';
  };
  const getEventDate = (event: EventData | null): string => {
    // 优先使用heat_history中的第一个时间戳，如果不存在则使用之前的方法
    if (event?.heat_history && event.heat_history.length > 0) {
      // 提取日期部分
      return event.heat_history[0].timestamp.split('T')[0];
    }
    return event?.heatTrend?.[0]?.date || new Date().toISOString().split('T')[0];
  };

  const getEventArea = (event: EventData | null): string => event?.area || event?.type || '未知';

  // 根据rank_change字段或者随机数判断排名是否上升
  const isRankUp = (event: EventData | null): boolean => {
    // 如果有rank_change字段，根据实际数据判断
    if (event?.rank_change) {
      return event.rank_change === 'up'; // 'up'表示排名上升
    }
    // 如果没有，保留之前的随机逻辑作为备选
    const rank = event?.rank || Math.floor(Math.random() * 50) + 1;
    return rank % 2 === 1;
  };

  // 获取影响力指数
  const getImpactScore = (event: EventData | null): number => {
    if (event && event.heat_history && event.heat_history.length > 0) {
      // 获取最新的热度记录
      const latestHeat = event.heat_history[event.heat_history.length - 1];
      // 使用comprehensive_heat乘以100，并限制在0-100之间
      return Math.max(0, Math.min(100, latestHeat.comprehensive_heat * 100));
    } else if (event && typeof event.spreadRange === 'number') {
      // 旧的计算方式作为备选
      return Math.max(0, Math.min(100, event.spreadRange * 100));
    }
    return 50; // 默认值
  };

  // 获取对应的标签索引
  const getImpactTagIndex = (score: number) => {
    if (score >= 75) return 3;
    if (score >= 50) return 2;
    if (score >= 25) return 1;
    return 0;
  };

  const getEventRank = (event: EventData | null): number => event?.rank || Math.floor(Math.random() * 50) + 1;

  // 将heat_history转换为HeatTrendChart可用的格式
  const formatHeatHistoryForChart = (heatHistory: any[]) => {
    if (!heatHistory || !Array.isArray(heatHistory) || heatHistory.length === 0) {
      return [];
    }

    return heatHistory.map(item => ({
      date: item.timestamp.split('T')[0],
      value: item.comprehensive_heat
    }));
  };

  // 切换视图
  const toggleView = () => {
    setViewType(prev => prev === 'summary' ? 'timeline' : 'summary');
  };

  // 处理搜索输入
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);

    if (value.trim()) {
      setIsSearching(true);
      // 过滤出匹配的事件
      const results = allEvents.filter(event =>
        event?.title?.toLowerCase().includes(value.toLowerCase()) ||
        (event?.introduction && event.introduction.toLowerCase().includes(value.toLowerCase())) ||
        (event?.type && event.type.toLowerCase().includes(value.toLowerCase()))
      );
      setSearchResults(results);
    } else {
      setIsSearching(false);
      setSearchResults([]);
    }
  };

  // 处理搜索提交
  const handleSearch = () => {
    if (searchText.trim() && searchResults.length > 0) {
      // 选择第一个匹配的事件
      setSelectedEvent(searchResults[0]);
      setIsSearching(false);
    }
  };

  // 选择搜索结果
  const handleSelectSearchResult = (event: any) => {
    setSelectedEvent(event);
    setSearchText('');
    setIsSearching(false);
    setSearchResults([]);
  };

  // 处理点击搜索框外部
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-container') && isSearching) {
        setIsSearching(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSearching]);

  // 渲染影响力进度条
  const renderImpactProgress = (score: number = 0) => {
    const tagIndex = getImpactTagIndex(score);

    return (
      <div style={{ width: '100%', marginTop: 4 }}>
        <Progress
          percent={score}
          strokeColor={{
            '0%': '#36cfc9',
            '50%': '#1890ff',
            '100%': '#0050b3',
          }}
          showInfo={false}
          trailColor="#f0f0f0"
          strokeWidth={6}
        />
        <Flex justify="space-between" align="center" style={{ marginTop: 2 }}>
          <Text style={{ fontSize: '11px', color: '#666' }}>0</Text>
          <Flex gap={8}>
            <Tag
              color={tagIndex === 0 ? "#e6f7ff" : "#f5f5f5"}
              style={{
                color: tagIndex === 0 ? '#1890ff' : '#595959',
                fontSize: '11px',
                margin: '0 2px',
                fontWeight: tagIndex === 0 ? 'bold' : 'normal',
                boxShadow: tagIndex === 0 ? '0 2px 4px rgba(24, 144, 255, 0.2)' : 'none'
              }}
            >
              一般
            </Tag>
            <Tag
              color={tagIndex === 1 ? "#d9f7be" : "#f5f5f5"}
              style={{
                color: tagIndex === 1 ? '#52c41a' : '#595959',
                fontSize: '11px',
                margin: '0 2px',
                fontWeight: tagIndex === 1 ? 'bold' : 'normal',
                boxShadow: tagIndex === 1 ? '0 2px 4px rgba(82, 196, 26, 0.2)' : 'none'
              }}
            >
              较大
            </Tag>
            <Tag
              color={tagIndex === 2 ? "#fff1f0" : "#f5f5f5"}
              style={{
                color: tagIndex === 2 ? '#f5222d' : '#595959',
                fontSize: '11px',
                margin: '0 2px',
                fontWeight: tagIndex === 2 ? 'bold' : 'normal',
                boxShadow: tagIndex === 2 ? '0 2px 4px rgba(245, 34, 45, 0.2)' : 'none'
              }}
            >
              重大
            </Tag>
            <Tag
              color={tagIndex === 3 ? "#fff0f6" : "#f5f5f5"}
              style={{
                color: tagIndex === 3 ? '#eb2f96' : '#595959',
                fontSize: '11px',
                margin: '0 2px',
                fontWeight: tagIndex === 3 ? 'bold' : 'normal',
                boxShadow: tagIndex === 3 ? '0 2px 4px rgba(235, 47, 150, 0.2)' : 'none'
              }}
            >
              特大
            </Tag>
          </Flex>
          <Text style={{ fontSize: '11px', color: '#666' }}>100</Text>
        </Flex>
      </div>
    );
  };

  // 渲染事件摘要内容
  const renderSummaryContent = () => (
    <>
      <Paragraph
        style={{
          margin: '12px 0',
          lineHeight: 1.5,
          color: '#333',
          fontSize: '13px',
          minHeight: '75px',
          overflow: 'hidden',
        }}
        ellipsis={{
          rows: 4,
          expandable: true,
          symbol: <Text style={{ fontSize: '12px', color: '#1890ff' }}>展开</Text>
        }}
      >
        {selectedEvent?.introduction}
      </Paragraph>

      <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
        <Flex align="center">
          <InfoCircleOutlined style={{ marginRight: 6, color: '#666', fontSize: '12px' }} />
          <Text style={{ fontSize: '12px', color: '#666' }}>事件热度</Text>
        </Flex>
        <Flex align="center">
          <Text style={{ fontSize: '12px', color: '#666' }}>舆论场实时排名</Text>
          <InfoCircleOutlined style={{ marginLeft: 6, color: '#666', fontSize: '12px' }} />
        </Flex>
      </Flex>

      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <div style={{ width: '40%' }}>
          <HeatTrendChart/>
        </div>
        <Flex align="center">
          <div
            style={{
              fontSize: '20px',
              fontWeight: 'bold',
              marginRight: 8,
              color: '#333',
            }}
          >
            第{getEventRank(selectedEvent)}名
          </div>
          {isRankUp(selectedEvent) ? (
            <CaretUpOutlined style={{ color: '#f5222d', fontSize: 18 }} />
          ) : (
            <CaretDownOutlined style={{ color: '#52c41a', fontSize: 18 }} />
          )}
        </Flex>
      </Flex>

      <Flex align="center" style={{ marginBottom: 4 }}>
        <InfoCircleOutlined style={{ marginRight: 6, color: '#666', fontSize: '12px' }} />
        <Text style={{ fontSize: '12px', color: '#666' }}>事件影响力指数</Text>
      </Flex>

      <Flex align="center" gap={12}>
        <div
          style={{
            width: 80,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <Text
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#000000',
              background: '#000000',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            {getImpactScore(selectedEvent).toFixed(1)}
          </Text>

        </div>
        {renderImpactProgress(getImpactScore(selectedEvent))}
      </Flex>
    </>
  );

  // 渲染事件时间线内容
  const renderTimelineContent = () => {
    const timelineData = selectedEvent?.timeline || [];

    if (!timelineData || timelineData.length === 0) {
      return (
        <Empty
          description="暂无事件时间线数据"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ margin: '30px 0' }}
        />
      );
    }

    return (
      <div style={{ padding: '10px 0' }}>
        <Flex align="center" style={{ marginBottom: 12 }}>
          <HistoryOutlined style={{ marginRight: 8, color: '#1890ff' }} />
          <Text strong style={{ fontSize: '14px' }}>事件发展时间线</Text>
        </Flex>

        <Timeline
          style={{ padding: '0 8px', maxHeight: '280px', overflowY: 'auto' }}
          items={timelineData.map((item: any, index: number) => ({
            color: index === 0 ? 'red' : index === timelineData.length - 1 ? 'green' : 'blue',
            children: (
              <div style={{ padding: '0 0 14px' }}>
                <Text strong style={{ fontSize: '13px', display: 'block', marginBottom: '2px' }}>
                  {item.date}
                </Text>
                <Text style={{ fontSize: '12px', color: '#666' }}>
                  {item.event}
                </Text>
              </div>
            )
          }))}
        />
      </div>
    );
  };

  // 渲染搜索结果
  const renderSearchResults = () => {
    if (searchResults.length === 0) {
      return (
        <Empty
          description="未找到匹配事件"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ margin: '10px 0' }}
        />
      );
    }

    return (
      <List
        size="small"
        dataSource={searchResults}
        renderItem={(item) => (
          <List.Item
            onClick={() => handleSelectSearchResult(item)}
            style={{
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: '4px',
              transition: 'all 0.3s'
            }}
            className="search-result-item"
          >
            <Flex align="center" style={{ width: '100%' }}>
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1890ff 0%, #0050b3 100%)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: '#fff',
                fontSize: 12,
                marginRight: 8
              }}>
                {getFirstChar(item.title)}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <Text ellipsis style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.title}</Text>
                <Text type="secondary" ellipsis style={{ fontSize: '11px' }}>{item.type || '未分类'}</Text>
              </div>
            </Flex>
          </List.Item>
        )}
        style={{
          maxHeight: '300px',
          overflowY: 'auto'
        }}
      />
    );
  };

  const renderEventDetails = () => (
    <div>
      {/* 事件信息面板 */}
      <Flex justify="space-between" align="center" style={{ marginBottom: 10 }}>
        <Flex align="flex-start">
          <div style={{ position: 'relative', marginRight: 12, flexShrink: 0 }}>
            <Card
              style={{
                width: 46,
                height: 46,
                background: 'linear-gradient(135deg, #1890ff 0%, #0050b3 100%)',
                padding: 0,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: '#fff',
                fontSize: 18,
                fontWeight: 'bold',
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 2px 8px rgba(24, 144, 255, 0.2)'
              }}
              bodyStyle={{ padding: 0 }}
            >
              {getFirstChar(selectedEvent?.title)}
            </Card>
            <div style={{
              position: 'absolute',
              bottom: -3,
              right: -3,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: '#f5f5f5',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              zIndex: 2
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#52c41a' }} />
            </div>
          </div>
          <div>
            <Title level={5} style={{
              margin: 0,
              fontSize: '14px',
              lineHeight: '1.3',
              color: '#262626',
              fontWeight: 600,
              textShadow: '0 0.5px 0 rgba(0,0,0,0.05)'
            }}>
              {selectedEvent?.title}
            </Title>
            <Flex align="center" style={{ marginTop: 3 }}>
              <Text style={{ fontSize: '12px', color: '#8c8c8c' }}>{getEventDate(selectedEvent)}</Text>
              <Tag
                color="#f6ffed"
                style={{
                  fontSize: '11px',
                  background: '#f6ffed',
                  color: '#52c41a',
                  borderColor: '#b7eb8f',
                  marginLeft: 6,
                  padding: '0 6px',
                  borderRadius: '10px',
                  lineHeight: '14px',
                  height: '18px'
                }}
              >
                {getEventArea(selectedEvent)}
              </Tag>
            </Flex>
          </div>
        </Flex>
        <Tooltip title={viewType === 'summary' ? '查看事件时间线' : '查看事件摘要'}>
          <Button
            type="text"
            icon={viewType === 'summary' ? <HistoryOutlined /> : <ReadOutlined />}
            onClick={toggleView}
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

      {/* 内容区域 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {viewType === 'summary'
          ? renderSummaryContent()
          : renderTimelineContent()}
      </div>
    </div>
  );

  if (!selectedEvent) {
    return (
      <div style={{ height: '100%', padding: '14px' }}>
        <Empty
          description={<Text style={{ color: '#666' }}>点击地图查看事件详情</Text>}
          imageStyle={{ height: 150, opacity: 0.7 }}
        />
      </div>
    );
  }

  return (
    <Card
      style={{
        height: '100%',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
        background: 'linear-gradient(to bottom, #ffffff, #f9fcff)',
        border: '1px solid #e6f7ff'
      }}
      bodyStyle={{
        padding: '14px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '14px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <RobotOutlined style={{
            color: '#1890ff',
            fontSize: '18px'
          }} />
          <span style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#333333'
          }}>
            舆情监测分析
          </span>
        </div>
        <div className="search-container" style={{ position: 'relative' }}>
          {searchExpanded ? (
            <Input
              placeholder="搜索事件"
              prefix={<SearchOutlined style={{ color: '#1890ff' }} />}
              value={searchText}
              onChange={handleSearchChange}
              onPressEnter={handleSearch}
              style={{
                width: '150px',
                borderRadius: '20px',
                boxShadow: '0 2px 4px rgba(24, 144, 255, 0.1)',
                border: '1px solid #d9d9d9',
                transition: 'all 0.3s'
              }}
              onFocus={() => setIsSearching(true)}
              onBlur={() => {
                if (searchText.trim() === '') {
                  setTimeout(() => {
                    setSearchExpanded(false);
                    setIsSearching(false);
                  }, 200);
                }
              }}
              autoFocus
              allowClear
            />
          ) : (
            <Button
              type="text"
              icon={<SearchOutlined style={{ fontSize: '16px' }} />}
              onClick={() => setSearchExpanded(true)}
              style={{
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1890ff',
                transition: 'all 0.3s',
                boxShadow: '0 2px 4px rgba(24, 144, 255, 0.1)',
              }}
            />
          )}

          {isSearching && searchText.trim() !== '' && (
            <Card
              style={{
                position: 'absolute',
                top: '40px',
                right: 0,
                width: '320px',
                zIndex: 1000,
                padding: 0,
                boxShadow: '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 14px 0 rgba(0, 0, 0, 0.08)',
                borderRadius: '8px'
              }}
              bodyStyle={{ padding: '8px' }}
            >
              {renderSearchResults()}
            </Card>
          )}
        </div>
      </div>

      <div style={{
        position: 'relative',
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: '8px',
        padding: '14px',
        border: '1px solid #f0f0f0',
        overflow: 'auto'
      }}>
        {renderEventDetails()}
      </div>
    </Card>
  );
};

export default PublicOpinionCard;
