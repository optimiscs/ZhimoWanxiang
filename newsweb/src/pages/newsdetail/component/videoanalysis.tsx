import {
  AlertOutlined,
  BarChartOutlined,
  DislikeOutlined,
  ExperimentOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  LikeOutlined,
  MessageOutlined,
  PlayCircleOutlined,
  RightOutlined,
  RobotOutlined,
  SoundOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Progress,
  Row,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useState } from 'react';
import './style.css';

const { Title, Text, Paragraph } = Typography;

interface VideoAnalysisData {
  title: string;
  summary: string;
  sentimentAnalysis: {
    videoSentiment: {
      negative: number;
      neutral: number;
      positive: number;
    };
    commentSentiment: string;
  };
  eventIdentification: {
    tags: string[];
    evaluation: string;
  };
}

interface VideoAnalysisProps {
  data: VideoAnalysisData;
}

const VideoAnalysis: React.FC<VideoAnalysisProps> = ({ data }) => {
  // 改为使用activeIndex来跟踪当前显示的卡片
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0); // -1 for left, 1 for right, 0 for initial

  const sections = [
    { id: 'summary', title: '视频内容摘要', icon: <SoundOutlined /> },
    { id: 'sentiment', title: '情感分析', icon: <BarChartOutlined /> },
    { id: 'event', title: '事件识别与评估', icon: <AlertOutlined /> },
  ];

  if (!data) {
    return (
      <Card className="video-analysis-loading">
        <div className="loading-container">
          <div className="loading-icon">
            <RobotOutlined spin />
          </div>
          <Text>正在加载分析数据...</Text>
        </div>
      </Card>
    );
  }

  // 处理卡片切换 - 使用Framer Motion重构
  const handleCardChange = (index: number) => {
    if (index === activeIndex || index < 0 || index >= sections.length) return;

    // 确定切换方向
    setDirection(index > activeIndex ? 1 : -1);
    setActiveIndex(index);
  };

  // 获取下一个和上一个索引
  const getNextIndex = () => (activeIndex + 1) % sections.length;
  const getPrevIndex = () => (activeIndex - 1 + sections.length) % sections.length;

  // 获取情感分析标签的颜色和图标
  const getSentimentBadge = () => {
    const { positive, negative, neutral } = data.sentimentAnalysis.videoSentiment;

    if (positive > negative && positive > neutral) {
      return { color: 'success', text: '正面', icon: <LikeOutlined /> };
    } else if (negative > positive && negative > neutral) {
      return { color: 'error', text: '负面', icon: <DislikeOutlined /> };
    } else {
      return { color: 'default', text: '中性', icon: <InfoCircleOutlined /> };
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

  // 渲染摘要卡片内容
  const renderSummaryCard = () => {
    return (
      <div className="card-motion-content summary">
        <div className="card-content">
          <div className="card-header">
            <Space align="center">
              <div className="ai-icon-container">
                <SoundOutlined className="ai-icon" />
              </div>
              <Title level={4} className="card-title">
                视频内容摘要
              </Title>
            </Space>
            <Badge
              status={getSentimentBadge().color as any}
              text={
                <span className="sentiment-badge">
                  {getSentimentBadge().icon} {getSentimentBadge().text}倾向
                </span>
              }
            />
          </div>

          <div className="summary-container">
            <Paragraph className="summary-text">{data.summary}</Paragraph>
            <div className="summary-keywords">
              <Text type="secondary">热点关键词：</Text>
              <Space size={[0, 8]} wrap className="keyword-container">
                {['关键词1', '关键词2', '关键词3'].map((keyword, index) => (
                  <Tag
                    key={index}
                    color={index === 0 ? 'magenta' : index === 1 ? 'purple' : 'blue'}
                    className="keyword-tag"
                  >
                    {keyword}
                  </Tag>
                ))}
              </Space>
            </div>
          </div>

          <div className="card-decoration-bottom">
            <div className="decoration-dot"></div>
            <div className="decoration-dot"></div>
            <div className="decoration-dot"></div>
          </div>
        </div>
      </div>
    );
  };

  // 渲染情感分析卡片内容
  const renderSentimentCard = () => {
    return (
      <div className="card-motion-content sentiment">
        <div className="card-content">
          <div className="card-header">
            <Space align="center">
              <div className="ai-icon-container sentiment">
                <BarChartOutlined className="ai-icon" />
              </div>
              <Title level={4} className="card-title">
                情感分析
              </Title>
            </Space>
          </div>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <div className="sentiment-container">
                <Title level={5}>视频情感倾向</Title>
                <div className="sentiment-bars">
                  <Tooltip title={`正面：${data.sentimentAnalysis.videoSentiment.positive}%`}>
                    <div className="sentiment-bar-item">

                      <Progress
                        percent={data.sentimentAnalysis.videoSentiment.positive}
                        strokeColor="#52c41a"
                        showInfo={true}
                        className="sentiment-progress"
                      />
                    </div>
                  </Tooltip>

                  <Tooltip title={`中性：${data.sentimentAnalysis.videoSentiment.neutral}%`}>
                    <div className="sentiment-bar-item">

                      <Progress
                        percent={data.sentimentAnalysis.videoSentiment.neutral}
                        strokeColor="#1890ff"
                        showInfo={true}
                        className="sentiment-progress"
                      />
                    </div>
                  </Tooltip>

                  <Tooltip title={`负面：${data.sentimentAnalysis.videoSentiment.negative}%`}>
                    <div className="sentiment-bar-item">

                      <Progress
                        percent={data.sentimentAnalysis.videoSentiment.negative}
                        strokeColor="#ff4d4f"
                        showInfo={true}
                        className="sentiment-progress"
                      />
                    </div>
                  </Tooltip>
                </div>
              </div>
            </Col>

            <Col xs={24} md={12}>
              <div className="comment-sentiment-container">
                <Title level={5}>评论区情感分析</Title>
                <div className="comment-sentiment-content">
                  <div className="comment-icon-container">
                    <MessageOutlined className="comment-icon" />
                  </div>
                  <div className="comment-text">
                    <Paragraph>
                      <Text strong>情感倾向：</Text>
                      <Tag
                        color={
                          data.sentimentAnalysis.commentSentiment.includes('正面')
                            ? 'green'
                            : data.sentimentAnalysis.commentSentiment.includes('负面')
                            ? 'red'
                            : 'blue'
                        }
                      >
                        {data.sentimentAnalysis.commentSentiment}
                      </Tag>
                    </Paragraph>
                    <Paragraph className="comment-analysis">
                      评论区的互动情况与视频内容情感呈现
                      <Text strong>
                        {data.sentimentAnalysis.videoSentiment.positive >
                        data.sentimentAnalysis.videoSentiment.negative
                          ? ' 正相关'
                          : ' 负相关'}
                      </Text>
                      关系，用户反馈主要集中在产品质量和服务体验方面。
                    </Paragraph>
                  </div>
                </div>
              </div>
            </Col>
          </Row>

          <div className="card-decoration-bottom">
            <div className="decoration-dot"></div>
            <div className="decoration-dot"></div>
            <div className="decoration-dot"></div>
          </div>
        </div>
      </div>
    );
  };

  // 渲染事件识别卡片内容
  const renderEventCard = () => {
    return (
      <div className="card-motion-content event">
        <div className="card-content">
          <div className="card-header">
            <Space align="center">
              <div className="ai-icon-container event">
                <AlertOutlined className="ai-icon" />
              </div>
              <Title level={4} className="card-title">
                事件识别与评估
              </Title>
            </Space>
          </div>

          <div className="event-analysis-container">
            <div className="event-tags-container">
              <Title level={5}>
                <ThunderboltOutlined /> 关键事件标签
              </Title>
              <div className="event-tags">
                {data.eventIdentification.tags.map((tag, index) => {
                  const isHighlighted = index === 0;
                  return (
                    <div
                      key={index}
                      className={`event-tag-item ${isHighlighted ? 'highlighted' : ''}`}
                      style={{ '--tag-index': index } as React.CSSProperties}
                    >
                      <Tag
                        color={
                          index === 0
                            ? '#ff4d4f'
                            : index === 1
                            ? '#faad14'
                            : index === 2
                            ? '#d4380d'
                            : '#1890ff'
                        }
                        className="event-tag"
                      >
                        {tag}
                      </Tag>
                      {isHighlighted && <Badge status="processing" className="highlight-badge" />}
                    </div>
                  );
                })}
              </div>
            </div>

            <Divider />

            <div className="evaluation-container">
              <Title level={5}>
                <ExperimentOutlined /> AI系统评估
              </Title>
              <div className="evaluation-content">
                <div className="pulse-container">
                  <div className="pulse-ring"></div>
                  <div className="pulse-dot"></div>
                </div>
                <Card className="evaluation-card" bordered={false}>
                  <Paragraph className="evaluation-text">
                    {data.eventIdentification.evaluation}
                  </Paragraph>
                  <div className="risk-assessment">
                    <Text type="secondary">风险等级：</Text>
                    <Tag
                      color={
                        data.eventIdentification.evaluation.includes('严重') ||
                        data.eventIdentification.evaluation.includes('高风险')
                          ? 'red'
                          : data.eventIdentification.evaluation.includes('中等')
                          ? 'orange'
                          : 'green'
                      }
                    >
                      {data.eventIdentification.evaluation.includes('严重') ||
                      data.eventIdentification.evaluation.includes('高风险')
                        ? '高风险'
                        : data.eventIdentification.evaluation.includes('中等')
                        ? '中等风险'
                        : '低风险'}
                    </Tag>
                  </div>
                </Card>
              </div>
            </div>
          </div>

          <div className="card-decoration-bottom">
            <div className="decoration-dot"></div>
            <div className="decoration-dot"></div>
            <div className="decoration-dot"></div>
          </div>
        </div>
      </div>
    );
  };

  // 根据当前索引渲染对应卡片
  const renderCardContent = (index: number) => {
    switch (sections[index].id) {
      case 'summary':
        return renderSummaryCard();
      case 'sentiment':
        return renderSentimentCard();
      case 'event':
        return renderEventCard();
      default:
        return null;
    }
  };

  if (!data) {
    return (
      <div className="card-stack-empty">
        <div className="card-stack-empty-icon">
          <InboxOutlined />
        </div>
        <Text>暂无视频分析数据</Text>
      </div>
    );
  }

  return (
    <div className="video-analysis-container">
      <Title level={5} style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <PlayCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />
        视频内容分析
      </Title>

      <div className="card-stack-container video-card-stack">
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
              {renderCardContent(activeIndex)}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 导航点 */}
        <div className="card-stack-nav">
          {sections.map((section, index) => (
            <div
              key={index}
              className={`card-stack-dot ${index === activeIndex ? 'active' : ''} ${
                sections[index].id
              }`}
              onClick={() => handleCardChange(index)}
            />
          ))}
        </div>

        {/* 卡片计数器 */}
        <div className="card-stack-counter">
          {activeIndex + 1} / {sections.length}
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
            disabled={sections.length <= 1}
            className="control-button prev-button"
          />
          <Button
            icon={<RightOutlined />}
            shape="circle"
            onClick={(e) => {
              e.stopPropagation();
              handleCardChange(getNextIndex());
            }}
            disabled={sections.length <= 1}
            className="control-button next-button"
          />
        </div>

        {/* 底部虚拟卡片影子，增加深度感 */}
        <div className="card-stack-shadow"></div>
      </div>
    </div>
  );
};

export default VideoAnalysis;
