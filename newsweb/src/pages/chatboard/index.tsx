import {
  Attachments,
  Bubble,
  Prompts,
  Sender,
  Welcome,
  useXAgent,
  useXChat,
} from '@ant-design/x';
import { createStyles } from 'antd-style';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  ConfigProvider, Modal, Form, Input, Radio, Tabs, Progress,
  Badge, Button, type GetProp, Space, Spin, Popconfirm, message
} from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
// 直接使用html2canvas和jspdf
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// 导入图表组件
import { Pie, Column } from '@ant-design/plots';

// ReportData类型定义，匹配后端生成的报告结构
interface ReportData {
  meta: {
    title: string;
    subtitle?: string;
    reportId: string;
    generatedAt: string;
    version: string;
    confidenceLevel: number;
    analysisContext: string;
    keywords: string[];
  };
  executiveSummary: {
    keyFindings: string[];
    overallSentiment: {
      label: string;
      score: number;
      distribution: {
        positive: number;
        negative: number;
        neutral: number;
      }
    };
    heatLevel: number;
    impactLevel: number;
    topTrends: Array<{
      name: string;
      value: number;
      sentiment: string;
    }>;
    timespan: {
      start: string;
      end: string;
    }
  };
  detailedAnalysis: {
    sentimentAnalysis: {
      overview: string;
      details: Array<{
        dimension: string;
        score: number;
        description: string;
      }>;
      timeline: Array<{
        timestamp: string;
        sentiment: {
          positive: number;
          negative: number;
          neutral: number;
        }
      }>;
      emotionalFactors: Array<{
        factor: string;
        impact: number;
        description: string;
      }>;
    };
    topicAnalysis: {
      overview: string;
      mainTopics: Array<{
        topic: string;
        weight: number;
        sentiment: string;
        relatedKeywords: string[];
        sourceCount: number;
      }>;
      topicRelations: {
        nodes: Array<{
          id: string;
          name: string;
          value: number;
        }>;
        links: Array<{
          source: string;
          target: string;
          value: number;
        }>;
      };
      keywordCloud: Array<{
        word: string;
        weight: number;
        sentiment: string;
      }>;
    };
    propagationAnalysis: {
      overview: string;
      channels: Array<{
        name: string;
        volume: number;
        influence: number;
        sentiment: {
          positive: number;
          negative: number;
          neutral: number;
        }
      }>;
      timeline: Array<{
        timestamp: string;
        volume: number;
        channels: Array<{
          name: string;
          count: number;
        }>;
      }>;
      peakEvents: Array<{
        timestamp: string;
        title: string;
        description: string;
        impact: number;
      }>;
      geographicDistribution: Array<{
        region: string;
        value: number;
        sentiment: string;
      }>;
    };
    audienceAnalysis: {
      overview: string;
      demographics: Array<{
        type: string;
        groups: Array<{
          name: string;
          percentage: number;
        }>;
      }>;
      keyOpinions: Array<{
        opinion: string;
        supportRate: number;
        sourceGroups: string[];
      }>;
      engagementMetrics: Array<{
        metric: string;
        value: number;
        trend: string;
        percentage: number;
      }>;
    };
  };
  insightsAndRecommendations: {
    keyChallenges: Array<{
      challenge: string;
      severity: number;
      description: string;
    }>;
    opportunities: Array<{
      opportunity: string;
      potential: number;
      description: string;
    }>;
    recommendations: Array<{
      title: string;
      priority: string;
      description: string;
      expectedOutcome: string;
      timeframe: string;
    }>;
    riskAssessment: {
      riskLevel: string;
      potentialRisks: Array<{
        risk: string;
        probability: number;
        impact: number;
        mitigationStrategy: string;
      }>;
    };
  };
  analysisDetails: {
    methodologies: string[];
    dataSources: Array<{
      name: string;
      type: string;
      reliability: number;
      coverage: number;
    }>;
    limitations: string[];
    confidenceIntervals: Array<{
      metric: string;
      min: number;
      max: number;
      confidence: number;
    }>;
    analyticalModels: string[];
  };
  rawDataSummary: {
    totalSources: number;
    totalMessages: number;
    timeRange: {
      start: string;
      end: string;
    };
    sampleData: Array<{
      content: string;
      source: string;
      timestamp: string;
      sentiment: string;
      topics: string[];
    }>;
  };
}

import {
  CloudUploadOutlined,
  EllipsisOutlined,
  FireOutlined,
  PictureOutlined,
  PlusOutlined,
  ShareAltOutlined,
  LoadingOutlined,
  DeleteOutlined,
  FileTextOutlined,
  DownloadOutlined,
} from '@ant-design/icons';

import { streamChat } from '@/services/ant-design-pro/api';
import { ThinkingState } from '@/components';

// Define interfaces for types
interface StructuredMessage {
  bbox: number[];
  [key: string]: any;
}

// Custom payload for multimodal requests
interface MultimodalPayload {
  message: string;
  files: File[];
}

// 报告模板接口定义
interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  headerConfig: {
    title: string;
    showLogo: boolean;
    showDate: boolean;
    showSessionId: boolean;
  };
  contentConfig: {
    showAnalysisNumbers: boolean;
    showSentimentChart: boolean;
    showTopicChart: boolean;
    highlightKeywords: boolean;
  };
  footerConfig: {
    showCopyright: boolean;
    customText?: string;
  };
  visualConfig: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
}

// 预定义模板
const predefinedTemplates: ReportTemplate[] = [
  {
    id: 'default',
    name: '默认模板',
    description: '包含标准的舆情分析内容和基本图表',
    headerConfig: {
      title: '智能舆情分析报告',
      showLogo: true,
      showDate: true,
      showSessionId: true
    },
    contentConfig: {
      showAnalysisNumbers: true,
      showSentimentChart: true,
      showTopicChart: true,
      highlightKeywords: true
    },
    footerConfig: {
      showCopyright: true,
      customText: ''
    },
    visualConfig: {
      primaryColor: '#1677ff',
      secondaryColor: '#f0f0f0',
      accentColor: '#ff4d4f'
    }
  },
  {
    id: 'minimal',
    name: '简约模板',
    description: '简洁的报告样式，专注于文本内容',
    headerConfig: {
      title: '舆情简报',
      showLogo: false,
      showDate: true,
      showSessionId: false
    },
    contentConfig: {
      showAnalysisNumbers: false,
      showSentimentChart: false,
      showTopicChart: false,
      highlightKeywords: false
    },
    footerConfig: {
      showCopyright: true,
      customText: ''
    },
    visualConfig: {
      primaryColor: '#000000',
      secondaryColor: '#f5f5f5',
      accentColor: '#1677ff'
    }
  },
  {
    id: 'visual',
    name: '可视化模板',
    description: '强调数据可视化的报告模板',
    headerConfig: {
      title: '舆情数据分析',
      showLogo: true,
      showDate: true,
      showSessionId: true
    },
    contentConfig: {
      showAnalysisNumbers: true,
      showSentimentChart: true,
      showTopicChart: true,
      highlightKeywords: true
    },
    footerConfig: {
      showCopyright: true,
      customText: '本报告由AI自动生成，仅供参考'
    },
    visualConfig: {
      primaryColor: '#722ed1',
      secondaryColor: '#f0f5ff',
      accentColor: '#13c2c2'
    }
  }
];

// Helper function to safely convert File objects
const safelyConvertToFile = (obj: any): File | null => {
  if (obj instanceof File) {
    return obj;
  }
  return null;
};

// 添加会话项目的接口
interface ConversationItem {
  key: string;
  label: string;
  sessionId: string; // 会话ID是必需的
  // 添加下面这些可选属性使其更兼容Conversation类型
  group?: string;
  unread?: number;
  disabled?: boolean;
  selected?: boolean;
}

const useStyle = createStyles(({ token, css }) => {
  return {
    layout: css`
      width: 100%;
      min-width: 1000px;
      height: 100%;
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      border-radius: ${token.borderRadius}px;
      display: flex;
      background: ${token.colorBgContainer};
      font-family: AlibabaPuHuiTi, ${token.fontFamily}, sans-serif;
      overflow: hidden;

      .ant-prompts {
        color: ${token.colorText};
      }
    `,
    menu: css`
      background: ${token.colorBgLayout}80;
      width: 280px;
      height: 100%;
      display: flex;
      flex-direction: column;
    `,
    conversations: css`
      padding: 0 12px;
      flex: 1;
      overflow-y: auto;
    `,
    chat: css`
      height: 100%;
      width: 100%;
      max-width: 700px;
      margin: 0 auto;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      padding: ${token.paddingLG}px;
      gap: 16px;
    `,
    messages: css`
      flex: 1;
    `,
    placeholder: css`
      padding-top: 32px;
    `,
    sender: css`
      box-shadow: ${token.boxShadow};
    `,
    logo: css`
      display: flex;
      height: 72px;
      align-items: center;
      justify-content: start;
      padding: 0 24px;
      box-sizing: border-box;

      img {
        width: 24px;
        height: 24px;
        display: inline-block;
      }

      span {
        display: inline-block;
        margin: 0 8px;
        font-weight: bold;
        color: ${token.colorText};
        font-size: 16px;
      }
    `,
    addBtn: css`
      background: #1677ff0f;
      border: 1px solid #1677ff34;
      width: calc(100% - 24px);
      margin: 0 12px 24px 12px;
    `,
    markdownContent: css`
      /* Apply a base line-height to the container for consistency */
      line-height: 1.6; \
      margin: 0;\
      white-space: pre-wrap;\
      word-break: break-word;\

      /* 通用样式 */\
      p {\
        /* Keep margin for paragraph separation, but ensure it doesn't look too spaced out */\
        margin-top: 0; \
        margin-bottom: 0.8em; /* Use em for spacing relative to font size */\
        /* line-height is inherited from container, or can be set specifically */\
        /* line-height: 1.6; */\
      }\

      a {
        color: ${token.colorPrimary};
        text-decoration: none;
        &:hover {
          text-decoration: underline;
        }
      }

      /* 列表样式 */
      ul, ol {
        margin-left: 16px;
        margin-bottom: 16px;
        padding-left: 8px;
      }

      li {
        margin-bottom: 4px;
      }

      /* 代码块样式 */
      pre {
        background-color: ${token.colorBgTextHover};
        border-radius: 4px;
        padding: 12px;
        overflow-x: auto;
        margin: 12px 0;
      }

      code {
        font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
        font-size: 0.9em;
        background-color: ${token.colorBgTextHover};
        padding: 2px 4px;
        border-radius: 3px;
      }

      pre code {
        padding: 0;
        background: none;
      }

      /* 表格样式 */
      table {
        border-collapse: collapse;
        width: 100%;
        margin: 16px 0;
      }

      th, td {
        border: 1px solid #ddd;
        padding: 8px;
      }

      th {
        background-color: ${token.colorBgTextHover};
        font-weight: 600;
        text-align: left;
      }

      /* 引用样式 */
      blockquote {
        border-left: 4px solid ${token.colorPrimary}30;
        padding-left: 16px;
        margin: 16px 0;
        color: ${token.colorTextSecondary};
      }

      /* 图片样式 */
      img {
        max-width: 100%;
        height: auto;
        border-radius: 4px;
        margin: 8px 0;
      }

      /* 标题样式 */
      h1, h2, h3, h4, h5, h6 {
        margin-top: 24px;
        margin-bottom: 16px;
        font-weight: 600;
        line-height: 1.25;
      }

      h1 {
        font-size: 2em;
        border-bottom: 1px solid ${token.colorBorder};
        padding-bottom: 0.3em;
      }

      h2 {
        font-size: 1.5em;
        border-bottom: 1px solid ${token.colorBorder};
        padding-bottom: 0.3em;
      }

      h3 {
        font-size: 1.25em;
      }

      h4 {
        font-size: 1em;
      }

      h5 {
        font-size: 0.875em;
      }

      h6 {
        font-size: 0.85em;
        color: ${token.colorTextSecondary};
      }

      /* 水平线 */
      hr {
        height: 0.25em;
        padding: 0;
        margin: 24px 0;
        background-color: ${token.colorBorder};
        border: 0;
      }
    `,
    // 报告相关样式
    reportContainer: css`
      padding: 30px;
      background: white;
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
    `,
    reportTitle: css`
      font-size: 28px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 30px;
      color: #262626;
    `,
    reportHeader: css`
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      border-bottom: 1px solid #f0f0f0;
      padding-bottom: 15px;

      p {
        margin: 5px 0;
        color: #595959;
      }
    `,
    reportContent: css`
      margin-bottom: 30px;
    `,
    reportFooter: css`
      text-align: center;
      font-size: 12px;
      color: #8c8c8c;
      border-top: 1px solid #f0f0f0;
      padding-top: 15px;
      margin-top: 30px;
    `,
    chartContainer: css`
      margin: 25px 0;
      padding: 20px;
      border: 1px solid #f0f0f0;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

      h3 {
        margin-top: 0;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 1px dashed #e8e8e8;
        color: #262626;
      }
    `,
    statsContainer: css`
      margin: 20px 0;
      padding: 15px;
      background-color: #fafafa;
      border-radius: 8px;

      h3 {
        margin-top: 0;
        margin-bottom: 15px;
        color: #262626;
      }
    `,
    statCard: css`
      text-align: center;
      padding: 15px;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      width: 30%;
    `,
    statValue: css`
      font-size: 24px;
      font-weight: bold;
      color: #1677ff;
      margin-bottom: 5px;
    `,
    statLabel: css`
      font-size: 14px;
      color: #8c8c8c;
    `,
    templateContainer: css`
      margin-bottom: 20px;
    `,
    templateCard: css`
      border: 1px solid #f0f0f0;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 10px;
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        border-color: #1677ff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.09);
      }

      &.selected {
        border-color: #1677ff;
        background-color: #e6f7ff;
      }
    `,
    templateTitle: css`
      font-weight: bold;
      margin-bottom: 5px;
    `,
    templateDesc: css`
      color: #8c8c8c;
      font-size: 12px;
    `,
  };
});

const renderTitle = (icon: React.ReactElement, title: string) => (
  <Space align="start">
    {icon}
    <span>{title}</span>
  </Space>
);

// Base64 转换函数
const convertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
  });
};

// 提前声明的组件
// 情感分析饼图组件
const SentimentPieChart: React.FC<{ data: any[] }> = ({ data }) => {
  const config = {
    appendPadding: 10,
    data,
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    label: {
      type: 'outer',
      content: '{name} {percentage}',
    },
    interactions: [{ type: 'pie-legend-active' }, { type: 'element-active' }],
    legend: {
      position: 'bottom',
    },
    tooltip: {
      formatter: (datum: any) => {
        return { name: datum.type, value: `${datum.value}%` };
      },
    },
    color: ({ type }: { type: string }) => {
      if (type === '正面') return '#52c41a';
      if (type === '负面') return '#f5222d';
      return '#1677ff';
    },
  };

  return <Pie {...config} />;
};

// 热门话题柱状图组件
const TopicColumnChart: React.FC<{ data: any[] }> = ({ data }) => {
  const config = {
    data,
    xField: 'value',
    yField: 'topic',
    seriesField: 'topic',
    legend: {
      position: 'top',
    },
    tooltip: {
      formatter: (datum: any) => {
        return { name: datum.topic, value: datum.value };
      },
    },
    color: ['#1677ff', '#13c2c2', '#52c41a', '#fa8c16', '#722ed1']
  };

  return <Column {...config} />;
};

// 热门趋势图表组件
const TopTrendsChart: React.FC<{ data: ReportData['executiveSummary']['topTrends'] }> = ({ data }) => {
  const config = {
    data,
    xField: 'value',
    yField: 'name',
    seriesField: 'sentiment',
    legend: {
      position: 'top',
    },
    tooltip: {
      formatter: (datum: any) => {
        return { name: datum.name, value: datum.value };
      },
    },
    color: ({ sentiment }: { sentiment: string }) => {
      if (sentiment === '正面') return '#52c41a';
      if (sentiment === '负面') return '#f5222d';
      return '#1677ff';
    },
  };

  return <Column {...config} />;
};

// 情感维度图表组件
const SentimentDimensionsChart: React.FC<{ data: ReportData['detailedAnalysis']['sentimentAnalysis']['details'] }> = ({ data }) => {
  const config = {
    data,
    xField: 'score',
    yField: 'dimension',
    tooltip: {
      formatter: (datum: any) => {
        return {
          name: datum.dimension,
          value: datum.score,
          description: datum.description
        };
      },
    },
    color: '#1677ff',
    barBackground: { fill: '#f6f6f6' },
    barStyle: {
      radius: [10, 10, 0, 0],
    },
  };

  return <Column {...config} />;
};

// 情感因素图表组件
const EmotionalFactorsChart: React.FC<{ data: ReportData['detailedAnalysis']['sentimentAnalysis']['emotionalFactors'] }> = ({ data }) => {
  const config = {
    data: data.sort((a, b) => b.impact - a.impact), // 根据影响程度排序
    xField: 'impact',
    yField: 'factor',
    seriesField: 'factor',
    tooltip: {
      formatter: (datum: any) => {
        return {
          name: datum.factor,
          value: datum.impact,
          description: datum.description
        };
      },
    },
    color: ({ impact }: { impact: number }) => {
      if (impact > 0) return '#52c41a';
      return '#f5222d';
    },
  };

  return <Column {...config} />;
};

// 话题关系网络图组件
const TopicRelationGraph: React.FC<{ data: ReportData['detailedAnalysis']['topicAnalysis']['topicRelations'] }> = ({ data }) => {
  // 使用简单的Column组件替代Graph组件
  const nodes = data.nodes || [];
  const formattedData = nodes.map(node => ({
    name: node.name,
    value: node.value
  }));

  const config = {
    data: formattedData,
    xField: 'name',
    yField: 'value',
    tooltip: {
      formatter: (datum: any) => {
        return { name: datum.name, value: datum.value };
      },
    },
    color: '#1677ff',
  };

  return <Column {...config} />;
};

// 关键词云图组件
const KeywordCloudChart: React.FC<{ data: ReportData['detailedAnalysis']['topicAnalysis']['keywordCloud'] }> = ({ data }) => {
  // 使用简单的Column组件替代WordCloud组件
  const formattedData = data.slice(0, 10).map(item => ({
    word: item.word,
    weight: item.weight,
    sentiment: item.sentiment || '中性'
  }));

  const config = {
    data: formattedData,
    xField: 'weight',
    yField: 'word',
    seriesField: 'sentiment',
    tooltip: {
      formatter: (datum: any) => {
        return { name: datum.word, value: datum.weight, sentiment: datum.sentiment };
      },
    },
    color: ({ sentiment }: { sentiment: string }) => {
      if (sentiment === '正面') return '#52c41a';
      if (sentiment === '负面') return '#f5222d';
      return '#1677ff';
    },
  };

  return <Column {...config} />;
};

// 传播渠道图表组件
const ChannelsChart: React.FC<{ data: ReportData['detailedAnalysis']['propagationAnalysis']['channels'] }> = ({ data }) => {
  const config = {
    data,
    xField: 'name',
    yField: 'volume',
    tooltip: {
      formatter: (datum: any) => {
        return {
          name: datum.name,
          value: datum.volume,
          influence: datum.influence,
          sentiment: `正面: ${datum.sentiment.positive}%, 负面: ${datum.sentiment.negative}%, 中性: ${datum.sentiment.neutral}%`
        };
      },
    },
    color: '#1677ff',
    columnStyle: {
      radius: [10, 10, 0, 0],
    },
  };

  return <Column {...config} />;
};

// 传播时间线图表组件
const PropagationTimelineChart: React.FC<{ data: ReportData['detailedAnalysis']['propagationAnalysis']['timeline'] }> = ({ data }) => {
  // 简化数据以使用Line组件
  const formattedData = data.map(item => ({
    date: new Date(item.timestamp).toLocaleDateString(),
    volume: item.volume
  }));

  const config = {
    data: formattedData,
    xField: 'date',
    yField: 'volume',
    point: {
      size: 5,
      shape: 'diamond',
    },
    tooltip: {
      formatter: (datum: any) => {
        return { name: '信息量', value: datum.volume };
      },
    },
  };

  return <Column {...config} />;
};

const placeholderPromptsItems: GetProp<typeof Prompts, 'items'> = [
  {
    key: '1',
    label: renderTitle(<PictureOutlined style={{ color: '#1890FF' }} />, '多模态分析'),
    description: '上传图片进行舆情分析和谣言检测',
    children: [
      {
        key: '1-1',
        description: '分析这张图片中的舆情风险',
      },
      {
        key: '1-2',
        description: '检测图片中的谣言信息',
      },
      {
        key: '1-3',
        description: '分析图片中的情感倾向',
      },
    ],
  },
  {
    key: '2',
    label: renderTitle(<FireOutlined style={{ color: '#FF4D4F' }} />, '热点分析'),
    description: '分析当前热点事件的舆情走势',
    children: [
      {
        key: '2-1',
        description: '分析最近的金融舆情热点',
      },
      {
        key: '2-2',
        description: '识别潜在的舆情风险事件',
      },
      {
        key: '2-3',
        description: '生成危机公关应对策略',
      },
    ],
  },
];

const senderPromptsItems: GetProp<typeof Prompts, 'items'> = [
  {
    key: '1',
    description: '分析这张图片中的舆情风险',
    icon: <PictureOutlined style={{ color: '#1890FF' }} />,
  },
  {
    key: '2',
    description: '检测图片中的谣言信息',
    icon: <PictureOutlined style={{ color: '#1890FF' }} />,
  },
  {
    key: '3',
    description: '进行十六维情感立场分析',
    icon: <PictureOutlined style={{ color: '#1890FF' }} />,
  },
  {
    key: '4',
    description: '生成危机公关策略',
    icon: <FireOutlined style={{ color: '#FF4D4F' }} />,
  },
];

const roles: GetProp<typeof Bubble.List, 'roles'> = {
  ai: {
    placement: 'start',
    typing: { step: 5, interval: 20 },
    styles: {
      content: {
        borderRadius: 16,
      },
    },
  },
  local: {
    placement: 'end',
    variant: 'shadow',
  },
};

const Independent: React.FC = () => {
  // ==================== Style ====================
  const { styles } = useStyle();

  // ==================== State ====================
  const [headerOpen, setHeaderOpen] = useState(false);
  const [content, setContent] = useState('');
  const [conversationsItems, setConversationsItems] = useState<ConversationItem[]>([]);
  const [activeKey, setActiveKey] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<GetProp<typeof Attachments, 'items'>>([]);
  // 简化状态管理，移除冗余状态
  const [messages, setMessages] = useState<{
    id: string;
    message: string;
    status: string;
    isThinking?: boolean;
    thinkingState?: { status: string; message: string };
  }[]>([]);
  // 添加会话ID状态，用于API调用
  const [sessionId, setSessionId] = useState<string>('');
  // 添加加载状态
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportContent, setReportContent] = useState<React.ReactNode | null>(null);
  const reportContainerRef = useRef<HTMLDivElement>(null);

  // 报告模板相关状态
  const [templates] = useState<ReportTemplate[]>(predefinedTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('default');
  const [customTemplate, setCustomTemplate] = useState<ReportTemplate | null>(null);

  // 添加结构化报告数据状态
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState<boolean>(false);
  const [reportProgress, setReportProgress] = useState<number>(0);
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);

  // 添加思考状态变量
  const [isThinking, setIsThinking] = useState<boolean>(false);

  // 添加 targetRef 变量定义，与 reportContainerRef 类似
  const targetRef = useRef<HTMLDivElement>(null);

  // 移除旧的agentRequestHandler实现，使用更简单的逻辑，直接内联agent定义
  // 修改agent定义，不使用useCallback
  const [agent] = useXAgent({
    request: async (info: string | MultimodalPayload, { onSuccess, onError, onUpdate }) => {
      try {
        console.log('agent.request被调用，当前sessionId:', sessionId);

        // 直接使用当前组件状态中的sessionId
        // 而不是依赖闭包捕获
        if (!sessionId) {
          console.error('缺少必要的会话ID，请刷新页面或创建新会话');
          throw new Error('缺少必要的会话ID');
        }

        // 创建请求体
        let requestBody: any = {};
        if (typeof info === 'string') {
          requestBody = { message: info };
        } else if (info && typeof info === 'object') {
          requestBody = { message: info.message || '' };

          if (info.files && info.files.length > 0) {
            const imageBase64Array: string[] = [];

            await Promise.all(
              info.files.map(async (file) => {
                try {
                  const base64Data = await convertToBase64(file);
                  imageBase64Array.push(base64Data);
                } catch (error) {
                  console.error('文件转换失败:', error);
                }
              })
            );

            requestBody.images = imageBase64Array;
          }
        }

        // 记录API调用详情
        console.log('调用API，sessionId:', sessionId);

        // 直接调用API
        await streamChat(
          requestBody,
          {
            sessionId, // 使用最新的sessionId
            onThinking: () => setIsThinking(true),
            onUpdate: (data) => {
              setIsThinking(false);
              onUpdate?.(data);
            },
            onSuccess: (data) => {
              setIsThinking(false);
              onSuccess?.(data);
            },
            onError: (error) => {
              setIsThinking(false);
              console.error('API Error:', error);
              onError?.(error);
            }
          }
        );
      } catch (error) {
        setIsThinking(false);
        console.error('Request Failed:', error);
        onError?.(error instanceof Error ? error : new Error('Unknown error'));
      }
    }
  });

  // 使用Ant Design X的聊天组件，连接自定义agent
  useXChat({
    agent,
  });

  // 自定义请求处理函数
  const onRequest = async (info: string | MultimodalPayload) => {
    console.log("开始请求:", typeof info === 'string' ? info : info.message);

    // 检查会话ID，这是必需的
    if (!sessionId) {
      // 尝试立即创建新会话
      message.loading('当前没有会话ID，正在创建新会话...');
      const newSessionId = await createNewSession();
      if (!newSessionId) {
        message.error('无法创建会话，请刷新页面重试');
        return;
      }
      message.success('已创建新会话，正在处理您的请求');
    }

    console.log('发送请求前检查sessionId:', sessionId);

    // 准备用户消息和图片
    let userMessage: string;
    let imageBase64Array: string[] = [];

    if (typeof info === 'string') {
      userMessage = info;
    } else {
      userMessage = info.message || '';

      // 处理图片文件
      if (info.files && info.files.length > 0) {
        try {
          // 转换所有图片为base64
          await Promise.all(
            info.files.map(async (file) => {
              try {
                const base64Data = await convertToBase64(file);
                imageBase64Array.push(base64Data);
              } catch (error) {
                console.error('文件转换失败:', error);
              }
            })
          );
        } catch (error) {
          console.error('处理图片失败:', error);
        }
      }
    }

    // 生成唯一消息ID
    const userMessageId = Date.now().toString();

    // 立即添加用户消息到界面
    setMessages(prev => [
      ...prev,
      {
        id: userMessageId,
        message: userMessage,
        status: 'local'
      }
    ]);

    // 准备AI响应
    const aiMessageId = (Date.now() + 1).toString();

    // 添加一个占位的AI消息
    setMessages(prev => [
      ...prev,
      {
        id: aiMessageId,
        message: '',
        status: 'loading',
        isThinking: true,
        thinkingState: {
          status: 'thinking',
          message: '🧠 AI正在思考...'
        }
      }
    ]);

    try {
      // 确保在请求前logging最新的会话ID
      console.log('API请求详情:', {
        requestType: typeof info === 'string' ? 'text' : 'multimodal',
        userMessage: userMessage.substring(0, 100) + (userMessage.length > 100 ? '...' : ''),
        hasImages: imageBase64Array.length > 0,
        sessionId: sessionId,
        requestTime: new Date().toISOString()
      });

      // 直接调用streamChat，不使用agent.request中转，避免闭包问题
      const requestBody = {
        message: typeof info === 'string' ? info : info.message || '',
        images: imageBase64Array.length > 0 ? imageBase64Array : undefined
      };

      console.log('直接调用API，使用sessionId:', sessionId);

      // 直接调用API
      await streamChat(
        requestBody,
        {
          sessionId: sessionId, // 直接使用当前状态中的sessionId
          onThinking: () => {
            setIsThinking(true);
          },
          onUpdate: (data) => {
            setIsThinking(false);
            // 更新AI消息
            setMessages(prev => {
              const updatedMessages = [...prev];
              const aiMessageIndex = updatedMessages.findIndex(msg => msg.id === aiMessageId);
              if (aiMessageIndex !== -1) {
                updatedMessages[aiMessageIndex] = {
                  ...updatedMessages[aiMessageIndex],
                  message: updatedMessages[aiMessageIndex].message + (data.content || ''),
                  status: 'ai',
                  isThinking: false
                };
              }
              return updatedMessages;
            });
          },
          onSuccess: (fullResponse) => {
            setIsThinking(false);
            console.log('请求成功完成, 内容长度:', fullResponse?.content?.length || 0);
          },
          onError: (error) => {
            setIsThinking(false);
            console.error('API错误:', error);
            // 更新AI消息为错误状态
            setMessages(prev => {
              const updatedMessages = [...prev];
              const aiMessageIndex = updatedMessages.findIndex(msg => msg.id === aiMessageId);
              if (aiMessageIndex !== -1) {
                updatedMessages[aiMessageIndex] = {
                  ...updatedMessages[aiMessageIndex],
                  message: `错误: ${error.message || '未知错误'}`,
                  status: 'ai',
                  isThinking: false
                };
              }
              return updatedMessages;
            });
          }
        }
      );
    } catch (error) {
      console.error('请求失败:', error);
      message.error('发送消息失败，请稍后再试');
      // 更新AI消息为错误状态
      setMessages(prev => {
        const updatedMessages = [...prev];
        const aiMessageIndex = updatedMessages.findIndex(msg => msg.id === aiMessageId);
        if (aiMessageIndex !== -1) {
          updatedMessages[aiMessageIndex] = {
            ...updatedMessages[aiMessageIndex],
            message: `发送失败: ${error instanceof Error ? error.message : '未知错误'}`,
            status: 'ai',
            isThinking: false
          };
        }
        return updatedMessages;
      });
    }
  };

  // 修改createNewSession函数以返回会话ID
  const createNewSession = async (): Promise<string | null> => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/v1/chat/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ initialize_conversation: true }),
      });

      const data = await response.json();

      if (data.success && data.data?._id) {
        const newSessionId: string = data.data._id;
        setSessionId(newSessionId);

        // 创建新会话条目
        const newKey = String(conversationsItems.length);
        const newConversation: ConversationItem = {
          key: newKey,
          label: data.data.title || `新会话 ${conversationsItems.length + 1}`,
          sessionId: newSessionId
        };

        // 更新会话列表并设置为活动会话
        setConversationsItems(prev => [...prev, newConversation]);
        setActiveKey(newKey);

        // 清空当前消息
        setMessages([]);
        setIsThinking(false);

        console.log('创建新会话成功:', newSessionId);

        // 返回创建的会话ID
        return newSessionId;
      } else {
        console.error('创建会话失败:', data);
        message.error(data.error || '创建会话失败');
        return null;
      }
    } catch (error) {
      console.error('创建会话请求失败:', error);
      message.error('创建会话失败，请稍后再试');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // 修改fetchConversations函数以确保有会话ID
  const fetchConversations = async (): Promise<string | null> => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/v1/chat/sessions', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        // 转换会话数据为组件需要的格式
        const conversations = data.data.map((session: any, index: number) => ({
          key: String(index),
          label: session.title || `会话 ${index + 1}`,
          sessionId: session._id
        }));

        setConversationsItems(conversations);

        // 如果有会话，选择第一个作为活动会话
        if (conversations.length > 0) {
          setActiveKey(conversations[0].key);
          setSessionId(conversations[0].sessionId);
          // 加载该会话的历史消息
          fetchChatHistory(conversations[0].sessionId);
          return conversations[0].sessionId;
        } else {
          // 如果没有会话，创建一个新会话
          return await createNewSession();
        }
      } else {
        console.error('加载会话列表失败:', data);
        // 如果加载失败，创建一个新会话
        return await createNewSession();
      }
    } catch (error) {
      console.error('获取会话列表失败:', error);
      // 发生错误时创建新会话
      return await createNewSession();
    } finally {
      setIsLoading(false);
    }
  };

  // 获取特定会话的聊天历史
  const fetchChatHistory = async (chatSessionId: string) => {
    if (!chatSessionId) return;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/v1/chat/sessions/${chatSessionId}/messages`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        // 清空当前消息
        setMessages([]);
        setIsThinking(false);

        // 处理并加载历史消息
        const historyMessages = data.data
          .filter((msg: any) => msg.role !== 'system') // 过滤掉系统消息
          .map((msg: any, index: number) => ({
            id: String(index),
            message: msg.content,
            status: msg.role === 'user' ? 'local' : 'ai',
          }));

        // 设置消息
        if (historyMessages.length > 0) {
          setMessages(historyMessages);
        }
      } else {
        console.error('加载聊天历史失败:', data);
        message.error(data.error || '加载聊天历史失败');
      }
    } catch (error) {
      console.error('获取聊天历史失败:', error);
      message.error('获取聊天历史失败，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };

  // 后端导出作为备选方案
  const exportReportViaBackend = async () => {
    if (!reportData) return;

    message.loading({ content: '正在通过服务器生成PDF...', key: 'pdfExport', duration: 0 });

    // 使用后端导出API
    const response = await fetch('/api/v1/reports/export-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reportData }),
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || '服务器导出PDF失败');
      } catch (parseError) {
        throw new Error('服务器导出PDF失败');
      }
    }

    // 下载服务器生成的文件
    const contentDisposition = response.headers.get('content-disposition');
    let filename = '舆情分析报告.pdf';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]*)"?/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    message.success({ content: '报告导出成功', key: 'pdfExport' });
  };

  // 设置函数引用
  // createNewSessionFn = createNewSession;
  // fetchChatHistoryFn = fetchChatHistory;
  // exportReportViaBackendFn = exportReportViaBackend;

  // 更新初始化逻辑
  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('开始初始化会话...');
        setIsLoading(true);

        // 直接创建新会话，确保有会话ID
        const newSessionId = await createNewSession();

        if (!newSessionId) {
          console.error('初始化失败: 无法创建会话');
          message.error('初始化失败，无法创建会话，请刷新页面');
        } else {
          console.log('初始化成功，新的会话ID:', newSessionId);
          // 记录会话ID到localStorage，作为备份
          try {
            localStorage.setItem('lastSessionId', newSessionId);
          } catch (e) {
            console.warn('无法保存会话ID到localStorage', e);
          }
        }
      } catch (error) {
        console.error('初始化聊天失败:', error);
        message.error('初始化失败，请刷新页面重试');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  // 修改exportReport函数，使用html2canvas和jspdf直接实现导出功能
  const exportReport = async () => {
    try {
      message.loading({ content: '正在生成PDF报告...', key: 'pdfExport', duration: 0 });
      setIsLoadingReport(true);

      if (!reportData) {
        message.error({ content: '报告数据不存在', key: 'pdfExport' });
        setIsLoadingReport(false);
        return;
      }

      // 确保报告容器存在
      if (!reportContainerRef.current) {
        message.error({ content: '报告内容未准备好', key: 'pdfExport' });
        setIsLoadingReport(false);
        return;
      }

      // 使用html2canvas捕获报告内容
      const canvas = await html2canvas(reportContainerRef.current, {
        scale: 2, // 提高清晰度
        useCORS: true, // 允许加载跨域图片
        logging: false,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      // 创建PDF文档
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // 计算适当的尺寸
      const imgWidth = 210; // A4宽度210mm
      const pageHeight = 297; // A4高度297mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // 添加第一页
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // 如果内容超过一页，添加更多页面
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // 保存PDF
      pdf.save('舆情分析报告.pdf');

      message.success({ content: '报告导出成功', key: 'pdfExport' });
    } catch (error) {
      console.error('导出报告失败', error);
      message.error({
        content: `导出报告失败: ${error instanceof Error ? error.message : '未知错误'}`,
        key: 'pdfExport'
      });

      // 尝试使用后端导出作为备选方案
      try {
        await exportReportViaBackend();
      } catch (backendError) {
        console.error('后端导出也失败了', backendError);
      }
    } finally {
      setIsLoadingReport(false);
    }
  };

  // 当切换会话时加载历史信息
  useEffect(() => {
    if (activeKey !== '' && sessionId) {
      // 已在 onConversationClick 中处理了历史加载，这里仅作为备用检查
      // 如果需要可以在这里添加其他逻辑
    }
  }, [activeKey, sessionId]);

  // 修改会话添加处理函数
  const onAddConversation = () => {
    createNewSession();
  };

  // 修改会话点击处理函数
  const onConversationClick = (key: string) => {
    // 查找会话
    const conversation = conversationsItems.find(item => item.key === key);

    if (conversation) {
      // 设置活动会话
      setActiveKey(key);
      setSessionId(conversation.sessionId);
      // 加载该会话的历史消息
      fetchChatHistory(conversation.sessionId);
    }
  };

  // 渲染结构化报告
  const renderStructuredReport = (data: ReportData) => {
    if (!data) return;

    // 获取选中的模板
    const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];
    const template = customTemplate || selectedTemplate;

    // 应用模板样式
    const primaryColor = template.visualConfig.primaryColor;
    const secondaryColor = template.visualConfig.secondaryColor;
    const accentColor = template.visualConfig.accentColor;

    // 转换情感分布数据为图表格式
    const sentimentChartData = [
      { type: '正面', value: data.executiveSummary.overallSentiment.distribution.positive },
      { type: '负面', value: data.executiveSummary.overallSentiment.distribution.negative },
      { type: '中性', value: data.executiveSummary.overallSentiment.distribution.neutral }
    ];

    // 转换主题数据为图表格式
    const topicChartData = data.detailedAnalysis.topicAnalysis.mainTopics.map(topic => ({
      topic: topic.topic,
      value: topic.weight
    }));

    // 创建报告内容 - 同时使用两个ref以支持两种导出方式
    const report = (
      <div
        className={styles.reportContainer}
        ref={(node) => {
          // 同时设置两个ref
          if (node) {
            // @ts-ignore - 接口不完全匹配
            targetRef.current = node;
            // @ts-ignore - 接口不完全匹配
            reportContainerRef.current = node;
          }
        }}
        style={{
          borderTop: `4px solid ${primaryColor}`,
          backgroundColor: 'white'
        }}
      >
        {/* 报告标题 */}
        <div
          className={styles.reportTitle}
          style={{ color: primaryColor }}
        >
          {data.meta.title}
        </div>

        {/* 报告副标题 */}
        {data.meta.subtitle && (
          <div style={{
            textAlign: 'center',
            fontSize: '18px',
            marginBottom: '20px',
            color: '#666'
          }}>
            {data.meta.subtitle}
          </div>
        )}

        {/* 报告头部 */}
        <div
          className={styles.reportHeader}
          style={{ borderBottomColor: secondaryColor }}
        >
          <div>
            {template.headerConfig.showLogo && (
              <div style={{ marginBottom: '15px' }}>
                <img
                  src="https://mdn.alipayobjects.com/huamei_iwk9zp/afts/img/A*eco6RrQhxbMAAAAAAAAAAAAADgCCAQ/original"
                  style={{ width: '24px', height: '24px', marginRight: '8px', verticalAlign: 'middle' }}
                  alt="Logo"
                />
                <span style={{ verticalAlign: 'middle', fontWeight: 'bold' }}>舆情智能分析系统</span>
              </div>
            )}
            {template.headerConfig.showDate && (
              <p>生成时间: {new Date(data.meta.generatedAt).toLocaleString()}</p>
            )}
            {template.headerConfig.showSessionId && <p>会话ID: {sessionId}</p>}
            <p>报告ID: {data.meta.reportId}</p>
            <p>报告版本: {data.meta.version}</p>
            <p>可信度: {(data.meta.confidenceLevel * 100).toFixed(0)}%</p>
          </div>
        </div>

        {/* 报告内容 */}
        <div className={styles.reportContent}>
          {/* 执行摘要 */}
          <div className={styles.chartContainer}>
            <h2 style={{ color: primaryColor }}>执行摘要</h2>

            {/* 关键发现 */}
            <div style={{ marginBottom: '20px' }}>
              <h3>关键发现</h3>
              <ul>
                {data.executiveSummary.keyFindings.map((finding, index) => (
                  <li key={index}>{finding}</li>
                ))}
              </ul>
            </div>

            {/* 整体情感倾向 */}
            <div style={{ marginBottom: '20px' }}>
              <h3>整体情感倾向</h3>
              <p>
                <strong>{data.executiveSummary.overallSentiment.label}</strong>
                (得分: {(data.executiveSummary.overallSentiment.score * 100).toFixed(0)}%)
              </p>
            </div>

            {/* 舆情热度和影响力 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-around',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              <div style={{ width: '45%' }}>
                <h3>舆情热度</h3>
                <div style={{
                  fontSize: '36px',
                  fontWeight: 'bold',
                  color: primaryColor
                }}>
                  {data.executiveSummary.heatLevel}
                </div>
                <div>热度指数 (0-100)</div>
              </div>
              <div style={{ width: '45%' }}>
                <h3>影响力等级</h3>
                <div style={{
                  fontSize: '36px',
                  fontWeight: 'bold',
                  color: accentColor
                }}>
                  {data.executiveSummary.impactLevel}
                </div>
                <div>影响力指数 (0-100)</div>
              </div>
            </div>

            {/* 添加热度趋势 */}
            <div style={{ marginBottom: '20px' }}>
              <h3>热门趋势</h3>
              <div style={{ height: '250px' }}>
                <TopTrendsChart data={data.executiveSummary.topTrends} />
              </div>
            </div>
          </div>

          {/* 数据统计概览 */}
          {template.contentConfig.showAnalysisNumbers && (
            <div className={styles.statsContainer}>
              <h3 style={{ color: primaryColor }}>数据统计概览</h3>
              <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '20px' }}>
                <div className={styles.statCard}>
                  <div className={styles.statValue}>{data.rawDataSummary.totalMessages}</div>
                  <div className={styles.statLabel}>分析消息数</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statValue}>
                    {data.executiveSummary.overallSentiment.distribution.positive}%
                  </div>
                  <div className={styles.statLabel}>正面情感</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statValue}>{data.detailedAnalysis.topicAnalysis.mainTopics.length}</div>
                  <div className={styles.statLabel}>热门话题</div>
                </div>
              </div>
            </div>
          )}

          {/* 添加情感分析图表 */}
          {template.contentConfig.showSentimentChart && (
            <div className={styles.chartContainer}>
              <h3 style={{ color: primaryColor }}>情感分析</h3>

              {/* 情感分析概述 */}
              <p>{data.detailedAnalysis.sentimentAnalysis.overview}</p>

              {/* 情感分布饼图 */}
              <div style={{ height: '250px' }}>
                <SentimentPieChart data={sentimentChartData} />
              </div>

              {/* 情感维度详情 */}
              <h4 style={{ marginTop: '20px' }}>情感维度分析</h4>
              <div style={{ height: '250px' }}>
                <SentimentDimensionsChart data={data.detailedAnalysis.sentimentAnalysis.details} />
              </div>

              {/* 情感因素分析 */}
              <h4 style={{ marginTop: '20px' }}>情感影响因素</h4>
              <div style={{ height: '250px' }}>
                <EmotionalFactorsChart data={data.detailedAnalysis.sentimentAnalysis.emotionalFactors} />
              </div>
            </div>
          )}

          {/* 添加热门话题图表 */}
          {template.contentConfig.showTopicChart && (
            <div className={styles.chartContainer}>
              <h3 style={{ color: primaryColor }}>话题分析</h3>

              {/* 话题分析概述 */}
              <p>{data.detailedAnalysis.topicAnalysis.overview}</p>

              {/* 主要话题图表 */}
              <div style={{ height: '250px' }}>
                <TopicColumnChart data={topicChartData} />
              </div>

              {/* 话题关系网络图 */}
              <h4 style={{ marginTop: '20px' }}>话题关系网络</h4>
              <div style={{ height: '300px' }}>
                <TopicRelationGraph data={data.detailedAnalysis.topicAnalysis.topicRelations} />
              </div>

              {/* 关键词云 */}
              <h4 style={{ marginTop: '20px' }}>关键词云</h4>
              <div style={{ height: '250px' }}>
                <KeywordCloudChart data={data.detailedAnalysis.topicAnalysis.keywordCloud} />
              </div>
            </div>
          )}

          {/* 传播分析 */}
          <div className={styles.chartContainer}>
            <h3 style={{ color: primaryColor }}>传播分析</h3>

            {/* 传播分析概述 */}
            <p>{data.detailedAnalysis.propagationAnalysis.overview}</p>

            {/* 传播渠道分析 */}
            <h4 style={{ marginTop: '20px' }}>传播渠道分析</h4>
            <div style={{ height: '250px' }}>
              <ChannelsChart data={data.detailedAnalysis.propagationAnalysis.channels} />
            </div>

            {/* 传播时间线 */}
            <h4 style={{ marginTop: '20px' }}>传播时间线</h4>
            <div style={{ height: '250px' }}>
              <PropagationTimelineChart data={data.detailedAnalysis.propagationAnalysis.timeline} />
            </div>

            {/* 传播高峰事件 */}
            <h4 style={{ marginTop: '20px' }}>传播高峰事件</h4>
            <div>
              {data.detailedAnalysis.propagationAnalysis.peakEvents.map((event, index) => (
                <div key={index} style={{
                  marginBottom: '10px',
                  padding: '10px',
                  border: '1px solid #f0f0f0',
                  borderRadius: '4px'
                }}>
                  <div style={{ fontWeight: 'bold' }}>{event.title}</div>
                  <div>时间: {new Date(event.timestamp).toLocaleString()}</div>
                  <div>影响度: {event.impact}</div>
                  <div>{event.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 洞察与建议 */}
          <div className={styles.chartContainer}>
            <h3 style={{ color: primaryColor }}>洞察与建议</h3>

            {/* 关键挑战 */}
            <h4 style={{ marginTop: '20px' }}>关键挑战</h4>
            <div>
              {data.insightsAndRecommendations.keyChallenges.map((challenge, index) => (
                <div key={index} style={{
                  marginBottom: '10px',
                  padding: '10px',
                  border: '1px solid #f0f0f0',
                  borderRadius: '4px',
                  backgroundColor: '#fff7f7'
                }}>
                  <div style={{ fontWeight: 'bold' }}>{challenge.challenge}</div>
                  <div>严重度: {challenge.severity}/10</div>
                  <div>{challenge.description}</div>
                </div>
              ))}
            </div>

            {/* 机会点 */}
            <h4 style={{ marginTop: '20px' }}>机会点</h4>
            <div>
              {data.insightsAndRecommendations.opportunities.map((opportunity, index) => (
                <div key={index} style={{
                  marginBottom: '10px',
                  padding: '10px',
                  border: '1px solid #f0f0f0',
                  borderRadius: '4px',
                  backgroundColor: '#f7fff7'
                }}>
                  <div style={{ fontWeight: 'bold' }}>{opportunity.opportunity}</div>
                  <div>潜力: {opportunity.potential}/10</div>
                  <div>{opportunity.description}</div>
                </div>
              ))}
            </div>

            {/* 建议 */}
            <h4 style={{ marginTop: '20px' }}>建议</h4>
            <div>
              {data.insightsAndRecommendations.recommendations.map((recommendation, index) => (
                <div key={index} style={{
                  marginBottom: '10px',
                  padding: '10px',
                  border: '1px solid #f0f0f0',
                  borderRadius: '4px',
                  backgroundColor: '#f7fcff'
                }}>
                  <div style={{ fontWeight: 'bold' }}>{recommendation.title}</div>
                  <div>
                    优先级: <span style={{
                      color: recommendation.priority === '高' ? '#f5222d' :
                            recommendation.priority === '中' ? '#fa8c16' : '#52c41a'
                    }}>{recommendation.priority}</span>
                    {' | '}
                    时间框架: {recommendation.timeframe}
                  </div>
                  <div>{recommendation.description}</div>
                  <div style={{ fontStyle: 'italic' }}>预期效果: {recommendation.expectedOutcome}</div>
                </div>
              ))}
            </div>

            {/* 风险评估 */}
            <h4 style={{ marginTop: '20px' }}>风险评估</h4>
            <div style={{
              marginBottom: '10px',
              padding: '10px',
              border: '1px solid #f0f0f0',
              borderRadius: '4px',
              backgroundColor: '#fffdf7'
            }}>
              <div>总体风险等级: <span style={{
                fontWeight: 'bold',
                color: data.insightsAndRecommendations.riskAssessment.riskLevel === '高' ? '#f5222d' :
                      data.insightsAndRecommendations.riskAssessment.riskLevel === '中' ? '#fa8c16' : '#52c41a'
              }}>{data.insightsAndRecommendations.riskAssessment.riskLevel}</span></div>

              <h5 style={{ marginTop: '10px' }}>潜在风险</h5>
              <div>
                {data.insightsAndRecommendations.riskAssessment.potentialRisks.map((risk, index) => (
                  <div key={index} style={{
                    marginBottom: '10px',
                    padding: '10px',
                    border: '1px solid #f0f0f0',
                    borderRadius: '4px'
                  }}>
                    <div style={{ fontWeight: 'bold' }}>{risk.risk}</div>
                    <div>
                      概率: {risk.probability}% |
                      影响: {risk.impact}%
                    </div>
                    <div>缓解策略: {risk.mitigationStrategy}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 分析方法与局限性 */}
          <div className={styles.chartContainer}>
            <h3 style={{ color: primaryColor }}>分析方法与局限性</h3>

            {/* 分析方法 */}
            <h4 style={{ marginTop: '20px' }}>分析方法</h4>
            <ul>
              {data.analysisDetails.methodologies.map((methodology, index) => (
                <li key={index}>{methodology}</li>
              ))}
            </ul>

            {/* 数据来源 */}
            <h4 style={{ marginTop: '20px' }}>数据来源</h4>
            <div>
              {data.analysisDetails.dataSources.map((source, index) => (
                <div key={index} style={{
                  marginBottom: '10px',
                  padding: '10px',
                  border: '1px solid #f0f0f0',
                  borderRadius: '4px'
                }}>
                  <div style={{ fontWeight: 'bold' }}>{source.name}</div>
                  <div>类型: {source.type}</div>
                  <div>可靠性: {source.reliability}% | 覆盖率: {source.coverage}%</div>
                </div>
              ))}
            </div>

            {/* 分析局限性 */}
            <h4 style={{ marginTop: '20px' }}>分析局限性</h4>
            <ul>
              {data.analysisDetails.limitations.map((limitation, index) => (
                <li key={index}>{limitation}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* 报告底部 */}
        <div
          className={styles.reportFooter}
          style={{ borderTopColor: secondaryColor }}
        >
          {template.footerConfig.showCopyright && (
            <p>©{new Date().getFullYear()} 舆情智能分析系统</p>
          )}
          <p>关键词: {data.meta.keywords.join(', ')}</p>
          {template.footerConfig.customText && (
            <p>{template.footerConfig.customText}</p>
          )}
        </div>
      </div>
    );

    setReportContent(report);
  };

  // 生成结构化报告数据方法
  const generateStructuredReport = async () => {
    if (!sessionId) {
      message.error('当前没有会话ID，无法生成报告');
      return;
    }

    try {
      // 设置加载和进度状态
      setIsLoadingReport(true);
      setIsGeneratingReport(true);
      setReportProgress(0);

      // 展示进度消息
      message.loading({
        content: '正在分析会话数据...',
        key: 'reportProgress',
        duration: 0
      });

      // 启动进度模拟
      const progressInterval = setInterval(() => {
        setReportProgress(prev => {
          // 最多到95%，最后5%在实际完成时更新
          if (prev >= 95) {
            clearInterval(progressInterval);
            return prev;
          }
          // 前30%快速增加，后面增加速度变慢
          const increment = prev < 30 ? 5 : prev < 60 ? 3 : 1;
          const newProgress = Math.min(prev + increment, 95);

          // 更新进度消息
          if (newProgress < 40) {
            message.loading({
              content: `正在分析会话数据...(${newProgress}%)`,
              key: 'reportProgress',
              duration: 0
            });
          } else if (newProgress < 70) {
            message.loading({
              content: `正在生成报告结构...(${newProgress}%)`,
              key: 'reportProgress',
              duration: 0
            });
          } else {
            message.loading({
              content: `正在渲染报告内容...(${newProgress}%)`,
              key: 'reportProgress',
              duration: 0
            });
          }

          return newProgress;
        });
      }, 500); // 每500ms更新一次进度

      // 调用后端API获取结构化报告数据
      const response = await fetch('/api/v1/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      // 清除进度条定时器
      clearInterval(progressInterval);

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '生成报告失败');
      }

      // 设置进度为100%并显示成功消息
      setReportProgress(100);
      message.success({ content: '报告生成成功!', key: 'reportProgress' });

      // 获取结构化报告数据
      setReportData(result.data);

      // 生成报告视图
      renderStructuredReport(result.data);

      // 显示报告弹窗
      setShowReportModal(true);
    } catch (error) {
      console.error('生成结构化报告失败:', error);
      message.error({
        content: `生成报告失败: ${error instanceof Error ? error.message : '未知错误'}`,
        key: 'reportProgress'
      });
    } finally {
      setIsLoadingReport(false);
      setIsGeneratingReport(false);
    }
  };

  // 修改生成报告按钮的处理函数
  const generateReport = () => {
    // 启用结构化报告生成
    generateStructuredReport();
  };

  // 处理发送消息事件
  const onSubmit = (nextContent: string) => {
    // 如果没有文本内容也没有图片附件，则不处理
    if (!nextContent && attachedFiles.length === 0) return;

    // 准备图片文件数组
    const imageFiles: File[] = [];

    // 从附件列表中提取有效的文件对象
    attachedFiles.forEach(file => {
      if (file.originFileObj) {
        // 安全地转换为File对象
        const fileObj = safelyConvertToFile(file.originFileObj);
        if (fileObj) {
          imageFiles.push(fileObj);
        }
      }
    });

    // 根据是否有图片选择不同的发送方式
    if (imageFiles.length > 0) {
      // 有图片时，使用多模态消息负载
      const payload: MultimodalPayload = {
        message: nextContent,  // 文本内容
        files: imageFiles      // 图片文件
      };

      // 使用ts-ignore来绕过类型检查，因为onRequest原本不接受MultimodalPayload类型
      // @ts-ignore - Using custom payload for multimodal
      onRequest(payload);
    } else {
      // 没有图片时，直接发送文本
      onRequest(nextContent);
    }

    // 清空输入框和附件
    setContent('');
    setAttachedFiles([]);
  };

  // 处理点击提示词事件
  const onPromptsItemClick: GetProp<typeof Prompts, 'onItemClick'> = (info) => {
    // 确保只传递字符串给onRequest，避免将对象作为React子元素渲染
    const promptText = typeof info.data.description === 'string' ? info.data.description : '';
    // 发送提示词内容
    onRequest(promptText);
  };

  // 删除会话
  const deleteConversation = async (sessionId: string, key: string) => {
    if (!sessionId) return;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/v1/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        // 从会话列表中移除
        setConversationsItems(prev => prev.filter(item => item.key !== key));

        // 如果删除的是当前活动会话，选择另一个会话或创建一个新的
        if (key === activeKey) {
          if (conversationsItems.length > 1) {
            // 找到不是当前会话的第一个会话
            const nextConversation = conversationsItems.find(item => item.key !== key);
            if (nextConversation) {
              setActiveKey(nextConversation.key);
              setSessionId(nextConversation.sessionId);
              fetchChatHistory(nextConversation.sessionId);
            }
          } else {
            // 如果没有其他会话，创建一个新的
            createNewSession();
          }
        }

        message.success('会话已删除');
      } else {
        message.error(data.error || '删除会话失败');
      }
    } catch (error) {
      console.error('删除会话失败:', error);
      message.error('删除会话失败，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };

  // 处理文件变更
  const handleFileChange: GetProp<typeof Attachments, 'onChange'> = (info) => {
    setAttachedFiles(info.fileList);
  };

  // ==================== Nodes ====================
  const placeholderNode = (
    <Space direction="vertical" size={16} className={styles.placeholder}>
      <Welcome
        variant="borderless"
        icon="https://i.postimg.cc/CxpThGSw/1.jpg"
        title="舆情策略生成系统"
        description="基于多源数据集和混合深度学习架构，实现谣言检测、多模态分析和策略生成，为金融商战、社会维稳和舆论分析提供数据驱动决策支持。"
        extra={
          <Space>
            <Button icon={<ShareAltOutlined />} />
            <Button icon={<EllipsisOutlined />} />
          </Space>
        }
      />
      <Prompts
        title="试试上传一张图片进行分析:"
        items={placeholderPromptsItems}
        styles={{
          list: {
            width: '100%',
          },
          item: {
            flex: 1,
          },
        }}
        onItemClick={onPromptsItemClick}
      />
    </Space>
  );

  // Render message bubbles with structures if available
  const bubbleItems: GetProp<typeof Bubble.List, 'items'> = messages.map(
    ({ id, message, status, isThinking, thinkingState }) => {
      return {
      key: id,
      loading: status === 'loading',
      role: status === 'local' ? 'local' : 'ai',
        content: isThinking && thinkingState ? (
          <ThinkingState
            status={thinkingState.status as any || 'thinking'}
            message={thinkingState.message || '思考中...'}
          />
        ) : (
          // 使用 div 包裹 ReactMarkdown 并应用样式
          <div className={styles.markdownContent}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]} // 启用 GFM
              rehypePlugins={[rehypeRaw]}   // 允许 HTML (如果需要)
              components={{
                // 暂时移除自定义 code 组件以解决类型问题
                /*
                code(props: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { inline?: boolean; className?: string; children: React.ReactNode }) {
                  const { inline, className, children, ...rest } = props;
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    // 如果需要语法高亮，在这里集成 react-syntax-highlighter
                    <pre><code className={className} {...rest}>{String(children).replace(/\n$/, '')}</code></pre>
                  ) : (
                    <code className={className} {...rest}>
                      {children}
                    </code>
                  );
                },
                */
                // 保持其他自定义组件 (如果需要)
                table({ children, ...props }) {
                  return <table style={{ borderCollapse: 'collapse', width: '100%' }} {...props}>{children}</table>
                },
                th({ children, ...props }) {
                  return <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }} {...props}>{children}</th>
                },
                td({ children, ...props }) {
                  return <td style={{ border: '1px solid #ddd', padding: '8px' }} {...props}>{children}</td>
                }
              }}
            >
              {message}
            </ReactMarkdown>
        </div>
        ),
      };
    }
  );

  const attachmentsNode = (
    <Badge dot={attachedFiles.length > 0 && !headerOpen}>
      <Button type="text" icon={<PictureOutlined />} onClick={() => setHeaderOpen(!headerOpen)} />
    </Badge>
  );

  const senderHeader = (
    <Sender.Header
      title="Upload Images"
      open={headerOpen}
      onOpenChange={setHeaderOpen}
      styles={{
        content: {
          padding: 0,
        },
      }}
    >
      <Attachments
        beforeUpload={() => false}
        items={attachedFiles}
        onChange={handleFileChange}
        accept="image/*"
        placeholder={(type) =>
          type === 'drop'
            ? { title: 'Drop image here' }
            : {
                icon: <CloudUploadOutlined />,
                title: 'Upload images',
                description: 'Click or drag images to this area to upload',
              }
        }
      />
    </Sender.Header>
  );

  const logoNode = (
    <div className={styles.logo}>
      <img
        src="https://i.postimg.cc/CxpThGSw/1.jpg"
        draggable={false}
        alt="logo"
      />
      <span>舆情策略生成系统</span>
    </div>
  );

  // 模板设置组件
  const TemplateSelector: React.FC = () => {
    const [form] = Form.useForm();

    // 处理模板选择
    const handleTemplateChange = (templateId: string) => {
      setSelectedTemplateId(templateId);
      setCustomTemplate(null); // 清空自定义模板
    };

    // 处理自定义模板的表单提交
    const handleFormSubmit = (values: any) => {
      const newTemplate: ReportTemplate = {
        id: 'custom',
        name: values.name || '自定义模板',
        headerConfig: {
          title: values.title || '自定义舆情分析报告',
          showLogo: values.showLogo,
          showDate: values.showDate,
          showSessionId: values.showSessionId,
        },
        contentConfig: {
          showAnalysisNumbers: values.showAnalysisNumbers,
          showSentimentChart: values.showSentimentChart,
          showTopicChart: values.showTopicChart,
          highlightKeywords: values.highlightKeywords,
        },
        footerConfig: {
          showCopyright: values.showCopyright,
          customText: values.customText || '',
        },
        visualConfig: {
          primaryColor: values.primaryColor || '#1677ff',
          secondaryColor: values.secondaryColor || '#f0f0f0',
          accentColor: values.accentColor || '#ff4d4f',
        }
      };

      setCustomTemplate(newTemplate);
      setSelectedTemplateId('custom');
      message.success('自定义模板已保存');
    };

    return (
      <div>
        <div style={{ marginBottom: '20px' }}>
          <h3>选择报告模板</h3>
          <Radio.Group
            value={selectedTemplateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
            style={{ width: '100%' }}
          >
            {templates.map(template => (
              <Radio.Button
                key={template.id}
                value={template.id}
                style={{
                  width: '33.3%',
                  textAlign: 'center',
                  borderColor: selectedTemplateId === template.id
                    ? template.visualConfig.primaryColor
                    : undefined
                }}
              >
                {template.name}
              </Radio.Button>
            ))}
          </Radio.Group>

          {/* 模板描述 */}
          {templates.find(t => t.id === selectedTemplateId)?.description && (
            <div style={{ margin: '10px 0', color: '#666' }}>
              {templates.find(t => t.id === selectedTemplateId)?.description}
            </div>
          )}
        </div>

        <div>
          <h3>自定义模板</h3>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleFormSubmit}
            initialValues={{
              name: '自定义模板',
              title: '自定义舆情分析报告',
              showLogo: true,
              showDate: true,
              showSessionId: true,
              showAnalysisNumbers: true,
              showSentimentChart: true,
              showTopicChart: true,
              highlightKeywords: true,
              showCopyright: true,
              customText: '',
              primaryColor: '#1677ff',
              secondaryColor: '#f0f0f0',
              accentColor: '#ff4d4f'
            }}
          >
            <Tabs defaultActiveKey="basic">
              <Tabs.TabPane tab="基本设置" key="basic">
                <Form.Item name="name" label="模板名称">
                  <Input placeholder="输入模板名称" />
                </Form.Item>

                <Form.Item name="title" label="报告标题">
                  <Input placeholder="输入报告标题" />
                </Form.Item>

                <Form.Item label="页眉设置">
                  <Form.Item name="showLogo" valuePropName="checked" noStyle>
                    <Radio.Button
                      style={{ marginRight: '10px' }}
                      value={true}
                    >
                      显示Logo
                    </Radio.Button>
                  </Form.Item>
                  <Form.Item name="showDate" valuePropName="checked" noStyle>
                    <Radio.Button
                      style={{ marginRight: '10px' }}
                      value={true}
                    >
                      显示日期
                    </Radio.Button>
                  </Form.Item>
                  <Form.Item name="showSessionId" valuePropName="checked" noStyle>
                    <Radio.Button value={true}>
                      显示会话ID
                    </Radio.Button>
                  </Form.Item>
                </Form.Item>
              </Tabs.TabPane>

              <Tabs.TabPane tab="内容设置" key="content">
                <Form.Item label="内容组件">
                  <Form.Item name="showAnalysisNumbers" valuePropName="checked" noStyle>
                    <Radio.Button
                      style={{ marginRight: '10px' }}
                      value={true}
                    >
                      数据统计
                    </Radio.Button>
                  </Form.Item>
                  <Form.Item name="showSentimentChart" valuePropName="checked" noStyle>
                    <Radio.Button
                      style={{ marginRight: '10px' }}
                      value={true}
                    >
                      情感分析图
                    </Radio.Button>
                  </Form.Item>
                  <Form.Item name="showTopicChart" valuePropName="checked" noStyle>
                    <Radio.Button
                      style={{ marginRight: '10px' }}
                      value={true}
                    >
                      话题分析图
                    </Radio.Button>
                  </Form.Item>
                </Form.Item>

                <Form.Item name="highlightKeywords" valuePropName="checked" label="关键词高亮">
                  <Radio.Button value={true}>
                    启用关键词高亮
                  </Radio.Button>
                </Form.Item>
              </Tabs.TabPane>

              <Tabs.TabPane tab="样式设置" key="style">
                <Form.Item name="primaryColor" label="主色调">
                  <Input type="color" style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item name="secondaryColor" label="次要色调">
                  <Input type="color" style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item name="accentColor" label="强调色">
                  <Input type="color" style={{ width: '100%' }} />
                </Form.Item>
              </Tabs.TabPane>

              <Tabs.TabPane tab="页脚设置" key="footer">
                <Form.Item name="showCopyright" valuePropName="checked" label="版权信息">
                  <Radio.Button value={true}>
                    显示版权信息
                  </Radio.Button>
                </Form.Item>

                <Form.Item name="customText" label="自定义页脚文本">
                  <Input.TextArea
                    placeholder="输入自定义页脚文本"
                    rows={3}
                  />
                </Form.Item>
              </Tabs.TabPane>
            </Tabs>

            <Form.Item>
              <Button type="primary" htmlType="submit">
                保存自定义模板
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    );
  };

  // 在UI中使用isThinking变量，显示加载状态
  const renderLoadingState = () => {
    if (isThinking) {
      return (
        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <Spin size="small" />
          <span style={{ marginLeft: '8px' }}>AI正在思考...</span>
        </div>
      );
    }
    return null;
  };

  // ==================== Render =================
  return (
    <ConfigProvider
      theme={{
        components: {
          Layout: {
            bodyBg: 'transparent',
            headerBg: 'transparent',
            siderBg: 'transparent',
          },
        },
      }}
    >
      <div className={styles.layout} style={{ height: 'calc(100vh - 48px)' }}>
        <div className={styles.menu}>
          {/* 🌟 Logo */}
          {logoNode}
          {/* 🌟 添加会话 */}
          <Button
            onClick={onAddConversation}
            type="link"
            className={styles.addBtn}
            icon={<PlusOutlined />}
            loading={isLoading}
          >
            New Conversation
          </Button>
          {/* 🌟 会话管理 - 使用自定义列表 */}
          <div className={styles.conversations}>
            {conversationsItems.map(item => (
              <div
                key={item.key}
                onClick={() => onConversationClick(item.key)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: activeKey === item.key ? 'rgba(22, 119, 255, 0.1)' : 'transparent',
                  marginBottom: '4px'
                }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.label}
                </span>
                <Popconfirm
                  title="确定要删除此会话吗？"
                  okText="确定"
                  cancelText="取消"
                  onConfirm={() => deleteConversation(item.sessionId, item.key)}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    danger
                    onClick={(e) => e.stopPropagation()}
                    style={{ visibility: activeKey === item.key ? 'visible' : 'hidden' }}
          />
                </Popconfirm>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.chat}>
          {/* 加载指示器 */}
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
              <p style={{ marginTop: 8 }}>加载中...</p>
            </div>
          )}

          {/* 生成报告按钮 */}
          {bubbleItems.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
              <Button
                type="primary"
                icon={isGeneratingReport ? <LoadingOutlined /> : <FileTextOutlined />}
                onClick={generateReport}
                disabled={isLoading || isGeneratingReport}
              >
                {isGeneratingReport ? `生成报告中 ${reportProgress}%` : '生成分析报告'}
              </Button>
            </div>
          )}

          {/* 🌟 消息列表 */}
          <Bubble.List
            items={bubbleItems.length > 0 ? bubbleItems : [{ content: placeholderNode, variant: 'borderless' }]}
            roles={roles}
            className={styles.messages}
          />

          {/* 添加思考状态显示 */}
          {renderLoadingState()}

          {/* 🌟 提示词 */}
          <Prompts items={senderPromptsItems} onItemClick={onPromptsItemClick} />
          {/* 🌟 输入框 */}
          <Sender
            value={content}
            header={senderHeader}
            onSubmit={onSubmit}
            onChange={setContent}
            prefix={attachmentsNode}
            loading={agent.isRequesting()}
            className={styles.sender}
            placeholder="Type a message or upload an image..."
          />
        </div>
      </div>

      {/* 报告预览弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>舆情分析报告</span>
            {isLoadingReport && <Spin size="small" />}
          </div>
        }
        open={showReportModal}
        onCancel={() => setShowReportModal(false)}
        width={800}
        footer={[
          <Button key="cancel" onClick={() => setShowReportModal(false)}>
            关闭
          </Button>,
          <Button
            key="export"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={exportReport}
            loading={isLoadingReport}
          >
            导出PDF
          </Button>
        ]}
      >
        <Tabs defaultActiveKey="preview">
          <Tabs.TabPane tab="报告预览" key="preview">
            {isLoadingReport ? (
              <div style={{ textAlign: 'center', padding: '50px 0' }}>
                <Spin />
                <div style={{ marginTop: 20 }}>
                  <Progress percent={reportProgress} status="active" />
                  <p>报告生成中，请稍候...</p>
                </div>
              </div>
            ) : (
              reportContent
            )}
          </Tabs.TabPane>
          <Tabs.TabPane tab="模板设置" key="template">
            <TemplateSelector />
          </Tabs.TabPane>
        </Tabs>
      </Modal>
    </ConfigProvider>
  );
};

export default Independent;

// 在适当位置添加XAgent扩展类型定义
// 定义扩展的XAgent类型，添加自定义参数支持
// 这应该添加在import语句后，组件定义前
// 扩展XAgent接口支持自定义参数
declare module '@ant-design/x' {
  interface XAgentRequestOptions {
    sessionId?: string; // 允许传递会话ID
    [key: string]: any; // 其他可能的自定义参数
  }
}
