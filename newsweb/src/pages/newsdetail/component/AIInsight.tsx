import { CommentOutlined, PlayCircleOutlined, RobotOutlined } from '@ant-design/icons';
import { Avatar, Card, Radio, Space, Tag, Typography } from 'antd';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useState } from 'react';
import AISuggestionResponse, { PRSuggestion } from './AISuggestionResponse';
import OpinionSummary from './OpinionSummary';
import './style.css';
import VideoAnalysis from './videoanalysis';

const { Title } = Typography;

interface AIInsightProps {
  opinionData: any[];
  eventTitle: string;
  prSuggestions: PRSuggestion[];
  videoData?: any;
  onAccept?: () => void;
  onReject?: () => void;
}

// 分析类型枚举
type AnalysisType = 'opinion' | 'suggestion' | 'video';

const AIInsight: React.FC<AIInsightProps> = ({
  opinionData,
  eventTitle,
  prSuggestions,
  videoData,
  onAccept,
  onReject,
}) => {
  // 添加状态来跟踪当前显示的分析类型
  const [analysisType, setAnalysisType] = useState<AnalysisType>('opinion');

  // 切换分析类型并添加动画效果
  const handleChangeType = (type: AnalysisType) => {
    if (type !== analysisType) {
      setAnalysisType(type);
    }
  };

  // 定义动画变体
  const contentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: 'easeOut',
      },
    },
    exit: {
      opacity: 0,
      y: -20,
      transition: {
        duration: 0.2,
        ease: 'easeIn',
      },
    },
  };

  // 创建默认视频数据（如果没有提供）
  const defaultVideoData = {
    title: eventTitle,
    summary:
      '这段视频主要展示了相关事件的核心内容，包括主要人物、事件背景和影响。视频通过多角度呈现了事件的发展过程，特别强调了关键时刻的转折点。',
    sentimentAnalysis: {
      videoSentiment: {
        positive: 35,
        neutral: 45,
        negative: 20,
      },
      commentSentiment: '评论区整体呈中性偏正面',
    },
    eventIdentification: {
      tags: ['重要公共事件', '社会关注焦点', '政策相关', '舆论热点'],
      evaluation:
        '根据AI分析，该视频内容属于中等敏感度事件，需要关注其后续发展，但目前未发现重大负面影响。建议持续监测相关舆情变化。',
    },
  };

  return (
    <Card
      className="ai-insight-card"
      variant="outlined"
      style={{
        background: 'linear-gradient(145deg, #ffffff, #f8f9ff)',
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(24, 144, 255, 0.15)',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* Header with title and AI icon */}
      <div className="ai-insight-header">
        <Space>
          <Avatar
            size={36}
            icon={<RobotOutlined />}
            style={{
              background: 'linear-gradient(120deg, #1890ff, #722ed1)',
              boxShadow: '0 4px 8px rgba(24, 144, 255, 0.3)',
            }}
          />
          <Title level={4} style={{ margin: 0, color: '#1f1f1f' }}>
            AI智析
          </Title>
        </Space>
        <Tag color="#1890ff" style={{ borderRadius: '12px', padding: '0 8px' }}>
          智能分析
        </Tag>
      </div>

      {/* Tab切换按钮 */}
      <div className="analysis-tabs">
        <Radio.Group
          value={analysisType}
          onChange={(e) => handleChangeType(e.target.value)}
          buttonStyle="solid"
          style={{ marginBottom: '16px', display: 'flex', width: '100%' }}
        >
          <Radio.Button
            value="opinion"
            style={{
              flex: 1,
              textAlign: 'center',
              borderRadius: analysisType === 'opinion' ? '8px' : '0',
              background:
                analysisType === 'opinion'
                  ? 'linear-gradient(90deg, #1890ff, #4dabf7)'
                  : 'transparent',
              color: analysisType === 'opinion' ? 'white' : 'inherit',
            }}
          >
            <CommentOutlined /> 舆情观点分析
          </Radio.Button>
          <Radio.Button
            value="suggestion"
            style={{
              flex: 1,
              textAlign: 'center',
              borderRadius: analysisType === 'suggestion' ? '8px' : '0',
              background:
                analysisType === 'suggestion'
                  ? 'linear-gradient(90deg, #1890ff, #4dabf7)'
                  : 'transparent',
              color: analysisType === 'suggestion' ? 'white' : 'inherit',
            }}
          >
            <RobotOutlined /> AI建议响应
          </Radio.Button>
          <Radio.Button
            value="video"
            style={{
              flex: 1,
              textAlign: 'center',
              borderRadius: analysisType === 'video' ? '8px' : '0',
              background:
                analysisType === 'video'
                  ? 'linear-gradient(90deg, #1890ff, #4dabf7)'
                  : 'transparent',
              color: analysisType === 'video' ? 'white' : 'inherit',
            }}
          >
            <PlayCircleOutlined /> 视频内容摘要
          </Radio.Button>
        </Radio.Group>
      </div>

      {/* 内容区域 - 使用Framer Motion的AnimatePresence提供流畅动画 */}
      <div className="ai-insight-content">
        <AnimatePresence mode="wait">
          {analysisType === 'opinion' && (
            <motion.div
              key="opinion"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="tab-content"
            >
              <OpinionSummary data={opinionData} />
            </motion.div>
          )}

          {analysisType === 'suggestion' && (
            <motion.div
              key="suggestion"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="tab-content"
            >
              <AISuggestionResponse
                prSuggestions={prSuggestions}
                onAccept={onAccept}
                onReject={onReject}
              />
            </motion.div>
          )}

          {analysisType === 'video' && (
            <motion.div
              key="video"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="tab-content"
            >
              <VideoAnalysis data={videoData || defaultVideoData} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
};

export default AIInsight;
