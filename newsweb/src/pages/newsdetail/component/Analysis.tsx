import { Alert, Card, Col, Row, Tag, Typography } from 'antd';
import React from 'react';
import EmotionRing from './EmotionRing';

const { Text } = Typography;

// 数据类型定义
interface AnalysisData {
  summary: string;
  sentiment: {
    video: { negative: number; neutral: number; positive: number };
    comments: { negative: number; neutral: number; positive: number };
  };
  events: {
    identified: string[];
    propagation: string;
    assessment: string;
    recommendation: string;
  };
}

interface AnalysisReportProps {
  data: AnalysisData;
}

const Analysis: React.FC<AnalysisReportProps> = ({ data }) => {
  // Add safety check for data
  if (!data) {
    return <Card>Loading analysis data...</Card>;
  }

  return (
    <div style={{ padding: 24 }}>
      {/* 第一行 - 视频摘要 */}
      <Row gutter={[8, 8]} >
        <Col span={24}>
          <Card title="视频内容摘要">

          </Card>
        </Col>
      </Row>

      {/* 第二行 - 分析结果 */}
      <Row >
        {/* 左侧 - 情感分析 */}
        <Col span={12}>
          <Card title="情感分析">
            <div style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 12, textAlign: 'center' }}>
                视频情感
              </div>
              <EmotionRing data={[
                { type: '正面', value: data.sentiment?.video?.positive || 0 },
                { type: '中性', value: data.sentiment?.video?.neutral || 0 },
                { type: '负面', value: data.sentiment?.video?.negative || 0 }
              ]} />
            </div>

            <div>
              <div style={{ marginBottom: 12, textAlign: 'center' }}>
                评论区情感
              </div>
              <EmotionRing data={[
                { type: '正面', value: data.sentiment?.comments?.positive || 0 },
                { type: '中性', value: data.sentiment?.comments?.neutral || 0 },
                { type: '负面', value: data.sentiment?.comments?.negative || 0 }
              ]} />
            </div>
          </Card>
        </Col>

        {/* 右侧 - 事件识别 */}
        <Col span={12}>
          <Card title="事件识别与评估">
            <div style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 8 }}>
                识别事件
              </div>
              <div>
                {data.events?.identified?.map((event, index) => (
                  <Tag
                    key={index}
                    color={index === 0 ? '#ff4d4f' : index === 1 ? '#faad14' : '#d4380d'}
                    style={{ marginBottom: 8 }}
                  >
                    {event}
                  </Tag>
                )) || <Text>No identified events</Text>}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 8 }}>
                传播评估
              </div>
              <Text type="danger">{data.events?.propagation || 'No propagation assessment'}</Text>
            </div>

            <div>
              <div style={{ marginBottom: 8 }}>
                系统建议
              </div>
              <Alert
                message={data.events?.recommendation || 'No recommendation available'}
                type="warning"
                showIcon
              />
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Analysis;
