import { CalendarOutlined } from '@ant-design/icons';
import { Avatar, Card, Space, Tag, Typography } from 'antd';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useRef, useState } from 'react';
import TimelineComponent from './Timeline';
import './style.css';

const { Title } = Typography;

// 定义时间轴数据接口
interface TimelineItem {
  id: string;
  date: string;
  time?: string;
  event: string;
  description?: string;
  importance?: 'high' | 'medium' | 'low';
  tags?: string[];
}

interface PropagationAnalysisProps {
  timelineData: TimelineItem[];
}

const PropagationAnalysis: React.FC<PropagationAnalysisProps> = ({ timelineData }) => {
  // Create a virtualized version of the timeline data
  const [visibleTimelineData, setVisibleTimelineData] = useState<TimelineItem[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Set up an IntersectionObserver to check if the component is visible
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      { threshold: 0.1 }, // Trigger when at least 10% is visible
    );

    observer.observe(containerRef.current);

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, []);

  // Only process timeline data when component is visible
  useEffect(() => {
    if (isVisible && timelineData.length > 0) {
      // Limit the number of items rendered to improve performance
      const optimizedData =
        timelineData.length > 20 ? [...timelineData.slice(0, 20)] : [...timelineData];

      setVisibleTimelineData(optimizedData);
    } else if (!isVisible) {
      // Clear the data when not visible to save memory
      setVisibleTimelineData([]);
    }
  }, [timelineData, isVisible]);

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

  // 定义卡片整体的动画变体
  const cardVariants = {
    hidden: { opacity: 0, scale: 0.98 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: 'easeOut',
        staggerChildren: 0.1,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.98,
      transition: {
        duration: 0.3,
        ease: 'easeIn',
      },
    },
  };

  return (
    <div ref={containerRef}>
      <AnimatePresence mode="wait">
        <motion.div
          key="propagation-card"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >

          <Card
            className="propagation-analysis-card"
            variant="outlined"

          >
            {/* Header with title and icon */}
            <motion.div className="propagation-analysis-header" variants={contentVariants} >
              <Space>
                <Avatar
                  size={36}
                  icon={<CalendarOutlined />}
                  style={{
                    background: 'linear-gradient(120deg, #1890ff, #fa8c16)',
                    boxShadow: '0 4px 8px rgba(24, 144, 255, 0.3)',
                  }}
                />
                <Title level={4} style={{ margin: 0, color: '#1f1f1f' }}>
                  时间轴分析
                </Title>
              </Space>
              <Tag color="#fa8c16" style={{ borderRadius: '12px', padding: '0 8px' }}>
                事件追踪
              </Tag>
            </motion.div>

            {/* 内容区域 - 使用嵌套的动画元素 */}
            <motion.div className="propagation-analysis-content" variants={contentVariants} >
              {isVisible && <TimelineComponent data={visibleTimelineData} />}
            </motion.div>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default PropagationAnalysis;
