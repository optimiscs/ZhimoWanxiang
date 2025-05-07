export default {
  'GET /api/analysisreportdata': [
    {
      summary:
        '视频展示了某品牌便携式电池在充电过程中出现冒烟和火花情况。视频拍摄者声称这是正常使用过程中发生的，并表达了对产品安全性的担忧。视频末尾显示了电池外壳变形和烧焦痕迹。',
      sentiment: {
        video: {
          negative: 75,
          neutral: 12,
          positive: 2,
        },
        comments: {
          negative: 86,
          neutral: 12,
          positive: 2,
        },
      },
      events: {
        identified: ['安全隐患', '产品质量', '品牌声誉风险'],
        propagation: '该视频真实性高，已经产生较广泛传播，若24小时内不回应，负面影响将扩大约280%。',
        assessment: '系统评估等级：高风险',
        recommendation: '建议立即启动危机公关响应流程',
      },
    },
  ],
};
