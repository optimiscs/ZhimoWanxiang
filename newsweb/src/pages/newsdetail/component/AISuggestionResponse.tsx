import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FireOutlined,
  InboxOutlined,
  LeftOutlined,
  LineChartOutlined,
  RightOutlined,
  RobotOutlined,
  StarOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Avatar, Badge, Button, Progress, Space, Tag, Tooltip, Typography } from 'antd';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import './style.css';

const { Title, Text, Paragraph } = Typography;

export interface PRSuggestion {
  title: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
}

interface AISuggestionResponseProps {
  prSuggestions: PRSuggestion[];
  onAccept?: () => void;
  onReject?: () => void;
}

const AISuggestionResponse: React.FC<AISuggestionResponseProps> = ({
  prSuggestions,
  onAccept,
  onReject,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [implementationProgress, setImplementationProgress] = useState<{ [key: number]: number }>(
    {},
  );
  const [showImplementationInfo, setShowImplementationInfo] = useState<{ [key: number]: boolean }>(
    {},
  );
  const [direction, setDirection] = useState(0); // -1 for left, 1 for right, 0 for initial

  // 初始化进度数据
  useEffect(() => {
    const initialImplementationProgress = prSuggestions.reduce((acc, _, index) => {
      acc[index] = Math.floor(Math.random() * 80); // 随机生成0-80的进度
      return acc;
    }, {} as { [key: number]: number });

    const initialImplementationInfo = prSuggestions.reduce((acc, _, index) => {
      acc[index] = false;
      return acc;
    }, {} as { [key: number]: boolean });

    setImplementationProgress(initialImplementationProgress);
    setShowImplementationInfo(initialImplementationInfo);
  }, [prSuggestions]);

  // Map priority to color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#f5222d';
      case 'medium':
        return '#faad14';
      case 'low':
        return '#52c41a';
      default:
        return '#1890ff';
    }
  };

  // Map priority to text
  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high':
        return '高优先级';
      case 'medium':
        return '中优先级';
      case 'low':
        return '低优先级';
      default:
        return '一般';
    }
  };

  // Map priority to icon
  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      case 'medium':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'low':
        return <LineChartOutlined style={{ color: '#1890ff' }} />;
      default:
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    }
  };

  // 处理卡片切换 - 使用Framer Motion重构
  const handleCardChange = (index: number) => {
    if (index === activeIndex || index < 0 || index >= prSuggestions.length) return;

    // 确定切换方向
    setDirection(index > activeIndex ? 1 : -1);
    setActiveIndex(index);
  };

  // 显示/隐藏实施细节
  const toggleImplementationInfo = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setShowImplementationInfo((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // 获取下一个和上一个索引
  const getNextIndex = () => (activeIndex + 1) % prSuggestions.length;
  const getPrevIndex = () => (activeIndex - 1 + prSuggestions.length) % prSuggestions.length;

  // 获取优先级对应的动态背景
  const getPriorityBackground = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'linear-gradient(135deg, rgba(245, 34, 45, 0.05) 0%, rgba(245, 34, 45, 0.15) 100%)';
      case 'medium':
        return 'linear-gradient(135deg, rgba(250, 173, 20, 0.05) 0%, rgba(250, 173, 20, 0.15) 100%)';
      case 'low':
        return 'linear-gradient(135deg, rgba(82, 196, 26, 0.05) 0%, rgba(82, 196, 26, 0.15) 100%)';
      default:
        return 'linear-gradient(135deg, rgba(24, 144, 255, 0.05) 0%, rgba(24, 144, 255, 0.15) 100%)';
    }
  };

  if (!prSuggestions || prSuggestions.length === 0) {
    return (
      <div className="card-stack-empty">
        <div className="card-stack-empty-icon">
          <InboxOutlined />
        </div>
        <Text>暂无AI建议响应数据</Text>
      </div>
    );
  }

  // 获取每个建议的执行紧急性和难度评估
  const getUrgencyAndDifficulty = (priority: string, index: number) => {
    const base = index % 3;

    switch (priority) {
      case 'high':
        return { urgency: 4 + base, difficulty: 3 + (base % 2) };
      case 'medium':
        return { urgency: 3 + (base % 2), difficulty: 2 + base };
      case 'low':
        return { urgency: 2 + (base % 2), difficulty: 1 + (base % 3) };
      default:
        return { urgency: 3, difficulty: 3 };
    }
  };

  // 定义动画变体
  const cardVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 30,
      },
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -300 : 300,
      opacity: 0,
      scale: 0.9,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 30,
      },
    }),
  };

  // 渲染当前卡片内容
  const renderCardContent = (item: PRSuggestion, index: number) => {
    const { urgency, difficulty } = getUrgencyAndDifficulty(item.priority, index);

    return (
      <div
        className={`card-motion-content ${item.priority}`}
        style={{ background: getPriorityBackground(item.priority) }}
      >
        {/* 优先级装饰条 */}
        <div className={`priority-indicator ${item.priority}`}></div>

        <div className="card-content">
          <div className="card-header">
            <div className="card-header-left">
              <Badge count={index + 1} style={{ backgroundColor: getPriorityColor(item.priority) }}>
                <Avatar
                  icon={getPriorityIcon(item.priority)}
                  style={{
                    background: 'white',
                    boxShadow: `0 2px 6px rgba(0, 0, 0, 0.1)`,
                    border: `1px solid ${getPriorityColor(item.priority)}30`,
                  }}
                />
              </Badge>
              <Tag
                color={getPriorityColor(item.priority)}
                style={{ borderRadius: '10px', marginLeft: 8 }}
              >
                {getPriorityText(item.priority)}
              </Tag>
            </div>

            <div className="urgency-difficulty-indicators">
              <Tooltip title={`紧急性: ${urgency}/5`}>
                <div className="indicator">
                  <FireOutlined style={{ color: '#f5222d' }} />
                  <div className="indicator-dots">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className={`dot ${i < urgency ? 'active' : ''}`}></div>
                    ))}
                  </div>
                </div>
              </Tooltip>
              <Tooltip title={`执行难度: ${difficulty}/5`}>
                <div className="indicator">
                  <ThunderboltOutlined style={{ color: '#faad14' }} />
                  <div className="indicator-dots">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className={`dot ${i < difficulty ? 'active' : ''}`}></div>
                    ))}
                  </div>
                </div>
              </Tooltip>
            </div>
          </div>

          <Title level={4} className="card-title" style={{ marginTop: 16 }}>
            {item.title}
          </Title>

          <Paragraph style={{ fontSize: '14px', margin: '16px 0' }}>{item.description}</Paragraph>

          {/* 实施进度信息 */}
          <div className="implementation-container">
            <div
              className="implementation-header"
              onClick={(e) => toggleImplementationInfo(e, index)}
            >
              <Text strong>实施进度</Text>
              <Progress
                percent={implementationProgress[index]}
                size="small"
                status="active"
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
              {showImplementationInfo[index] ? <LeftOutlined /> : <RightOutlined />}
            </div>

            <AnimatePresence>
              {showImplementationInfo[index] && (
                <motion.div
                  className="implementation-details"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="implementation-timeline">
                    <div className="timeline-item">
                      <ClockCircleOutlined className="timeline-icon done" />
                      <div className="timeline-content">
                        <Text strong>建议生成</Text>
                        <Text type="secondary">2023-05-15 09:30</Text>
                      </div>
                    </div>
                    <div className="timeline-item">
                      <ClockCircleOutlined className="timeline-icon done" />
                      <div className="timeline-content">
                        <Text strong>初步评估</Text>
                        <Text type="secondary">2023-05-15 14:45</Text>
                      </div>
                    </div>
                    <div className="timeline-item">
                      <ClockCircleOutlined
                        className={`timeline-icon ${
                          implementationProgress[index] > 30 ? 'done' : 'pending'
                        }`}
                      />
                      <div className="timeline-content">
                        <Text strong>方案细化</Text>
                        <Text type="secondary">
                          {implementationProgress[index] > 30 ? '2023-05-16 10:20' : '待完成'}
                        </Text>
                      </div>
                    </div>
                    <div className="timeline-item">
                      <ClockCircleOutlined
                        className={`timeline-icon ${
                          implementationProgress[index] > 60 ? 'done' : 'pending'
                        }`}
                      />
                      <div className="timeline-content">
                        <Text strong>实施执行</Text>
                        <Text type="secondary">
                          {implementationProgress[index] > 60 ? '2023-05-17 16:30' : '待完成'}
                        </Text>
                      </div>
                    </div>
                    <div className="timeline-item">
                      <ClockCircleOutlined
                        className={`timeline-icon ${
                          implementationProgress[index] === 100 ? 'done' : 'pending'
                        }`}
                      />
                      <div className="timeline-content">
                        <Text strong>完成验收</Text>
                        <Text type="secondary">
                          {implementationProgress[index] === 100 ? '2023-05-20 11:15' : '待完成'}
                        </Text>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="card-action-buttons">
            <Space>
              <Button onClick={onReject}>拒绝</Button>
              <Button
                type="primary"
                onClick={onAccept}
                style={{
                  background: 'linear-gradient(90deg, #1890ff, #722ed1)',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
                }}
                icon={<CheckCircleOutlined />}
              >
                采纳建议
              </Button>
            </Space>
            <div className="action-hint">
              <StarOutlined className="highlight" />
              <Text type="secondary" className="hint-text">
                优先考虑高优先级建议
              </Text>
            </div>
          </div>

          {/* 装饰元素 */}
          <div className="card-decorations">
            <div className="decoration-circle c1"></div>
            <div className="decoration-circle c2"></div>
            <div className="decoration-circle c3"></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="suggestion-container">
      <Title level={5} style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <RobotOutlined style={{ marginRight: 8, color: '#1890ff' }} />
        AI建议响应
      </Title>

      <div className="card-stack-container suggestion-card-stack">
        <div className="card-stack-motion-container">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={activeIndex}
              custom={direction}
              variants={cardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="motion-card-item"
            >
              {renderCardContent(prSuggestions[activeIndex], activeIndex)}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 导航点 */}
        <div className="card-stack-nav">
          {prSuggestions.map((_, index) => (
            <div
              key={index}
              className={`card-stack-dot ${index === activeIndex ? 'active' : ''} ${
                prSuggestions[index].priority
              }`}
              onClick={() => handleCardChange(index)}
            />
          ))}
        </div>

        {/* 卡片计数器 */}
        <div className="card-stack-counter">
          {activeIndex + 1} / {prSuggestions.length}
        </div>

        {/* 控制按钮 */}
        <div className="card-stack-controls">
          <Button
            icon={<LeftOutlined />}
            shape="circle"
            onClick={(e) => {
              e.stopPropagation();
              handleCardChange(getPrevIndex());
            }}
            disabled={prSuggestions.length <= 1}
            className="control-button prev-button"
          />
          <Button
            icon={<RightOutlined />}
            shape="circle"
            onClick={(e) => {
              e.stopPropagation();
              handleCardChange(getNextIndex());
            }}
            disabled={prSuggestions.length <= 1}
            className="control-button next-button"
          />
        </div>

        {/* 底部虚拟卡片影子，增加深度感 */}
        <div className="card-stack-shadow"></div>
      </div>
    </div>
  );
};

export default AISuggestionResponse;
