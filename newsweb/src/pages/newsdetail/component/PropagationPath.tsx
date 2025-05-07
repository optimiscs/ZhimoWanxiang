import {
  ApartmentOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
  RiseOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import { Badge, Button, Card, Progress, Space, Tabs, Tag, Tooltip, Typography } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import './style.css';

const { Text, Title } = Typography;
const { TabPane } = Tabs;

interface PropagationData {
  nodes: Array<{
    id: string;
    name: string;
    value: number;
    category: number;
    platform: string;
    isKeyNode: boolean;
  }>;
  links: Array<{
    source: string;
    target: string;
    value: number;
  }>;
  categories: Array<{
    name: string;
  }>;
}

interface PropagationPathProps {
  data?: PropagationData;
  mode?: 'visualization' | 'keyNodes' | 'impact' | 'crossPlatform';
}

// 模拟数据生成
const generateMockData = () => {
  return {
    nodes: [
      { id: 'node1', name: '原始发布', value: 100, category: 0, platform: '微博', isKeyNode: true },
      { id: 'node2', name: '大V转发', value: 85, category: 0, platform: '微博', isKeyNode: true },
      {
        id: 'node3',
        name: '媒体报道',
        value: 70,
        category: 1,
        platform: '新闻网站',
        isKeyNode: true,
      },
      { id: 'node4', name: '社区讨论', value: 60, category: 2, platform: '知乎', isKeyNode: false },
      { id: 'node5', name: '视频内容', value: 75, category: 3, platform: '抖音', isKeyNode: true },
      { id: 'node6', name: '普通用户', value: 40, category: 0, platform: '微博', isKeyNode: false },
      { id: 'node7', name: '粉丝群体', value: 55, category: 0, platform: '微博', isKeyNode: false },
      { id: 'node8', name: '评论区', value: 45, category: 2, platform: '知乎', isKeyNode: false },
      { id: 'node9', name: '热搜条目', value: 80, category: 0, platform: '微博', isKeyNode: true },
      { id: 'node10', name: '短视频', value: 65, category: 3, platform: '抖音', isKeyNode: false },
    ],
    links: [
      { source: 'node1', target: 'node2', value: 5 },
      { source: 'node1', target: 'node6', value: 3 },
      { source: 'node1', target: 'node7', value: 3 },
      { source: 'node2', target: 'node3', value: 4 },
      { source: 'node2', target: 'node9', value: 5 },
      { source: 'node3', target: 'node4', value: 3 },
      { source: 'node3', target: 'node8', value: 3 },
      { source: 'node4', target: 'node8', value: 2 },
      { source: 'node9', target: 'node5', value: 4 },
      { source: 'node5', target: 'node10', value: 3 },
    ],
    categories: [{ name: '微博' }, { name: '新闻网站' }, { name: '知乎' }, { name: '抖音' }],
  };
};

// 传播路径可视化组件
const PropagationPath: React.FC<PropagationPathProps> = ({ data, mode }) => {
  const graphRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [animationPlaying, setAnimationPlaying] = useState(true);

  // 确保有数据可用，如果没有传入完整数据，使用模拟数据
  const safeData = data && data.nodes && data.nodes.length > 0 ? data : generateMockData();

  // 处理缩放功能
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 10, 150));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 10, 50));
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
  };

  const toggleAnimation = () => {
    setAnimationPlaying((prev) => !prev);
  };

  // 初始化图表
  useEffect(() => {
    if (graphRef.current && (!mode || mode === 'visualization')) {
      // 这里仅做展示，实际项目中应通过echarts或其他图表库绘制力导向图
      const graphElement = document.createElement('div');
      graphElement.className = 'mock-graph';
      graphElement.innerHTML = `
        <div class="mock-graph-content" style="transform: scale(${zoomLevel / 100})">
          <div class="mock-node key-node ${animationPlaying ? 'animated' : ''} ${
        selectedNode === 'node1' ? 'selected' : ''
      }"
               style="top: 20%; left: 50%"
               data-id="node1"
               onclick="document.dispatchEvent(new CustomEvent('node-click', {detail: 'node1'}))">
            原始发布
            ${selectedNode === 'node1' ? '<div class="node-details">影响力: 100</div>' : ''}
          </div>
          <div class="mock-node key-node ${animationPlaying ? 'animated' : ''} ${
        selectedNode === 'node2' ? 'selected' : ''
      }"
               style="top: 40%; left: 40%"
               data-id="node2"
               onclick="document.dispatchEvent(new CustomEvent('node-click', {detail: 'node2'}))">
            大V转发
            ${selectedNode === 'node2' ? '<div class="node-details">影响力: 85</div>' : ''}
          </div>
          <div class="mock-node key-node ${animationPlaying ? 'animated' : ''} ${
        selectedNode === 'node3' ? 'selected' : ''
      }"
               style="top: 35%; left: 60%"
               data-id="node3"
               onclick="document.dispatchEvent(new CustomEvent('node-click', {detail: 'node3'}))">
            媒体报道
            ${selectedNode === 'node3' ? '<div class="node-details">影响力: 70</div>' : ''}
          </div>
          <div class="mock-node ${animationPlaying ? 'animated' : ''} ${
        selectedNode === 'node4' ? 'selected' : ''
      }"
               style="top: 55%; left: 30%"
               data-id="node4"
               onclick="document.dispatchEvent(new CustomEvent('node-click', {detail: 'node4'}))">
            社区讨论
            ${selectedNode === 'node4' ? '<div class="node-details">影响力: 60</div>' : ''}
          </div>
          <div class="mock-node key-node ${animationPlaying ? 'animated' : ''} ${
        selectedNode === 'node5' ? 'selected' : ''
      }"
               style="top: 60%; left: 70%"
               data-id="node5"
               onclick="document.dispatchEvent(new CustomEvent('node-click', {detail: 'node5'}))">
            视频内容
            ${selectedNode === 'node5' ? '<div class="node-details">影响力: 75</div>' : ''}
          </div>
          <div class="mock-node ${animationPlaying ? 'animated' : ''} ${
        selectedNode === 'node6' ? 'selected' : ''
      }"
               style="top: 75%; left: 50%"
               data-id="node6"
               onclick="document.dispatchEvent(new CustomEvent('node-click', {detail: 'node6'}))">
            普通用户
            ${selectedNode === 'node6' ? '<div class="node-details">影响力: 40</div>' : ''}
          </div>
          <div class="mock-edge ${
            animationPlaying ? 'animated' : ''
          }" style="top: 30%; left: 45%; width: 100px; transform: rotate(45deg);"></div>
          <div class="mock-edge ${
            animationPlaying ? 'animated' : ''
          }" style="top: 45%; left: 50%; width: 120px; transform: rotate(-30deg);"></div>
          <div class="mock-edge ${
            animationPlaying ? 'animated' : ''
          }" style="top: 50%; left: 35%; width: 80px; transform: rotate(70deg);"></div>
          <div class="mock-edge ${
            animationPlaying ? 'animated' : ''
          }" style="top: 55%; left: 65%; width: 90px; transform: rotate(20deg);"></div>
        </div>
      `;

      graphRef.current.innerHTML = '';
      graphRef.current.appendChild(graphElement);

      // 添加点击事件监听
      document.addEventListener('node-click', ((e: CustomEvent) => {
        setSelectedNode((prev) => (prev === e.detail ? null : e.detail));
      }) as EventListener);

      return () => {
        document.removeEventListener('node-click', ((e: CustomEvent) => {
          setSelectedNode((prev) => (prev === e.detail ? null : e.detail));
        }) as EventListener);
      };
    }
  }, [safeData, mode, selectedNode, zoomLevel, animationPlaying]);

  // 获取关键节点
  const keyNodes = safeData.nodes.filter((node) => node.isKeyNode);

  // 按平台分类节点
  const platformGroups = safeData.nodes.reduce((acc, node) => {
    if (!acc[node.platform]) {
      acc[node.platform] = [];
    }
    acc[node.platform].push(node);
    return acc;
  }, {} as Record<string, typeof safeData.nodes>);

  // 渲染传播路径可视化
  const renderVisualization = () => (
    <div className="visualization-container">
      <div className="visualization-controls">
        <Space>
          <Tooltip title="放大">
            <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} />
          </Tooltip>
          <Tooltip title="缩小">
            <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
          </Tooltip>
          <Tooltip title="重置">
            <Button icon={<ReloadOutlined />} onClick={handleResetZoom} />
          </Tooltip>
          <Tooltip title={animationPlaying ? '暂停动画' : '播放动画'}>
            <Button type={animationPlaying ? 'primary' : 'default'} onClick={toggleAnimation}>
              {animationPlaying ? '暂停' : '播放'}动画
            </Button>
          </Tooltip>
          <div className="zoom-indicator">
            <Progress percent={zoomLevel} showInfo={false} size="small" strokeColor="#1890ff" />
            <Text type="secondary">{zoomLevel}%</Text>
          </div>
        </Space>
      </div>

      <div ref={graphRef} className="propagation-graph" />

      <div className="graph-info">
        {selectedNode && (
          <Card className="node-info-card" size="small">
            <Title level={5}>{safeData.nodes.find((node) => node.id === selectedNode)?.name}</Title>
            <p>影响力值: {safeData.nodes.find((node) => node.id === selectedNode)?.value}</p>
            <p>平台: {safeData.nodes.find((node) => node.id === selectedNode)?.platform}</p>
            <Tag
              color={
                safeData.nodes.find((node) => node.id === selectedNode)?.isKeyNode
                  ? 'blue'
                  : 'default'
              }
            >
              {safeData.nodes.find((node) => node.id === selectedNode)?.isKeyNode
                ? '关键节点'
                : '普通节点'}
            </Tag>
          </Card>
        )}
      </div>

      <div className="graph-legend">
        <div className="legend-item">
          <div className="legend-node key-node"></div>
          <Text>关键节点</Text>
        </div>
        <div className="legend-item">
          <div className="legend-node"></div>
          <Text>普通节点</Text>
        </div>
        <div className="legend-item">
          <div className="legend-edge"></div>
          <Text>传播路径</Text>
        </div>
        <Tooltip title="点击节点可查看详情">
          <InfoCircleOutlined style={{ marginLeft: 16, color: '#1890ff' }} />
        </Tooltip>
      </div>
    </div>
  );

  // 渲染关键节点识别
  const renderKeyNodes = () => (
    <div className="key-nodes-container">
      <div className="key-nodes-header">
        <Title level={5}>识别到 {keyNodes.length} 个关键传播节点</Title>
        <Text type="secondary">
          以下节点对舆情传播起关键作用，建议重点关注
          <Tooltip title="节点影响力根据转发量、互动量和覆盖人群计算得出">
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </Text>
      </div>

      {keyNodes.map((node, index) => (
        <div key={node.id} className="key-node-item" style={{ animationDelay: `${index * 100}ms` }}>
          <Badge.Ribbon text={node.platform} color="blue">
            <Card title={node.name} size="small" variant="outlined">
              <div className="node-info">
                <div className="node-value">
                  <Text>影响力值: </Text>
                  <Text strong style={{ color: '#1890ff' }}>
                    {node.value}
                  </Text>
                  <Progress
                    percent={node.value}
                    size="small"
                    showInfo={false}
                    strokeColor={{
                      '0%': '#108ee9',
                      '100%': '#87d068',
                    }}
                  />
                </div>
                <div className="node-tags">
                  <Tag color="green">关键节点</Tag>
                  <Tag color="blue">{node.platform}</Tag>
                </div>
                <div className="node-actions">
                  <Button type="link" size="small">
                    详情
                  </Button>
                  <Button type="link" size="small" className="highlight-btn">
                    高亮路径
                  </Button>
                </div>
              </div>
            </Card>
          </Badge.Ribbon>
        </div>
      ))}
    </div>
  );

  // 渲染影响力评估
  const renderImpact = () => (
    <div className="impact-container animated-fade-in">
      <div className="impact-metrics">
        <div className="impact-metric">
          <Title level={3}>87%</Title>
          <Text type="secondary">覆盖率</Text>
          <Tooltip title="目标人群中已接触到信息的比例">
            <InfoCircleOutlined style={{ marginLeft: 4, color: '#1890ff' }} />
          </Tooltip>
        </div>
        <div className="impact-metric">
          <Title level={3}>4.2M</Title>
          <Text type="secondary">总曝光</Text>
          <Tooltip title="内容被浏览的总次数">
            <InfoCircleOutlined style={{ marginLeft: 4, color: '#1890ff' }} />
          </Tooltip>
        </div>
        <div className="impact-metric">
          <Title level={3}>6.8K</Title>
          <Text type="secondary">互动量</Text>
          <Tooltip title="点赞、评论、分享等互动总数">
            <InfoCircleOutlined style={{ marginLeft: 4, color: '#1890ff' }} />
          </Tooltip>
        </div>
        <div className="impact-metric">
          <Title level={3}>24h</Title>
          <Text type="secondary">峰值周期</Text>
          <Tooltip title="从开始到达到传播峰值的时间">
            <InfoCircleOutlined style={{ marginLeft: 4, color: '#1890ff' }} />
          </Tooltip>
        </div>
      </div>

      <div className="impact-details">
        <Card className="impact-card" title="传播速度分析" variant="outlined">
          <div className="speed-chart">
            <div className="speed-bar high" style={{ width: '85%' }}>
              <span>首小时增长率</span>
              <span>85%</span>
            </div>
            <div className="speed-bar medium" style={{ width: '65%' }}>
              <span>24小时增长率</span>
              <span>65%</span>
            </div>
            <div className="speed-bar low" style={{ width: '35%' }}>
              <span>48小时增长率</span>
              <span>35%</span>
            </div>
          </div>
          <Text type="secondary" className="chart-description">
            从曲线分析来看，该事件呈现出典型的快速发酵、持续发展的传播特征
          </Text>
        </Card>

        <div className="impact-level">
          <Title level={4}>影响力等级评估</Title>
          <div className="level-indicator">
            <div className="level-bar" style={{ width: '75%' }}></div>
            <div className="level-marker" style={{ left: '75%' }}>
              较高
            </div>
          </div>
          <Text type="secondary" className="level-description">
            该事件影响力评估为<Text strong>较高</Text>级别，建议持续监控并制定应对策略
          </Text>
        </div>
      </div>
    </div>
  );

  // 渲染跨平台追踪
  const renderCrossPlatform = () => (
    <div className="platform-container animated-fade-in">
      <div className="platform-summary">
        <Title level={5}>信息已在 {Object.keys(platformGroups).length} 个平台传播</Title>
        <Text type="secondary">跨平台传播分析可帮助识别信息在不同社交媒体间的流动路径</Text>
      </div>

      {Object.entries(platformGroups).map(([platform, nodes], index) => (
        <div
          key={platform}
          className="platform-group"
          style={{ animationDelay: `${index * 150}ms` }}
        >
          <Title level={5}>
            {platform}
            <Text type="secondary" style={{ marginLeft: 8 }}>
              ({nodes.length}个节点)
            </Text>
            <Progress
              percent={Math.round((nodes.length / safeData.nodes.length) * 100)}
              size="small"
              style={{ marginLeft: 16, width: 100 }}
            />
          </Title>
          <div className="platform-nodes">
            {nodes.map((node) => (
              <Tag
                key={node.id}
                color={node.isKeyNode ? 'blue' : 'default'}
                style={{
                  padding: '4px 8px',
                  margin: '4px',
                  transition: 'all 0.3s',
                  cursor: 'pointer',
                }}
                className="platform-node-tag"
              >
                {node.name}
                {node.isKeyNode && <Badge status="processing" style={{ marginLeft: 5 }} />}
              </Tag>
            ))}
          </div>
          <div className="platform-metrics">
            <Space size="large">
              <Text type="secondary">
                关键节点: <Text strong>{nodes.filter((n) => n.isKeyNode).length}</Text>
              </Text>
              <Text type="secondary">
                平均影响力:{' '}
                <Text strong>
                  {Math.round(nodes.reduce((sum, n) => sum + n.value, 0) / nodes.length)}
                </Text>
              </Text>
            </Space>
          </div>
        </div>
      ))}
    </div>
  );

  // 根据模式选择渲染内容
  if (mode) {
    switch (mode) {
      case 'visualization':
        return renderVisualization();
      case 'keyNodes':
        return renderKeyNodes();
      case 'impact':
        return renderImpact();
      case 'crossPlatform':
        return renderCrossPlatform();
      default:
        return null;
    }
  }

  // 如果没有指定模式，则渲染完整的卡片带Tabs
  return (
    <Card className="propagation-card" variant="outlined">
      <Tabs defaultActiveKey="1">
        <TabPane
          tab={
            <span>
              <NodeIndexOutlined />
              传播路径可视化
            </span>
          }
          key="1"
        >
          {renderVisualization()}
        </TabPane>

        <TabPane
          tab={
            <span>
              <ApartmentOutlined />
              关键节点识别
            </span>
          }
          key="2"
        >
          {renderKeyNodes()}
        </TabPane>

        <TabPane
          tab={
            <span>
              <RiseOutlined />
              影响力评估
            </span>
          }
          key="3"
        >
          {renderImpact()}
        </TabPane>

        <TabPane
          tab={
            <span>
              <GlobalOutlined />
              跨平台追踪
            </span>
          }
          key="4"
        >
          {renderCrossPlatform()}
        </TabPane>
      </Tabs>
    </Card>
  );
};

export default PropagationPath;
