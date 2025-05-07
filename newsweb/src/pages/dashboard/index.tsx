import { EventProvider, useEventContext } from '@/contexts/EventContext';
import { Card, Col, Row, Spin } from 'antd';
import { useEffect, useState } from 'react';
import LarkMapComponent from './component/LarkMapComponent';
import PublicOpinionCard from './component/PublicOpinionCard';
import WordCloudComponent from './component/Wordcloud';
import AreaChart from './component/AreaChart';
import RoseComponent from './component/RoseComponent';
import PlatformHotNews from './component/PlatformHotNews';

// 词云数据处理函数：将wordCloud数据转换为词云格式
const processWordCloudData = (wordCloud: any) => {
  // 检查是否有wordCloud数据且为数组
  if (Array.isArray(wordCloud) && wordCloud.length > 0) {
    // 返回原始格式，因为原始数据已包含word和weight字段
    return wordCloud.map(item => ({
      word: item.word,
      weight: item.weight * 100 // 将权重值放大，提高可视性
    }));
  }

  // 如果没有有效数据，返回空数组
  return [];
};

// 获取情感数据（用于图表展示）
const getEmotionChartData = (emotion: any) => {
  // 处理emotion是对象的情况
  if (typeof emotion === 'object' && emotion !== null && emotion.schema) {
    // 直接从schema中提取数据
    return Object.entries(emotion.schema).map(([type, value]) => ({
      type,
      value: Number(value)
    }));
  }
  return [];
};

// 获取立场数据（用于图表展示）
const getStanceChartData = (stance: any) => {
  // 处理stance是对象的情况
  if (typeof stance === 'object' && stance !== null && stance.schema) {
    // 直接从schema中提取数据
    return Object.entries(stance.schema).map(([type, value]) => ({
      type,
      value: Number(value)
    }));
  }
  return [];
};

// 内部组件：连接到EventContext
const DashboardContent = () => {
  const { selectedEvent, loading } = useEventContext();
  const [wordCloudData, setWordCloudData] = useState<any[]>([]);
  const [roseData, setRoseData] = useState<any[]>([]);
  const [stanceData, setStanceData] = useState<any[]>([]);
  const [emotionObject, setEmotionObject] = useState<any>(null);
  const [stanceObject, setStanceObject] = useState<any>(null);

  // 当选中事件变化时，更新词云和玫瑰图数据
  useEffect(() => {
    if (selectedEvent) {
      // 词云数据处理
      const processedWordCloud = processWordCloudData(selectedEvent.wordCloud);
      setWordCloudData(processedWordCloud);

      // 情感数据获取
      const emotionChartData = getEmotionChartData(selectedEvent.emotion);
      setRoseData(emotionChartData);
      setEmotionObject(selectedEvent.emotion);

      // 立场数据获取
      const stanceChartData = getStanceChartData(selectedEvent.stance);
      setStanceData(stanceChartData);
      setStanceObject(selectedEvent.stance);
      console.log("立场数据", stanceChartData);

    } else {
      // 如果没有选中事件，清空数据
      setWordCloudData([]);
      setRoseData([]);
      setStanceData([]);
      setEmotionObject(null);
      setStanceObject(null);
    }
  }, [selectedEvent]);

  return (
    <>
      <Row gutter={[16, 16]} style={{ height: 'calc(100vh - 180px)' }}>
        <Col span={5}>
          <Card style={{ height: '100%' }}>
            <PlatformHotNews loading={loading} />
          </Card>
        </Col>

        <Col span={14}>
          <LarkMapComponent loading={loading} />
        </Col>

        <Col span={5}>
          <PublicOpinionCard loading={loading} />
        </Col>

        <Col span={5}>
          <RoseComponent
            loading={loading}
            data={roseData}
            stanceData={stanceData}
            emotion={emotionObject}
            stance={stanceObject}
          />
        </Col>

        <Col span={14}>
          <AreaChart loading={loading} />
        </Col>
        <Col span={5}>
          <WordCloudComponent
            loading={loading}
            data={wordCloudData}
          />
        </Col>
      </Row>
    </>
  );
};

// 主组件：提供EventProvider
const Dashboard = () => {
  return (
    <EventProvider>
      <DashboardContent />
    </EventProvider>
  );
};

export default Dashboard;
