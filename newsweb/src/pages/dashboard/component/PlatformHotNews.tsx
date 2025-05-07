import { ProList } from '@ant-design/pro-components';
import { Skeleton, Typography, Space, Flex, Badge, Dropdown, Empty } from 'antd';
import { useState, useEffect } from 'react';
import {
  FireOutlined,
  RiseOutlined,
  SyncOutlined,
  CaretDownOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

// 平台头像映射
const platformAvatars: { [key: string]: string } = {
  知乎热榜: './icons/知乎.svg',
  哔哩哔哩: './icons/哔哩哔哩.svg',
  今日头条: './icons/今日头条.svg',
  抖音: './icons/抖音.svg',
  微博: './icons/微博.svg',
  百度热点: './icons/百度.svg',
};

// 颜色映射：为前三名设置不同的颜色
const rankColors = ['#f5222d', '#fa8c16', '#faad14'];

// 支持的平台列表
const SUPPORTED_PLATFORMS = ['微博', '知乎热榜', '百度热点', '今日头条', '抖音', '哔哩哔哩'];

// 定义数据结构类型
interface HotNewsItem {
  key: string;
  name: string;
  image: string;
  desc: string;
  hotValue: number;
  url: string;
  rank: number;
}

const PlatformHotNews: React.FC = () => {
  const [platformData, setPlatformData] = useState<{[key: string]: HotNewsItem[]}>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<string>(SUPPORTED_PLATFORMS[0]);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('https://api.vvhan.com/api/hotlist/all');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      if (data.success && data.data) {
        const allPlatformData: {[key: string]: HotNewsItem[]} = {};

        // 处理每个平台的数据
        SUPPORTED_PLATFORMS.forEach((platform) => {
          const platformSource = data.data.find(
            (item: any) => item.name === platform,
          );

          if (platformSource && platformSource.data && platformSource.data.length > 0) {
            const validNews = platformSource.data
              .filter((news: any) => news.title && news.url)
              .map((news: any, index: number) => {
                const hotText = news.hot || '';
                const hotValue = parseFloat(hotText.replace('万', '')) * (hotText.includes('万') ? 10000 : 1);

                return {
                  key: `${platform}-${index}`,
                  name: news.title,
                  image: platformAvatars[platform],
                  desc: hotText.replace(/热度/g, '').trim(),
                  hotValue: isNaN(hotValue) ? 0 : hotValue,
                  url: news.url,
                  rank: index + 1
                };
              })
              .slice(0, 8); // 取前6条

            allPlatformData[platform] = validNews;
          } else {
            allPlatformData[platform] = [];
          }
        });

        setPlatformData(allPlatformData);
      } else {
        throw new Error(data.message || 'Failed to fetch valid data structure');
      }
    } catch (err: any) {
      console.error('获取热门列表数据失败:', err);
      setError(err.message || '加载数据时发生错误');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 生成下拉菜单项
  const platformMenuItems = SUPPORTED_PLATFORMS.map(platform => ({
    key: platform,
    label: (
      <Space>
        <img
          src={platformAvatars[platform]}
          alt={platform}
          style={{ width: 14, height: 14 }}
        />
        <span>{platform.replace('热榜', '')}</span>
      </Space>
    ),
  }));

  // 处理下拉菜单选择
  const handleMenuClick = ({ key }: { key: string }) => {
    setActivePlatform(key);
  };

  // 获取当前平台的简短名称
  const getShortPlatformName = (platform: string) => {
    return platform.replace('热榜', '');
  };

  if (loading && !refreshing) {
    return (
      <div style={{ padding: 16, height: '100%' }}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<Text type="danger">加载失败: {error}</Text>}
        />
      </div>
    );
  }

  const activeData = platformData[activePlatform] || [];

  if (activeData.length === 0) {
    return (
      <div style={{ padding: '20px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="暂无热门新闻数据" />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 标题和平台选择 */}
      <Flex justify="space-between" align="center" style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <Space>
          <FireOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
          <Text strong style={{ fontSize: '16px' }}>热门榜单</Text>
          {refreshing && <SyncOutlined spin style={{ color: '#1890ff', marginLeft: 8 }} />}
        </Space>

        <Dropdown
          menu={{
            items: platformMenuItems,
            onClick: handleMenuClick,
            selectedKeys: [activePlatform]
          }}
          trigger={['click']}
        >
          <Space style={{ cursor: 'pointer' }}>
            <img
              src={platformAvatars[activePlatform]}
              alt={activePlatform}
              style={{ width: 16, height: 16 }}
            />
            <Text strong>{getShortPlatformName(activePlatform)}</Text>
            <CaretDownOutlined />
          </Space>
        </Dropdown>
      </Flex>

      {/* 热门内容列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        <ProList<HotNewsItem>
          rowKey="key"
          dataSource={activeData}
          split={true}
          metas={{
            title: {
              dataIndex: 'name',
              render: (dom, entity) => (
                <a
                  href={entity.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: '#000000',
                    textDecoration: 'none',
                    fontSize: '13px',
                    maxWidth: '220px',
                    transition: 'color 0.3s'
                  }}
                  className="hot-news-link"
                >
                  <Badge
                    count={entity.rank}
                    style={{
                      backgroundColor: entity.rank <= 3 ? rankColors[entity.rank - 1] : '#ccc',
                      marginRight: 8
                    }}
                    size="small"
                  />
                  {dom}
                </a>
              ),
            },

            subTitle: {
              dataIndex: 'desc',
              search: false,
              render: (_, entity) => (
                <Flex align="center">
                  <Text style={{ fontSize: '11px', color: '#ff7a45' }}>
                    {entity.desc}
                  </Text>
                  {entity.rank <= 3 && <RiseOutlined style={{ fontSize: '11px', color: '#ff4d4f', marginLeft: 4 }} />}
                </Flex>
              ),
            },
          }}
          pagination={false}
          style={{
            backgroundColor: '#ffffff',
          }}
          cardProps={{
            className: 'hot-news-item'
          }}
          loading={refreshing}
        />
      </div>

      <style>
        {`
          .hot-news-item:hover {
            background-color:rgb(255, 255, 255);
          }
          .hot-news-link:hover {
            color: #1890ff !important;
          }
          .platform-list .ant-pro-list-row-header {
            padding: 0 !important;
          }
        `}
      </style>
    </div>
  );
};

export default PlatformHotNews;
