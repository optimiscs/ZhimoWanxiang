import { ClockCircleOutlined, InfoCircleOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Badge, Button, Card, Space, Tag, Tooltip, Typography } from 'antd';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import './style.css';
const primaryColor = 'rgba(30, 134, 242, 1)';

const { Text } = Typography;

interface TimelineItem {
  id: string;
  date: string;
  time?: string;
  event: string;
  description?: string;
  importance?: 'high' | 'medium' | 'low';
  tags?: string[];
}

// Memoized timeline card component
const TimelineCard = memo(
  ({
    item,
    getImportanceColor,
    getImportanceText,
    isActive,
  }: {
    item: TimelineItem;
    getImportanceColor: (importance?: string) => string;
    getImportanceText: (importance?: string) => string;
    isActive: boolean;
  }) => (
    <Card

      className={`timeline-card ${isActive ? 'active-timeline-card' : ''}`}
      variant="outlined"
      styles={{
        body: {
          padding: '12px 16px',
          minHeight: '80px',
          transition: 'all 0.3s ease',
        },
      }}
    >
      <div className="timeline-card-header">
        <div className="timeline-card-title">
          <span>{item.event}</span>
          {item.importance && (
            <Badge
              count={getImportanceText(item.importance)}
              style={{
                backgroundColor: getImportanceColor(item.importance),
                marginLeft: 8,
                transition: 'all 0.3s ease',
              }}
            />
          )}
        </div>
        {item.time && (
          <div className="timeline-time">
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            <Text type="secondary">{item.time}</Text>
          </div>
        )}
      </div>

      {item.description && (
        <div className="timeline-description">
          <Text type="secondary">{item.description}</Text>
        </div>
      )}

      {item.tags && item.tags.length > 0 && (
        <div className="timeline-tags">
          {item.tags.map((tag, tagIndex) => (
            <Tag key={tagIndex} style={{ margin: '4px 4px 0 0' }}>
              {tag}
            </Tag>
          ))}
        </div>
      )}
    </Card>
  ),
);

// 自定义Hook，用于管理自动滚动和节点更新
const useAutoScroll = (
  data: TimelineItem[],
  extendedData: TimelineItem[],
  scrollContainerRef: React.RefObject<HTMLDivElement>,
  nodeRefs: React.MutableRefObject<Map<string, HTMLDivElement>>,
  updateActiveNode: (nodeId: string | null) => void,
  activeNode: string | null
) => {
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const isScrollingRef = useRef<boolean>(false);
  const targetScrollLeftRef = useRef<number | null>(null);
  const currentIndexRef = useRef<number>(0);
  const [autoScroll, setAutoScroll] = useState(true);

  // 简化的节点位置检测和更新
  const updateActiveNodeByPosition = useCallback((container: HTMLDivElement) => {
    const centerX = container.scrollLeft + (container.offsetWidth / 2);

    let closestNode: number | null = null;
    let minDistance = Infinity;

    // 找到最接近中心的节点
    extendedData.forEach((_, index) => {
      const nodeId = `node-${index}`;
      const element = nodeRefs.current.get(nodeId);

      if (element) {
        const nodeCenter = element.offsetLeft + (element.offsetWidth / 2);
        const distance = Math.abs(nodeCenter - centerX);

        if (distance < minDistance) {
          minDistance = distance;
          closestNode = index;
        }
      }
    });

    // 更新活动节点
    if (closestNode !== null) {
      const nodeId = `node-${closestNode}`;
      currentIndexRef.current = closestNode % data.length;

      if (activeNode !== nodeId) {
        updateActiveNode(nodeId);
      }
    }
  }, [extendedData, nodeRefs, data.length, updateActiveNode, activeNode]);

  // 简化的自动滚动函数
  const scroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || isScrollingRef.current) return;

    const now = performance.now();
    const elapsed = now - lastTimeRef.current;
    lastTimeRef.current = now;

    // 固定滚动速度（像素/毫秒）
    const scrollSpeed = 0.05;

    // 自动滚动
    container.scrollLeft += scrollSpeed * elapsed;

    // 检查是否到达末尾，如果是则循环到开头
    const maxScroll = container.scrollWidth - container.offsetWidth;
    if (container.scrollLeft >= maxScroll) {
      container.scrollLeft = 0;
    }

    // 简化的节点检测：直接查找位于视口中心的节点
    updateActiveNodeByPosition(container);

    // 继续动画
    animationRef.current = requestAnimationFrame(scroll);
  }, [scrollContainerRef, isScrollingRef, updateActiveNodeByPosition]);

  // 开始自动滚动
  const startAutoScroll = useCallback(() => {
    lastTimeRef.current = performance.now();
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = requestAnimationFrame(scroll);
  }, [scroll]);

  // 暂停自动滚动
  const pauseAutoScroll = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  // 切换自动滚动状态
  const toggleAutoScroll = useCallback(() => {
    setAutoScroll(prev => {
      if (!prev) {
        startAutoScroll();
      } else {
        pauseAutoScroll();
      }
      return !prev;
    });
  }, [startAutoScroll, pauseAutoScroll]);

  // 平滑滚动到指定位置
  const smoothScrollTo = useCallback((targetLeft: number, duration: number = 500) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    isScrollingRef.current = true;
    const startLeft = container.scrollLeft;
    const startTime = performance.now();
    targetScrollLeftRef.current = targetLeft;

    // 缓动函数
    const easeInOutQuad = (t: number): number => {
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    };

    const animateScroll = (currentTime: number) => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      const easeProgress = easeInOutQuad(progress);

      if (container) {
        container.scrollLeft = startLeft + (targetLeft - startLeft) * easeProgress;
      }

      if (progress < 1 && container) {
        animationRef.current = requestAnimationFrame(animateScroll);
      } else {
        isScrollingRef.current = false;
        animationRef.current = null;

        // 自动滚动状态时，恢复自动滚动
        if (autoScroll) {
          startAutoScroll();
        }
      }
    };

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    animationRef.current = requestAnimationFrame(animateScroll);
  }, [scrollContainerRef, autoScroll, startAutoScroll]);

  // 滚动到特定节点
  const scrollToNode = useCallback((nodeId: string | null, instant = false) => {
    if (!nodeId || !nodeRefs.current.has(nodeId)) return;

    const container = scrollContainerRef.current;
    const element = nodeRefs.current.get(nodeId);
    if (!container || !element) return;

    pauseAutoScroll();

    const containerWidth = container.offsetWidth;
    const nodeLeft = element.offsetLeft;
    const nodeWidth = element.offsetWidth;
    const centerPosition = nodeLeft - (containerWidth / 2) + (nodeWidth / 2);

    // 更新活动节点
    updateActiveNode(nodeId);

    // 执行滚动
    if (instant) {
      container.scrollLeft = centerPosition;
      if (autoScroll) {
        setTimeout(startAutoScroll, 100);
      }
    } else {
      smoothScrollTo(centerPosition);
    }

    // 更新当前索引
    const indexMatch = nodeId.match(/node-(\d+)/);
    if (indexMatch) {
      const index = parseInt(indexMatch[1]);
      currentIndexRef.current = index % data.length;
    }
  }, [nodeRefs, scrollContainerRef, updateActiveNode, data.length, autoScroll, pauseAutoScroll, smoothScrollTo, startAutoScroll]);

  // 导航到前一个节点
  const goToPrevious = useCallback(() => {
    pauseAutoScroll();

    const prevIndex = currentIndexRef.current > 0 ? currentIndexRef.current - 1 : data.length - 1;
    currentIndexRef.current = prevIndex;

    const nodeId = `node-${prevIndex}`;
    scrollToNode(nodeId);
  }, [data.length, pauseAutoScroll, scrollToNode]);

  // 导航到下一个节点
  const goToNext = useCallback(() => {
    pauseAutoScroll();

    const nextIndex = (currentIndexRef.current + 1) % data.length;
    currentIndexRef.current = nextIndex;

    const nodeId = `node-${nextIndex}`;
    scrollToNode(nodeId);
  }, [data.length, pauseAutoScroll, scrollToNode]);

  // 点击节点处理
  const handleNodeClick = useCallback((id: string) => {
    pauseAutoScroll();

    scrollToNode(id);

    // 延迟后恢复自动滚动
    if (autoScroll) {
      setTimeout(() => {
        startAutoScroll();
      }, 5000);
    }
  }, [autoScroll, pauseAutoScroll, scrollToNode, startAutoScroll]);

  // 自动滚动初始化和清理
  useEffect(() => {
    if (autoScroll) {
      startAutoScroll();
    } else {
      pauseAutoScroll();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [autoScroll, startAutoScroll, pauseAutoScroll]);

  // 监听滚动事件，处理边界滚动
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isScrollingRef.current) return;

      const { scrollLeft, scrollWidth, clientWidth } = container;

      // 手动滚动时更新活动节点
      if (!animationRef.current) {
        updateActiveNodeByPosition(container);
      }

      // 循环滚动逻辑
      if (scrollLeft >= scrollWidth - clientWidth - 10) {
        container.scrollLeft = 0;
      } else if (scrollLeft <= 0) {
        const originalDataWidth = (scrollWidth * data.length) / extendedData.length;
        container.scrollLeft = originalDataWidth;
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [scrollContainerRef, data.length, extendedData.length, updateActiveNodeByPosition]);

  return {
    autoScroll,
    currentIndex: currentIndexRef,
    toggleAutoScroll,
    startAutoScroll,
    pauseAutoScroll,
    scrollToNode,
    goToPrevious,
    goToNext,
    handleNodeClick
  };
};

const TimelineComponent: React.FC<{ data: TimelineItem[] }> = ({ data }) => {
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  const observerRefs = useRef<Map<string, IntersectionObserver>>(new Map());
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const prevNodeRef = useRef<string | null>(null);

  // 为了实现无缝循环，我们将数据复制一份，在末尾添加几项
  const repeatCount = 3; // 复制前3个节点来实现循环
  const extendedData = [...data, ...data.slice(0, repeatCount)];

  // Add visible scrollbar styles with correct type definitions
  const scrollbarStyles = {
    overflow: 'auto' as const,
    scrollbarWidth: 'none' as const, // 隐藏Firefox滚动条
    msOverflowStyle: 'none' as const, // 隐藏IE和旧版Edge滚动条
    paddingBottom: '12px',
  };

  // Define getImportanceColor and getImportanceText first as they're used in other functions
  const getImportanceColor = useCallback((importance?: string) => {
    switch (importance) {
      case 'high':
        return '#f5222d';
      case 'medium':
        return '#faad14';
      case 'low':
        return '#52c41a';
      default:
        return primaryColor;
    }
  }, []);

  const getImportanceText = useCallback((importance?: string) => {
    switch (importance) {
      case 'high':
        return '高度重要';
      case 'medium':
        return '中度重要';
      case 'low':
        return '一般重要';
      default:
        return '普通事件';
    }
  }, []);

  // 更新活动节点并添加过渡效果
  const updateActiveNode = useCallback((nodeId: string | null) => {
    if (nodeId === activeNode) return;

    prevNodeRef.current = activeNode;
    setTransitioning(true);
    setActiveNode(nodeId);

    // 延长一点过渡时间，使效果更明显
    setTimeout(() => {
      setTransitioning(false);
    }, 600);
  }, [activeNode]);

  // 使用自定义Hook管理自动滚动
  const {
    autoScroll,
    currentIndex,
    toggleAutoScroll,
    startAutoScroll,
    pauseAutoScroll,

    goToPrevious,
    goToNext,
    handleNodeClick
  } = useAutoScroll(
    data,
    extendedData,
    scrollContainerRef,
    nodeRefs,
    updateActiveNode,
    activeNode
  );

  // Enhanced mouse event handlers for smooth sliding
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;

    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
    scrollContainerRef.current.style.cursor = 'grabbing';
    scrollContainerRef.current.style.userSelect = 'none';

    // Pause auto-scrolling when user interacts
    pauseAutoScroll();
  };

  const handleMouseUp = () => {
    if (!scrollContainerRef.current) return;

    setIsDragging(false);
    scrollContainerRef.current.style.cursor = 'grab';
    scrollContainerRef.current.style.removeProperty('user-select');

    // Resume auto-scrolling when user stops interacting
    if (autoScroll) {
      startAutoScroll();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;

    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed multiplier
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  // Add keyboard navigation for accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!scrollContainerRef.current) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goToPrevious();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goToNext();
    }

    // Resume after a delay
    if (autoScroll) {
      setTimeout(() => {
        startAutoScroll();
      }, 5000);
    }
  };

  // Create an observer for a timeline node
  const observeNode = useCallback((nodeId: string, element: HTMLDivElement) => {
    if (!element || observerRefs.current.has(nodeId)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleItems((prev) => {
              const newSet = new Set(prev);
              newSet.add(nodeId);
              return newSet;
            });
          } else {
            setVisibleItems((prev) => {
              const newSet = new Set(prev);
              newSet.delete(nodeId);
              return newSet;
            });
          }
        });
      },
      { threshold: 0.1, rootMargin: '100px' },
    );

    observer.observe(element);
    observerRefs.current.set(nodeId, observer);
    nodeRefs.current.set(nodeId, element);

    return () => {
      observer.disconnect();
      observerRefs.current.delete(nodeId);
      nodeRefs.current.delete(nodeId);
    };
  }, []);

  // Clean up event listeners on unmount
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    if (scrollContainer) {
      const handleMouseLeave = () => {
        if (isDragging) setIsDragging(false);
        if (autoScroll) startAutoScroll();
      };

      scrollContainer.addEventListener('mouseleave', handleMouseLeave);

      return () => {
        scrollContainer.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, [isDragging, autoScroll, startAutoScroll]);

  // Clear observers when component unmounts
  useEffect(() => {
    return () => {
      observerRefs.current.forEach((observer) => {
        observer.disconnect();
      });
      observerRefs.current.clear();
    };
  }, []);

  // Initial setup - select first item
  useEffect(() => {
    if (data && data.length > 0 && !activeNode) {
      const firstNodeId = 'node-0';
      setActiveNode(firstNodeId);
    }
  }, [data, activeNode]);

  // 检查事件是否为主要事件（高重要性）
  const isMainEvent = useCallback((item: TimelineItem) => {
    return item.importance === 'high';
  }, []);

  if (!data || data.length === 0) {
    return <div className="empty-timeline">暂无时间轴数据</div>;
  }

  return (
    <div className="timeline-wrapper" style={{ height: '100%', overflow: 'auto' }}>
      <div className="timeline-controls">
        <Space>
          <Button
            type={autoScroll ? 'primary' : 'default'}
            size="small"
            onClick={toggleAutoScroll}
          >
            {autoScroll ? '禁用' : '启用'}自动滚动
          </Button>
          <Button
            type="default"
            shape="circle"
            icon={<LeftOutlined />}
            onClick={() => {
              goToPrevious();
              setTimeout(() => {
                if (autoScroll) startAutoScroll();
              }, 5000);
            }}
          />
          <Button
            type="default"
            shape="circle"
            icon={<RightOutlined />}
            onClick={() => {
              goToNext();
              setTimeout(() => {
                if (autoScroll) startAutoScroll();
              }, 5000);
            }}
          />
          <Text type="secondary">
            点击节点查看详情 ({currentIndex.current + 1}/{data.length})
            <Tooltip title="时间轴展示事件传播的关键时间点">
              <InfoCircleOutlined style={{ marginLeft: 8 }} />
            </Tooltip>
          </Text>
        </Space>
      </div>

      <div
        ref={scrollContainerRef}
        style={{
          ...scrollbarStyles,
          cursor: 'grab',
          position: 'relative',
        }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseUp}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className="timeline-container" style={{
          display: 'flex',
          minWidth: 'max-content',
          padding: '20px 10px',
        }}>

          <div style={{  transform: 'translateY(-20px)'}} className={`horizontal-timeline-container  ${autoScroll ? 'auto-scroll' : ''}`} >
          <div className="timeline-line" style={{  transform: 'translateY(-32px)'}}></div>
            <div className="timeline-track">


              {extendedData.map((item, index) => {
                const nodeId = `node-${index}`;
                const isActive = activeNode === nodeId;
                const isVisible = visibleItems.has(nodeId) || isActive;
                const originalIndex = index % data.length; // 用于标记是原始数据还是复制数据
                const mainEvent = isMainEvent(item);
                const isPrevActive = prevNodeRef.current === nodeId;

                return (
                  <div
                    key={nodeId}
                    className={`timeline-node-wrapper ${index >= data.length ? 'duplicate-node' : ''} ${
                      mainEvent ? 'main-event' : ''
                    } ${isActive ? 'active' : ''} ${isPrevActive ? 'prev-active' : ''} ${
                      transitioning && (isActive || isPrevActive) ? 'transitioning' : ''
                    }`}
                    style={{
                      animationDelay: `${originalIndex * 120}ms`,
                    }}
                    ref={(el) => el && observeNode(nodeId, el)}
                  >
                    <div className="timeline-node">
                      <div
                        className={`timeline-dot ${isActive ? 'current' : ''} ${
                          mainEvent ? 'main-event-dot' : ''
                        } ${
                          item.importance ? `importance-${item.importance}` : ''
                        }`}
                        data-date={item.date}
                        onClick={() => handleNodeClick(nodeId)}
                        style={{
                          transform: isActive ? 'scale(1.3)' : isPrevActive && transitioning ? 'scale(1.15)' : 'scale(1)',
                          transition: 'transform 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease',
                          boxShadow: isActive
                            ? mainEvent
                              ? '0 0 0 4px rgba(245, 34, 45, 0.2)'
                              : '0 0 0 4px rgba(30, 134, 242, 0.2)'
                            : 'none',
                        }}
                      />

                      <div className="timeline-label">
                        <Tag
                          color={isActive ? getImportanceColor(item.importance) : '#f0f0f0'}
                          style={{
                            borderRadius: 12,
                            padding: '2px 10px',
                            fontSize: '12px',
                            fontWeight: isActive ? 600 : 500,
                            whiteSpace: 'nowrap',
                            transition: 'all 0.3s ease',
                            cursor: 'pointer',
                            transform: isActive ? 'scale(1.05)' : isPrevActive && transitioning ? 'scale(1.02)' : 'scale(1)',
                            boxShadow: isActive ? '0 2px 8px rgba(0, 0, 0, 0.15)' : 'none',
                          }}
                          onClick={() => handleNodeClick(nodeId)}
                        >
                          {item.date} {item.time && <span>· {item.time}</span>}
                        </Tag>
                      </div>

                      <div
                        className={`timeline-card-container ${isActive ? 'active-card' : ''}`}
                        style={{
                          opacity: isActive ? 1 : isPrevActive && transitioning ? 0.85 : 0.7,
                          transform: isActive
                            ? 'translateY(0) scale(1)'
                            : isPrevActive && transitioning
                              ? 'translateY(2px) scale(0.99)'
                              : 'translateY(5px) scale(0.98)',
                          transition: 'all 0.3s ease',
                        }}
                      >
                        {/* Only render card content if the item is active or visible */}
                        {(isActive || isVisible) && (
                          <TimelineCard
                            item={item}
                            getImportanceColor={getImportanceColor}
                            getImportanceText={getImportanceText}
                            isActive={isActive}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>


      </div>

      <style>
        {`
        /* 隐藏Chrome, Safari和新版Edge的滚动条 */
        .timeline-wrapper ::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }

        .timeline-wrapper .active-timeline-card {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          border: 1px solid ${primaryColor};
        }
        .timeline-wrapper .main-event .timeline-dot.main-event-dot {
          animation: pulse 2s infinite;
        }
        .timeline-wrapper .main-event.active .timeline-dot.main-event-dot {
          animation: activePulse 2s infinite;
        }
        .timeline-wrapper .transitioning .timeline-dot {
          transition: all 0.4s ease !important;
        }
        .timeline-wrapper .transitioning.active .timeline-card-container {
          animation: fadeInUp 0.4s ease;
        }
        .timeline-wrapper .transitioning.prev-active .timeline-card-container {
          animation: fadeOutDown 0.4s ease;
        }
        .timeline-wrapper .timeline-node-wrapper.active {
          z-index: 10;
        }
        .timeline-wrapper .timeline-node-wrapper.transitioning {
          z-index: 5;
        }
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(245, 34, 45, 0.4);
          }
          70% {
            box-shadow: 0 0 0 6px rgba(245, 34, 45, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(245, 34, 45, 0);
          }
        }
        @keyframes activePulse {
          0% {
            box-shadow: 0 0 0 0 rgba(245, 34, 45, 0.7);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(245, 34, 45, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(245, 34, 45, 0);
          }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes fadeOutDown {
          from {
            opacity: 0.85;
            transform: translateY(2px) scale(0.99);
          }
          to {
            opacity: 0.7;
            transform: translateY(5px) scale(0.98);
          }
        }
        `}
      </style>
    </div>
  );
};

export default TimelineComponent;
