import { OpinionSummary, RelatedEvent, TimelineItem } from '../types';

// 生成时间线模拟数据
export const generateTimelineData = (date: string): TimelineItem[] => {
  const eventDate = new Date(date);
  const data = [];

  for (let i = 3; i >= 0; i--) {
    const currDate = new Date(eventDate);
    currDate.setDate(eventDate.getDate() - i);

    data.push({
      date: currDate.toISOString().split('T')[0],
      event: `事件发展阶段${3 - i}`,
      description: `这是事件在${currDate.toISOString().split('T')[0]}的发展情况描述。`,
    });
  }

  return data;
};

// 生成观点总结模拟数据
export const generateOpinionSummaries = (title: string): OpinionSummary[] => {
  // 根据事件类型生成不同的观点
  const positiveOpinions = [
    `${title}彰显社会正能量，值得点赞`,
    '大众普遍持支持态度，认可事件价值',
    '该行为展现人性温暖，引起共鸣',
    '创新举措获广泛认可，前景看好',
    '专业人士给予高度评价，堪称典范',
  ];

  const neutralOpinions = [
    '各方观点不一，关注点各有侧重',
    '事件仍在发展，结果尚未明朗',
    '公众持观望态度，等待更多信息',
    '专家建议需进一步验证相关信息',
    '媒体报道角度多元，需全面了解',
  ];

  const negativeOpinions = [
    '部分群体表示担忧，质疑实施效果',
    '存在争议环节，引发heated讨论',
    '相关政策有待完善，避免类似问题',
    '专业角度看有改进空间，需谨慎对待',
    '负面评价主要集中在操作不透明上',
  ];

  const sources = ['微博热议', '知乎问答', '媒体报道', '抖音评论', '专家观点', '群众反馈'];

  // 生成6条观点总结
  const summaries = [];

  // 确保有不同情感倾向的观点
  summaries.push({
    id: 1,
    content: positiveOpinions[Math.floor(Math.random() * positiveOpinions.length)],
    sentiment: 'positive',
    source: sources[Math.floor(Math.random() * sources.length)],
    count: 100 + Math.floor(Math.random() * 900),
  });

  summaries.push({
    id: 2,
    content: neutralOpinions[Math.floor(Math.random() * neutralOpinions.length)],
    sentiment: 'neutral',
    source: sources[Math.floor(Math.random() * sources.length)],
    count: 100 + Math.floor(Math.random() * 900),
  });

  summaries.push({
    id: 3,
    content: negativeOpinions[Math.floor(Math.random() * negativeOpinions.length)],
    sentiment: 'negative',
    source: sources[Math.floor(Math.random() * sources.length)],
    count: 100 + Math.floor(Math.random() * 900),
  });

  // 再随机添加3条
  const allOpinions = [...positiveOpinions, ...neutralOpinions, ...negativeOpinions];
  const sentiments = ['positive', 'neutral', 'negative'] as const;

  for (let i = 4; i <= 6; i++) {
    const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
    let content: string;

    if (sentiment === 'positive') {
      content = positiveOpinions[Math.floor(Math.random() * positiveOpinions.length)];
    } else if (sentiment === 'neutral') {
      content = neutralOpinions[Math.floor(Math.random() * neutralOpinions.length)];
    } else {
      content = negativeOpinions[Math.floor(Math.random() * negativeOpinions.length)];
    }

    // 确保不重复
    if (summaries.some((s) => s.content === content)) {
      content = allOpinions[Math.floor(Math.random() * allOpinions.length)];
    }

    summaries.push({
      id: i,
      content,
      sentiment,
      source: sources[Math.floor(Math.random() * sources.length)],
      count: 100 + Math.floor(Math.random() * 900),
    });
  }

  return summaries as OpinionSummary[];
};

// 生成相关事件模拟数据
export const generateRelatedEvents = (): RelatedEvent[] => {
  return [
    {
      id: 1,
      title: '某品牌电池起火视频引热议',
      type: 'video',
      sentiment: 'negative',
      source: '微博',
      time: '2分钟前',
      description: '视频显示某品牌电池在充电过程中出现火花和冒烟现象，引发用户安全担忧...',
    },
    {
      id: 2,
      title: '新产品发布会现场图片分享',
      type: 'image',
      sentiment: 'positive',
      source: '微信',
      time: '15分钟前',
      description: '多张现场图片显示新产品发布会盛况，用户评论积极，期待新功能...',
    },
    {
      id: 3,
      title: '用户投诉电话录音转写分析',
      type: 'audio',
      sentiment: 'neutral',
      source: '电话',
      time: '36分钟前',
      description: '用户反馈客服响应时间过长，但对最终解决方案表示满意，建议优化流程...',
    },
    {
      id: 4,
      title: '产品评测文章引发讨论',
      type: 'text',
      sentiment: 'positive',
      source: '新闻',
      time: '1小时前',
      description: '权威媒体发布详细产品评测，总体评价良好，特别赞赏设计和性能提升...',
    },
    {
      id: 5,
      title: '网红开箱视频吐槽产品缺陷',
      type: 'video',
      sentiment: 'negative',
      source: '视频',
      time: '2小时前',
      description: '知名网红发布开箱视频，指出产品多处细节设计不合理，引发粉丝共鸣...',
    },
  ];
};
