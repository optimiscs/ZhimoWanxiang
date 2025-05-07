import { FireOutlined } from '@ant-design/icons';
import { Statistic, Tag, Typography } from 'antd';
import React from 'react';
import './style.css';

const { Title, Text } = Typography;
const primaryColor = 'rgba(30, 134, 242, 1)';

interface EventData {
  title: string;
  area: string;
  description: string;
  heatValue: number;
  date: string;
}

const Description: React.FC<{ eventData: EventData | null }> = ({ eventData }) => {
  if (!eventData) return <div className="loading-description">加载中...</div>;

  return (
    <div className="event-description">
      <div className="event-header">
        <Title level={3} className="event-title">
          {eventData.title}
        </Title>
        <div className="event-meta">
          <Tag color={primaryColor} className="event-tag">
            {eventData.area}
          </Tag>
          <Text type="secondary" className="event-date">
            {eventData.date}
          </Text>
        </div>
      </div>

      <div className="event-content">
        <Text className="event-text">{eventData.description}</Text>

        <div className="event-stats">
          <Statistic
            title={
              <span className="stat-title">
                <FireOutlined /> 热度值
              </span>
            }
            value={eventData.heatValue}
            className="event-heat"
          />
        </div>
      </div>
    </div>
  );
};

export default Description;
