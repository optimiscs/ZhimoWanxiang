import {
  BarChartOutlined,
  CaretRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  FieldTimeOutlined,
  FileImageOutlined,
  FireOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  Tag as AntTag,
  Badge,
  Button,
  Card,
  Col,
  Progress,
  Row,
  Space,
  Statistic,
  Tooltip,
  Typography,
} from 'antd';
import { useRef, useState } from 'react';
import ReactPlayer from 'react-player';
import './style.css';

const { Title, Text, Paragraph } = Typography;

// 自定义标签组件
const Tag = ({
  children,
  color,
  icon,
}: {
  children: React.ReactNode;
  color: string;
  icon?: React.ReactNode;
}) => (
  <div className={`custom-tag ${color}`}>
    {icon && <span className="tag-icon">{icon}</span>}
    <span className="tag-text">{children}</span>
  </div>
);

// 关键帧接口
interface KeyFrame {
  time: number;
  thumbnail: string;
  title: string;
  description: string;
  tags: string[];
  importance: string;
  keywords: string[];
}

// 视频分析数据接口
interface VideoAnalysisData {
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  videoDuration: number;
  publishDate: string;
  keyframes: KeyFrame[];
}

// 组件Props接口
interface VideoAnalysisPanelProps {
  data: VideoAnalysisData;
}

// Alternative approach to import images that doesn't rely on webpack types
// Just define a map of image paths
const imageMap: Record<string, string> = {
  'tw1.png': '/public/tw/tw1.png',
  'tw17.png': '/public/tw/tw17.png',
  // Add other image files as needed
};

export const VideoAnalysisPanel: React.FC<VideoAnalysisPanelProps> = ({ data }) => {
  const playerRef = useRef<ReactPlayer>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [highlightedFrame, setHighlightedFrame] = useState<number | null>(null);
  const [viewedFrames, setViewedFrames] = useState<number[]>([]);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const keyframes = data?.keyframes || [];

  // 跳转到指定时间
  const seekTo = (seconds: number) => {
    playerRef.current?.seekTo(seconds);
    setHighlightedFrame(seconds);

    // 添加到已查看帧列表
    if (!viewedFrames.includes(seconds)) {
      setViewedFrames([...viewedFrames, seconds]);
    }

    // 3秒后取消高亮
    setTimeout(() => {
      setHighlightedFrame(null);
    }, 3000);
  };

  // 格式化时间
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  // 播放进度百分比
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  // 获取关键帧时间点的位置
  const getKeyframePosition = (time: number): number => {
    return duration > 0 ? (time / duration) * 100 : 0;
  };

  // 获取当前活跃帧
  const getActiveFrame = () => {
    if (!keyframes.length) return null;

    return keyframes
      .filter((frame) => currentTime >= frame.time)
      .reduce((prev, current) => (current.time > prev.time ? current : prev), keyframes[0]);
  };

  // 处理进度条点击
  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const percentage = offsetX / rect.width;
    const newTime = duration * percentage;

    playerRef.current?.seekTo(newTime);
  };

  // 获取重要性图标和颜色
  const getImportanceConfig = (importance: string) => {
    switch (importance) {
      case 'low':
        return { icon: <EyeOutlined />, color: 'blue' };
      case 'medium':
        return { icon: <ThunderboltOutlined />, color: 'orange' };
      case 'high':
        return { icon: <FireOutlined />, color: 'volcano' };
      case 'critical':
        return { icon: <ThunderboltOutlined />, color: 'red' };
      default:
        return { icon: <EyeOutlined />, color: 'blue' };
    }
  };

  // 计算已观看百分比
  const calculateViewedPercentage = () => {
    return Math.round((viewedFrames.length / keyframes.length) * 100);
  };

  // 当前活跃帧
  const activeFrame = getActiveFrame();

  // Function to get the correct image source
  const getImageSrc = (path: string): string => {
    // Check if the path is a URL (starts with http or https)
    if (path.startsWith('http') || path.startsWith('https')) {
      return path;
    }

    // Extract the filename from the path
    const filename = path.split('/').pop();

    // If the filename exists in our image map, return the mapped path
    if (filename && imageMap[filename]) {
      return imageMap[filename];
    }

    // For paths starting with public/
    if (path.startsWith('public/')) {
      return path.replace('public', '');
    }

    // For absolute paths starting with /
    if (path.startsWith('/')) {
      return path;
    }

    // For relative paths that point to the public directory
    return `/${path}`;
  };

  return (
    <div className="video-analysis-panel">
      {/* 视频播放器区域 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            bordered={false}
            className="player-card"
            title={
              <div className="player-card-title">
                <div className="player-stats">
                  <Badge status="processing" text="AI分析中" />
                  <Text type="secondary" style={{ marginLeft: 16 }}>
                    <ClockCircleOutlined /> 总时长: {formatTime(duration)}
                  </Text>
                </div>
              </div>
            }
          >
            <div className="video-player-container">
              <div className="video-player-wrapper">
                <ReactPlayer
                  ref={playerRef}
                  url={data?.videoUrl}
                  controls={false}
                  width="100%"
                  height="100%"
                  playing={playing}
                  onProgress={({ playedSeconds }) => setCurrentTime(playedSeconds)}
                  onDuration={setDuration}
                  config={{
                    youtube: {
                      playerVars: { showinfo: 0, controls: 0, modestbranding: 1 },
                    },
                  }}
                />

                {/* 自定义播放/暂停按钮 */}
                <div className="video-controls-overlay" onClick={() => setPlaying(!playing)}>
                  {!playing && (
                    <div className="play-button-container">
                      <PlayCircleOutlined className="play-button" />
                    </div>
                  )}
                </div>
              </div>

              {/* 自定义进度条 */}
              <div className="video-progress-container">
                <div
                  className="video-progress-bar"
                  ref={progressBarRef}
                  onClick={handleProgressBarClick}
                >
                  <div
                    className="video-progress-filled"
                    style={{ width: `${progressPercentage}%` }}
                  ></div>

                  {/* 关键帧标记 */}
                  {keyframes.map((frame, index) => (
                    <Tooltip
                      key={index}
                      title={
                        <div>
                          <div>
                            <strong>{frame.title}</strong> ({formatTime(frame.time)})
                          </div>
                          <div>{frame.description}</div>
                        </div>
                      }
                      placement="top"
                    >
                      <div
                        className={`keyframe-marker ${
                          highlightedFrame === frame.time ? 'active' : ''
                        }`}
                        style={{
                          left: `${getKeyframePosition(frame.time)}%`,
                          borderColor:
                            frame.importance === 'critical'
                              ? '#ff4d4f'
                              : frame.importance === 'high'
                              ? '#fa8c16'
                              : frame.importance === 'medium'
                              ? '#faad14'
                              : '#1890ff',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          seekTo(frame.time);
                        }}
                      ></div>
                    </Tooltip>
                  ))}
                </div>

                <div className="video-time-display">
                  <Text>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </Text>
                  <div className="video-controls">
                    <Button
                      type="primary"
                      size="small"
                      shape="round"
                      icon={playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                      onClick={() => setPlaying(!playing)}
                    >
                      {playing ? '暂停' : '播放'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* 当前分析信息 */}
            <div className="current-analysis-info">
              <div className="analysis-header">
                <Title level={5}>
                  <BarChartOutlined /> 当前分析点
                </Title>
                {activeFrame && (
                  <AntTag color={getImportanceConfig(activeFrame.importance).color}>
                    {getImportanceConfig(activeFrame.importance).icon}{' '}
                    {activeFrame.importance === 'critical'
                      ? '关键内容'
                      : activeFrame.importance === 'high'
                      ? '高度重要'
                      : activeFrame.importance === 'medium'
                      ? '中度重要'
                      : '一般内容'}
                  </AntTag>
                )}
              </div>

              <div>
                {activeFrame &&
                keyframes.find(
                  (frame) => currentTime >= frame.time && currentTime < frame.time + 10,
                ) ? (
                  <div className="current-keyframe-info">
                    <div className="keyframe-title">
                      <CaretRightOutlined className="keyframe-icon" />
                      <Text strong>{activeFrame.title}</Text>
                      <Badge status="processing" text="当前位置" style={{ marginLeft: 8 }} />
                    </div>
                    <Paragraph className="keyframe-description">
                      {activeFrame.description}
                    </Paragraph>
                    <div className="keyframe-meta">
                      <div className="keyframe-keywords">
                        <Text type="secondary">关键词：</Text>
                        {activeFrame.keywords.map((keyword, idx) => (
                          <AntTag key={idx} color="blue">
                            {keyword}
                          </AntTag>
                        ))}
                      </div>
                    </div>
                    <div className="keyframe-tags">
                      {activeFrame.tags.map((tag, idx) => (
                        <Tag key={idx} color="blue">
                          {tag}
                        </Tag>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Text type="secondary">暂无关键分析点</Text>
                )}
              </div>
            </div>

          </Card>
        </Col>

        {/* 关键帧展示区域 */}
        <Col xs={24} lg={8}>
          <Card
            bordered={false}
            className="keyframes-container"
            title={
              <div className="keyframes-title">
                <span>
                  <FileImageOutlined /> 关键画面分析
                </span>
                <Text type="secondary" className="keyframes-subtitle">
                  点击跳转至对应时间点
                </Text>
              </div>
            }
            extra={
              <Tooltip title="已查看关键点百分比">
                <Progress
                  type="circle"
                  percent={calculateViewedPercentage()}
                  width={36}
                  strokeColor={{
                    '0%': '#108ee9',
                    '100%': '#87d068',
                  }}
                />
              </Tooltip>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Row gutter={[0, 16]} style={{ marginBottom: 16 }}>
                <Col span={12}>
                  <Statistic
                    title="关键点总数"
                    value={keyframes.length}
                    prefix={<FieldTimeOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="已查看"
                    value={viewedFrames.length}
                    prefix={<CheckCircleOutlined />}
                    suffix={`/ ${keyframes.length}`}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
              </Row>

              <Row gutter={[12, 12]} className="keyframes-grid">
                {keyframes.map((frame, index) => {
                  const { icon } = getImportanceConfig(frame.importance);
                  return (
                    <Col xs={12} key={index}>
                      <Card
                        hoverable
                        className={`keyframe-card ${
                          viewedFrames.includes(frame.time) ? 'viewed' : ''
                        } ${highlightedFrame === frame.time ? 'highlighted' : ''}`}
                        cover={
                          <div className="keyframe-image-container">
                            <div
                              className="keyframe-image"
                              style={{
                                backgroundImage: `url(${getImageSrc(frame.thumbnail)})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                width: '100%',
                                height: '120px', // Adjust height as needed
                                borderRadius: '4px 4px 0 0'
                              }}
                            />
                            <img src={getImageSrc(frame.thumbnail)}  />
                            <div className="keyframe-time-badge">
                              <ClockCircleOutlined /> {formatTime(frame.time)}
                            </div>
                            <div
                              className={`keyframe-importance-badge importance-${frame.importance}`}
                            >
                              {icon}{' '}
                              {frame.importance === 'critical'
                                ? '关键'
                                : frame.importance === 'high'
                                ? '重要'
                                : frame.importance === 'medium'
                                ? '中等'
                                : '一般'}
                            </div>
                          </div>
                        }
                        onClick={() => seekTo(frame.time)}
                      >
                        <div className="keyframe-info">
                          <Text strong className="keyframe-card-title">
                            {frame.title}
                          </Text>
                          <div className="keyframe-status">
                            <Progress
                              type="circle"
                              percent={viewedFrames.includes(frame.time) ? 100 : 0}
                              width={20}
                              strokeWidth={10}
                              strokeColor={
                                viewedFrames.includes(frame.time) ? '#52c41a' : '#1890ff'
                              }
                              trailColor="#f0f0f0"
                              format={() => ''}
                            />
                            <Text type="secondary" className="keyframe-status-text">
                              {viewedFrames.includes(frame.time) ? '已查看' : '未查看'}
                            </Text>
                          </div>
                        </div>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default VideoAnalysisPanel;
