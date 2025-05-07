import { Descriptions } from 'antd';
import React from 'react';

interface DescriptionProps {
  eventData: any;
}

const Description: React.FC<DescriptionProps> = ({ eventData }) => {
  // 如果还没有数据，显示加载中或空数据
  if (!eventData) {
    return (
      <div style={{ padding: '20px' }}>
        <Descriptions
          title="事件详情"
          bordered
          column={{ xs: 1, sm: 2, md: 2, lg: 2, xl: 2, xxl: 2 }}
          items={[{ label: '加载中...', children: '请稍候' }]}
        />
      </div>
    );
  }

  // 根据传入的数据创建描述项
  const items = [
    {
      label: '事件标题',
      children: eventData.title,
    },
    {
      label: '领域类型',
      children: eventData.area,
    },
    {
      label: '首发时间',
      children: eventData.date,
    },
    {
      label: '事件简介',
      children: eventData.description,
    },
    {
      label: '热度值',
      children: eventData.heatValue,
    },
    {
      label: '相关平台',
      children: '微博、知乎、抖音', // 模拟数据
    },
    {
      label: '相关媒体',
      children: '人民日报、央视新闻、新华社', // 模拟数据
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Descriptions
        title="事件详情"
        bordered
        column={{ xs: 1, sm: 2, md: 2, lg: 2, xl: 2, xxl: 2 }}
        items={items}
      />
    </div>
  );
};

export default Description;
