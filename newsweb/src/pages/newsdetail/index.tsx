import { Badge, Button, Card, Col, Divider, Layout, Row, message } from 'antd';
import { useEffect, useState } from 'react';
import AIInsight from './component/AIInsight';
import PropagationAnalysis from './component/PropagationAnalysis';
import VideoAnalysisPanel from './component/VideoAnalysisPanel';

import {
  ClockCircleOutlined,
  ExportOutlined,
  MessageOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import './component/style.css';

const { Content } = Layout;

interface SentimentConfig {
  positive: { color: string; text: string };
  neutral: { color: string; text: string };
  negative: { color: string; text: string };
}

const NewsDetail: React.FC = () => {
  const [videoAnalysis, setVideoAnalysis] = useState<any>(null);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [opinionSummaries, setOpinionSummaries] = useState<any[]>([]);
  const [prSuggestions, setPrSuggestions] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [videoResponse, timelineResponse, opinionResponse, prResponse] = await Promise.all([
          fetch('/api/video'),
          fetch('/api/timeline'),
          fetch('/api/opinion'),
          fetch('/api/prsuggestions'),
        ]);

        const [videoData, timelineData, opinionData, prData] = await Promise.all([
          videoResponse.json(),
          timelineResponse.json(),
          opinionResponse.json(),
          prResponse.json(),
        ]);

        setVideoAnalysis(videoData);
        setTimelineData(timelineData);
        setOpinionSummaries(opinionData);
        setPrSuggestions(prData);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  // Add handlers for accept/reject actions
  const handleAcceptSuggestions = () => {
    message.success('已采纳AI建议');
  };

  const handleRejectSuggestions = () => {
    message.info('已拒绝AI建议');
  };

  // 情感类型对应的颜色和文本
  const sentimentConfig: SentimentConfig = {
    positive: { color: '#52c41a', text: '正面' },
    neutral: { color: '#1890ff', text: '中性' },
    negative: { color: '#f5222d', text: '负面' },
  };

  // 渲染内容详情
  const renderContentDetail = () => {
    const event = videoAnalysis || {
      title: '',
      summary: '',
      sentimentAnalysis: {
        videoSentiment: {
          negative: 0,
          neutral: 0,
          positive: 0,
        },
        commentSentiment: 'neutral',
      },
      eventIdentification: {
        tags: [],
        evaluation: '',
      },
    };

    // 确保sentiment是sentimentConfig中的有效键
    let sentiment: keyof SentimentConfig = 'neutral';
    const commentSentiment = event?.sentimentAnalysis?.commentSentiment;
    if (
      commentSentiment === 'positive' ||
      commentSentiment === 'negative' ||
      commentSentiment === 'neutral'
    ) {
      sentiment = commentSentiment;
    }

    return (
      <>
        {/* 内容标题栏 */}
        <div className="content-header">
          <div className="content-title">
            <h2>{event.title}</h2>
            <Badge className="content-badge" count={sentimentConfig[sentiment].text} />
          </div>

          <div className="content-actions">
            <Button type="link" icon={<ExportOutlined />}>
              原文链接
            </Button>
          </div>
        </div>

        {/* 内容基本信息 */}
        <div className="content-meta">
          <span>
            <i className="fab fa-weibo"></i> youtube
          </span>
          <span>
            <ClockCircleOutlined /> 2024-09-16 14:23
          </span>
          <span>
            <ShareAltOutlined /> 点赞 9899
          </span>
          <span>
            <MessageOutlined /> 评论 1303
          </span>
        </div>

        {/* 所有内容直接显示在页面上 */}
        <Row gutter={[16, 16]}>
          {/* 视频分析部分 */}
          <Col span={24}>
            <VideoAnalysisPanel data={videoAnalysis} />
          </Col>

          {/* 传播分析部分 */}
          <Col span={12}>
            <PropagationAnalysis timelineData={timelineData}  />
          </Col>

          {/* AI分析部分 */}
          <Col span={12}>
            <Row>
              <Col span={24}>
                <AIInsight
                  opinionData={opinionSummaries}
                  eventTitle={event.title || '未知事件'}
                  prSuggestions={prSuggestions}
                  onAccept={handleAcceptSuggestions}
                  onReject={handleRejectSuggestions}
                />
              </Col>
            </Row>
          </Col>
        </Row>

        <Divider />
      </>
    );
  };

  return (
    <Layout className="monitoring-layout">
      <Content>
        <Card className="monitoring-content" variant="outlined">
          <Row gutter={16} className="content-container">
            <Col span={24} className="content-detail-column">
              {renderContentDetail()}
            </Col>
          </Row>
        </Card>
      </Content>
    </Layout>
  );
};

export default NewsDetail;
