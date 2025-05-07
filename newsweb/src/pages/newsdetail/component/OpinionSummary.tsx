import {
  EyeOutlined,
  HeartOutlined,
  InboxOutlined,
  LeftOutlined,
  LikeOutlined,
  MessageOutlined,
  RightOutlined,
  ShareAltOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Space, Tag, Tooltip, Typography } from 'antd';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import './style.css';

const { Text, Paragraph, Title } = Typography;

// 观点摘要组件，展示观点总结
interface OpinionSummaryProps {
  data: Array<{
    id: number;
    title: string;
    content: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    source: string;
    count: number;
  }>;
}

const OpinionSummary: React.FC<OpinionSummaryProps> = ({ data }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  // 添加卡片互动数据状态
  const [cardInteractions, setCardInteractions] = useState<{
    [key: number]: { liked: boolean; saved: boolean; views: number };
  }>({});
  // 动画方向控制
  const [direction, setDirection] = useState(0); // -1 for left, 1 for right, 0 for initial

  // 初始化卡片互动数据
  useEffect(() => {
    const initialInteractions = data.reduce((acc, item, index) => {
      acc[index] = { liked: false, saved: false, views: Math.floor(Math.random() * 100) + 20 };
      return acc;
    }, {} as { [key: number]: { liked: boolean; saved: boolean; views: number } });

    setCardInteractions(initialInteractions);
  }, [data]);

  // 根据情感类型获取颜色
  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return '#52c41a';
      case 'negative':
        return '#f5222d';
      case 'neutral':
        return '#1890ff';
      default:
        return '#1890ff';
    }
  };

  // 获取情感类型对应的文本
  const getSentimentText = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return '正面';
      case 'negative':
        return '负面';
      case 'neutral':
        return '中性';
      default:
        return '中性';
    }
  };

  // 根据内容提炼标题
  const extractTitle = (content: string): string => {
    // 提取前15个字符作为标题，如果内容过长则加上省略号
    const maxLength = 15;
    if (content.length <= maxLength) return content;

    // 尝试在标点符号处截断
    const punctuationMarks = [',', '，', '。', '.', '；', ';', '：', ':', '！', '!', '?', '？'];
    for (const mark of punctuationMarks) {
      const index = content.indexOf(mark);
      if (index > 0 && index <= maxLength) {
        return content.substring(0, index + 1);
      }
    }

    // 如果没有合适的标点符号，就在适当位置截断
    return content.substring(0, maxLength) + '...';
  };

  // 获取来源图标和样式
  const getSourceIcon = (source: string) => {
    if (source.includes('央视') || source.includes('新闻')) {
      return { icon: '📺', color: '#f56a00', bgColor: '#fff7e6' };
    } else if (source.includes('财经') || source.includes('报告')) {
      return { icon: '📊', color: '#108ee9', bgColor: '#e6f7ff' };
    } else if (source.includes('法律') || source.includes('司法')) {
      return { icon: '⚖️', color: '#722ed1', bgColor: '#f9f0ff' };
    } else if (source.includes('政府') || source.includes('通报')) {
      return { icon: '🏛️', color: '#13c2c2', bgColor: '#e6fffb' };
    } else if (source.includes('社交') || source.includes('媒体')) {
      return { icon: '📱', color: '#eb2f96', bgColor: '#fff0f6' };
    } else {
      return { icon: '📄', color: '#1890ff', bgColor: '#e6f7ff' };
    }
  };

  // 处理卡片切换 - 使用Framer Motion实现
  const handleCardChange = (index: number) => {
    if (index === activeIndex || index < 0 || index >= data.length) return;

    // 确定切换方向
    setDirection(index > activeIndex ? 1 : -1);

    // 更新浏览量数据
    setCardInteractions((prev) => ({
      ...prev,
      [index]: { ...prev[index], views: prev[index].views + 1 },
    }));

    // 设置活动索引
    setActiveIndex(index);
  };

  // 处理点赞
  const handleLike = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setCardInteractions((prev) => ({
      ...prev,
      [index]: { ...prev[index], liked: !prev[index].liked },
    }));
  };

  // 处理收藏
  const handleSave = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setCardInteractions((prev) => ({
      ...prev,
      [index]: { ...prev[index], saved: !prev[index].saved },
    }));
  };

  // 获取下一个和上一个索引
  const getNextIndex = () => (activeIndex + 1) % data.length;
  const getPrevIndex = () => (activeIndex - 1 + data.length) % data.length;

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

  if (!data || data.length === 0) {
    return (
      <div className="card-stack-empty">
        <div className="card-stack-empty-icon">
          <InboxOutlined />
        </div>
        <Text>暂无舆情观点数据</Text>
      </div>
    );
  }

  // 渲染当前卡片内容
  const renderCardContent = (item: any, index: number) => {
    const title = extractTitle(item.title);
    const sourceStyle = getSourceIcon(item.source);

    return (
      <div className={`card-motion-content ${item.sentiment}`}>
        {/* 卡片顶部装饰元素 */}
        <div className={`card-sentiment-indicator ${item.sentiment}`}></div>

        <div className="card-content">
          <div className="card-header">
            <Tag
              color={getSentimentColor(item.sentiment)}
              className="card-badge sentiment-tag"
              icon={item.sentiment === 'positive' ? <LikeOutlined /> : null}
            >
              {getSentimentText(item.sentiment)}
            </Tag>
            <Tooltip title={`${item.count} 次提及`}>
              <Space className="mention-count">
                <MessageOutlined />
                <span>{item.count}</span>
              </Space>
            </Tooltip>
          </div>

          <Title level={5} className="opinion-title card-title">
            {title}
            {cardInteractions[index]?.saved && <StarOutlined className="saved-star" />}
          </Title>

          <Paragraph
            className="opinion-content"
            ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
          >
            {item.content}
          </Paragraph>

          <div className="opinion-footer">
            <Space className="source-info">
              <Avatar
                size="small"
                style={{
                  backgroundColor: sourceStyle.bgColor,
                  color: sourceStyle.color,
                  fontSize: '12px',
                }}
              >
                {sourceStyle.icon}
              </Avatar>
              <Text type="secondary" className="source-text">
                {item.source}
              </Text>
            </Space>

            {/* 添加互动按钮 */}
            <div className="opinion-actions">
              <Tooltip title={cardInteractions[index]?.liked ? '取消点赞' : '点赞'}>
                <Button
                  type="text"
                  size="small"
                  icon={<HeartOutlined className={cardInteractions[index]?.liked ? 'liked' : ''} />}
                  onClick={(e) => handleLike(e, index)}
                />
              </Tooltip>
              <Tooltip title={cardInteractions[index]?.saved ? '取消收藏' : '收藏'}>
                <Button
                  type="text"
                  size="small"
                  icon={<StarOutlined className={cardInteractions[index]?.saved ? 'saved' : ''} />}
                  onClick={(e) => handleSave(e, index)}
                />
              </Tooltip>
              <Tooltip title="分享">
                <Button type="text" size="small" icon={<ShareAltOutlined />} />
              </Tooltip>
              <Tooltip title={`${cardInteractions[index]?.views || 0} 次浏览`}>
                <Space className="view-count">
                  <EyeOutlined />
                  <span>{cardInteractions[index]?.views || 0}</span>
                </Space>
              </Tooltip>
            </div>
          </div>

          {/* 添加卡片底部装饰 */}
          <div className="card-decoration-bottom">
            <div className="decoration-dot"></div>
            <div className="decoration-dot"></div>
            <div className="decoration-dot"></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="card-stack-container opinion-card-stack">
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
            {renderCardContent(data[activeIndex], activeIndex)}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 导航点 */}
      <div className="card-stack-nav">
        {data.map((_, index) => (
          <div
            key={index}
            className={`card-stack-dot ${index === activeIndex ? 'active' : ''} ${
              data[index].sentiment
            }`}
            onClick={() => handleCardChange(index)}
          />
        ))}
      </div>

      {/* 卡片计数器 */}
      <div className="card-stack-counter">
        {activeIndex + 1} / {data.length}
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
          disabled={data.length <= 1}
          className="control-button prev-button"
        />
        <Button
          icon={<RightOutlined />}
          shape="circle"
          onClick={(e) => {
            e.stopPropagation();
            handleCardChange(getNextIndex());
          }}
          disabled={data.length <= 1}
          className="control-button next-button"
        />
      </div>

      {/* 底部虚拟卡片影子，增加深度感 */}
      <div className="card-stack-shadow"></div>
    </div>
  );
};

export default OpinionSummary;
