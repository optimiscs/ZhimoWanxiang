import {
  CalendarOutlined,
  DownOutlined,
  FireOutlined,
  SearchOutlined,
  UpOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Flex,
  Input,
  message,
  Pagination,
  Row,
  Select,
  Spin,
  Statistic,
  Tag,
  theme,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './GradientText.css';

dayjs.extend(isBetween);

const { Option } = Select;
const { Title, Paragraph } = Typography;
const CheckboxGroup = Checkbox.Group;

const RangePicker = DatePicker.RangePicker;

// 定义数据类型
interface NewsItem {
  id: string;
  title: string;
  area: string;
  description: string;
  heatValue: number;
  date: string;
  platform?: string;
  location?: { x: number; y: number };
  emotion?: {
    schema: Record<string, number>;
  };
  spreadSpeed?: number;
  spreadRange?: number;
  participants?: number;
  heat_history?: Array<{
    comprehensive_heat: number;
    normalized_heat: number;
    timestamp: string;
    weighted_heat_value: number;
  }>;
}

interface ApiNewsItem {
  id: string;
  x: number;
  y: number;
  type: string;
  platform: string;
  title: string;
  introduction: string;
  spreadSpeed: number;
  spreadRange: number;
  weighted_heat_value: number;
  participants: number;
  emotion: {
    schema: Record<string, number>;
  };
  heat_history?: Array<{
    comprehensive_heat: number;
    normalized_heat: number;
    timestamp: string;
    weighted_heat_value: number;
  }>;
}

// 获取所有唯一的领域标签
const getUniqueTypes = (data: ApiNewsItem[]): string[] => {
  const types = data.map((item) => item.type);
  return [...new Set(types)];
};

// 将API数据转换为展示所需格式
const transformNewsData = (apiData: ApiNewsItem[]): NewsItem[] => {
  return apiData.map((item) => {
    // 计算热度值 - 使用heat_history中最新的weighted_heat_value
    let heatValue: number;

    if (item.heat_history && item.heat_history.length > 0) {
      // 获取最新的热度记录
      const latestHeat = item.heat_history[item.heat_history.length - 1];
      // 使用weighted_heat_value作为热度值，除以621并取整
      heatValue = Math.floor(latestHeat.weighted_heat_value * 10000 / 621);
    } else {
      // 如果没有heat_history，使用旧的计算方式作为备选，同样除以621并取整
      heatValue = Math.floor(
        (((item.spreadSpeed || 0) * 100000 +
          (item.spreadRange || 0) * 200000 +
          (item.participants || 0) * 150000) /
          3 +
          item.weighted_heat_value / 50) / 621
      );
    }

    // 生成一个近期的随机日期（假设数据是最近30天内的）
    const currentDate = new Date();
    const randomDaysAgo = Math.floor(Math.random() * 30);
    const date = new Date(currentDate);
    date.setDate(currentDate.getDate() - randomDaysAgo);

    // 使用heat_history中的最早时间作为事件日期(如果存在)
    let eventDate = dayjs(date).format('YYYY-MM-DD');
    if (item.heat_history && item.heat_history.length > 0) {
      eventDate = item.heat_history[0].timestamp.split('T')[0];
    }

    return {
      id: item.id,
      title: item.title,
      area: item.type, // 使用type字段作为area
      description: item.introduction,
      heatValue,
      date: eventDate,
      platform: item.platform,
      location: { x: item.x, y: item.y },
      emotion: item.emotion,
      spreadSpeed: item.spreadSpeed,
      spreadRange: item.spreadRange,
      participants: item.participants,
      heat_history: item.heat_history, // 传递heat_history数据
    };
  });
};

// 添加平台图标映射
const platformAvatars: { [key: string]: string } = {
  知乎热榜: './icons/知乎.svg',
  哔哩哔哩: './icons/哔哩哔哩.svg',
  今日头条: './icons/今日头条.svg',
  抖音: './icons/抖音.svg',
  微博: './icons/微博.svg',
  百度热点: './icons/百度.svg',
};

const Articles = () => {
  const { token } = theme.useToken();
  const navigate = useNavigate();

  // 表单状态
  const [searchText, setSearchText] = useState('');
  const [sortType, setSortType] = useState('option1');
  // 设置一个默认时间范围，覆盖所有数据（过去5年到未来1年）
  const defaultTimeRange: [any, any] = [dayjs().subtract(5, 'year'), dayjs().add(1, 'year')];
  const [timeRange, setTimeRange] = useState<[any, any]>(defaultTimeRange);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [eventLibrary, setEventLibrary] = useState('all');
  // 添加平台筛选状态
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');

  // 添加折叠状态
  const [tagsCollapsed, setTagsCollapsed] = useState(true);

  // 数据状态
  const [newsData, setNewsData] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filteredData, setFilteredData] = useState<NewsItem[]>([]);
  const [uniqueAreas, setUniqueAreas] = useState<string[]>([]);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9; // 每页显示9张卡片

  // 添加热度范围筛选
  const [heatRange, setHeatRange] = useState<string>('all');
  // 添加标签分页
  const [tagPage, setTagPage] = useState<number>(1);
  const tagsPerPage = 20; // 每页显示20个标签

  // 获取新闻数据
  useEffect(() => {
    const fetchNewsData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/currentnews');

        const res = await response.json();
        const data = res.data;
        // 转换数据格式
        const transformedData = transformNewsData(data);
        setNewsData(transformedData);
        setFilteredData(transformedData);

        // 提取唯一的领域标签
        setUniqueAreas(getUniqueTypes(data));
      } catch (error) {
        console.error('获取新闻数据失败:', error);
        message.error('获取新闻数据失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    fetchNewsData();
  }, []);

  // 表单输入处理
  const handleSearch = (e: any) => {
    setSearchText(e.target.value);
  };

  const handleSortChange = (value: any) => {
    setSortType(value);
  };

  const handleTimeChange = (value: any) => {
    console.log('Time range changed:', value);
    // 将null改为undefined以修复日期清除问题
    const fixedValue = value ? value : [undefined, undefined];
    setTimeRange(fixedValue);
  };

  const handleAreaChange = (checkedValues: string[]) => {
    setSelectedAreas(checkedValues);
  };

  const handleEventLibraryChange = (value: string) => {
    setEventLibrary(value);
  };

  // 处理平台筛选变化
  const handlePlatformChange = (value: string) => {
    setSelectedPlatform(value);
  };

  // 全选标签
  const handleSelectAllTags = () => {
    setSelectedAreas([...uniqueAreas]);
  };

  // 反选标签
  const handleInvertSelection = () => {
    const invertedSelection = uniqueAreas.filter((tag) => !selectedAreas.includes(tag));
    setSelectedAreas(invertedSelection);
  };

  // 分页处理
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // 滚动到页面顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 重置所有筛选条件
  const handleResetFilters = () => {
    setSearchText('');
    setSortType('option1');
    setTimeRange([...defaultTimeRange]);
    setSelectedAreas([]);
    setEventLibrary('all');
    setSelectedPlatform('all');

    // 重新加载所有数据
    setFilteredData(newsData);
    setCurrentPage(1);
  };

  // 切换标签折叠状态
  const toggleTagsCollapse = () => {
    setTagsCollapsed(!tagsCollapsed);
  };

  // 跳转到详情页
  const handleCardClick = (item: any) => {
    // 将选择的事件数据存入localStorage，用于详情页使用
    localStorage.setItem('selectedEvent', JSON.stringify(item));
    navigate(`/newsdetail?id=${encodeURIComponent(item.title)}`);
  };

  const primaryColor = 'rgba(30, 134, 242, 1)';

  // 获取当前页的数据
  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredData.slice(startIndex, endIndex);
  };

  // 当前页的数据
  const currentPageData = getCurrentPageData();

  // 获取当前页的标签
  const getCurrentPageTags = () => {
    const startIndex = (tagPage - 1) * tagsPerPage;
    const endIndex = startIndex + tagsPerPage;
    return uniqueAreas.slice(startIndex, endIndex);
  };

  // 处理热度范围变化
  const handleHeatRangeChange = (value: string) => {
    setHeatRange(value);
  };

  // 处理标签分页变化
  const handleTagPageChange = (page: number) => {
    setTagPage(page);
  };

  // 执行搜索
  const handleSearchClick = () => {
    // 确保newsData存在
    if (!newsData || newsData.length === 0) {
      console.log('No data available for search');
      return;
    }

    console.log('Performing search with:', {
      searchText,
      timeRange,
      selectedAreas,
      eventLibrary,
      heatRange,
      selectedPlatform,
    });

    const filtered = newsData
      .filter((item) => {
        // 标题和描述搜索过滤
        const titleMatch =
          !searchText || searchText.trim() === ''
            ? true
            : item.title.toLowerCase().includes(searchText.toLowerCase()) ||
              item.description.toLowerCase().includes(searchText.toLowerCase());

        // 时间范围过滤 - 如果时间范围为空则不过滤
        let timeMatch = true;
        if (timeRange && timeRange[0] && timeRange[1]) {
          const startDate = dayjs(timeRange[0]).startOf('day');
          const endDate = dayjs(timeRange[1]).endOf('day');
          const itemDate = dayjs(item.date);
          timeMatch = itemDate.isBetween(startDate, endDate, null, '[]');
        }

        // 领域标签过滤 - 如果未选择标签则不过滤
        const areaMatch = selectedAreas.length === 0 ? true : selectedAreas.includes(item.area);

        // 事件库过滤 - 如果选择全部则不过滤
        const libraryMatch =
          eventLibrary === 'all' ? true : eventLibrary === 'hot' ? item.heatValue > 5000 : true;

        // 热度范围过滤
        let heatMatch = true;
        if (heatRange !== 'all') {
          if (heatRange === 'high') {
            heatMatch = item.heatValue > 8000;
          } else if (heatRange === 'medium') {
            heatMatch = item.heatValue >= 3000 && item.heatValue <= 8000;
          } else if (heatRange === 'low') {
            heatMatch = item.heatValue < 3000;
          }
        }

        // 平台过滤
        const platformMatch = selectedPlatform === 'all' ? true : item.platform === selectedPlatform;

        return titleMatch && timeMatch && areaMatch && libraryMatch && heatMatch && platformMatch;
      })
      .sort((a, b) => {
        if (sortType === 'option1') {
          // 按时间降序
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        } else if (sortType === 'option2') {
          // 按热度降序
          return b.heatValue - a.heatValue;
        } else if (sortType === 'option3') {
          // 按时间升序
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        } else if (sortType === 'option4') {
          // 按热度升序
          return a.heatValue - b.heatValue;
        }
        return 0;
      });

    console.log(`Search found ${filtered.length} results out of ${newsData.length} total items`);
    setFilteredData(filtered);
    setCurrentPage(1); // 重置到第一页
  };

  // 使用useEffect在筛选条件更改后自动搜索
  useEffect(() => {
    if (!loading && newsData.length > 0) {
      handleSearchClick();
    }
  }, [sortType, eventLibrary, timeRange, searchText, selectedAreas, loading, newsData, selectedPlatform, heatRange]);

  return (
    <div
      style={{
        padding: '16px 24px',
        minHeight: '100vh',
        backgroundColor: '#ffffff'
      }}
    >
      {/* 顶部搜索区域 - 参考哔哩哔哩设计 */}
      <div style={{
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        padding: '16px 0'
      }}>
        <div style={{
          display: 'flex',
          width: '70%',
          maxWidth: '800px',
          position: 'relative',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <Input
            placeholder="搜索事件名称或关键词..."
            value={searchText}
            onChange={handleSearch}
            style={{
              width: '100%',
              height: '42px',
              fontSize: '16px',
              padding: '0 16px',
              border: 'none',
              borderRadius: '8px 0 0 8px',
            }}
            onPressEnter={() => {
              setTimeout(() => handleSearchClick(), 0);
            }}
            allowClear={{
              clearIcon: (
                <span
                  onClick={() => {
                    setSearchText('');
                    setTimeout(() => handleSearchClick(), 0);
                  }}
                >
                  ×
                </span>
              ),
            }}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => handleSearchClick()}
            style={{
              height: '42px',
              width: '80px',
              borderRadius: '0 8px 8px 0',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            搜索
          </Button>
        </div>
      </div>

      {/* 筛选导航栏 - 参考哔哩哔哩设计 */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: '1px solid #f0f0f0',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginRight: '24px', marginBottom: '8px' }}>
          <span style={{ marginRight: '8px', fontSize: '14px', color: '#666' }}>排序:</span>
          <Select
            value={sortType}
            onChange={handleSortChange}
            style={{ width: '120px' }}
            size="middle"
            bordered={false}
            dropdownMatchSelectWidth={false}
          >
            <Option value="option1">时间降序</Option>
            <Option value="option3">时间升序</Option>
            <Option value="option2">热度降序</Option>
            <Option value="option4">热度升序</Option>
          </Select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginRight: '24px', marginBottom: '8px' }}>
          <span style={{ marginRight: '8px', fontSize: '14px', color: '#666' }}>热度:</span>
          <Select
            value={heatRange}
            onChange={handleHeatRangeChange}
            style={{ width: '120px' }}
            size="middle"
            bordered={false}
            dropdownMatchSelectWidth={false}
          >
            <Option value="all">全部热度</Option>
            <Option value="high">高热度</Option>
            <Option value="medium">中热度</Option>
            <Option value="low">低热度</Option>
          </Select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginRight: '24px', marginBottom: '8px' }}>
          <span style={{ marginRight: '8px', fontSize: '14px', color: '#666' }}>平台:</span>
          <Select
            value={selectedPlatform}
            onChange={handlePlatformChange}
            style={{ width: '120px' }}
            size="middle"
            bordered={false}
            dropdownMatchSelectWidth={false}
          >
            <Option value="all">全部平台</Option>
            {Object.keys(platformAvatars).map(platform => (
              <Option key={platform} value={platform}>
                <img
                  src={platformAvatars[platform]}
                  alt={platform}
                  style={{ width: '16px', height: '16px', marginRight: '4px', verticalAlign: 'text-bottom' }}
                />
                {platform}
              </Option>
            ))}
          </Select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginRight: '24px', marginBottom: '8px' }}>
          <span style={{ marginRight: '8px', fontSize: '14px', color: '#666' }}>事件库:</span>
          <Select
            value={eventLibrary}
            onChange={handleEventLibraryChange}
            style={{ width: '120px' }}
            size="middle"
            bordered={false}
            dropdownMatchSelectWidth={false}
          >
            <Option value="all">全部事件</Option>
            <Option value="hot">热门事件</Option>
            <Option value="custom">自定义</Option>
          </Select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginRight: 'auto', marginBottom: '8px' }}>
          <span style={{ marginRight: '8px', fontSize: '14px', color: '#666' }}>日期:</span>
          <RangePicker
            value={timeRange}
            onChange={handleTimeChange}
            size="middle"
            style={{ width: '250px' }}
            bordered={false}
            allowClear={true}
            placeholder={['开始日期', '结束日期']}
          />
        </div>

        <Button
          type="link"
          onClick={toggleTagsCollapse}
          style={{ marginBottom: '8px' }}
        >
          标签筛选 {selectedAreas.length > 0 && `(${selectedAreas.length})`} {tagsCollapsed ? <DownOutlined /> : <UpOutlined />}
        </Button>
      </div>

      {/* 标签筛选卡片 - 只在展开时显示 */}
      {!tagsCollapsed && (
        <Card
          id="tag-filter-card"
          style={{
            marginBottom: '24px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            backgroundColor: '#ffffff',
            position: 'relative',
            zIndex: 10
          }}
          bodyStyle={{ padding: '16px' }}
        >
          <div style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <Button size="small" onClick={handleSelectAllTags}>全选</Button>
            <Button size="small" onClick={handleInvertSelection}>反选</Button>
            {selectedAreas.length > 0 && (
              <Button
                size="small"
                type="link"
                onClick={() => setSelectedAreas([])}
              >
                清空
              </Button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#999' }}>
              已选择 {selectedAreas.length}/{uniqueAreas.length} 个标签
            </span>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              maxHeight: '240px',
              overflowY: 'auto',
              padding: '12px',
              border: '1px solid #f0f0f0',
              borderRadius: '4px',
              marginBottom: '12px',
              backgroundColor: '#fafafa'
            }}>
              <CheckboxGroup
                options={getCurrentPageTags()}
                value={selectedAreas}
                onChange={handleAreaChange as any}
              />
            </div>

            <Pagination
              size="small"
              total={uniqueAreas.length}
              current={tagPage}
              pageSize={tagsPerPage}
              onChange={handleTagPageChange}
              showSizeChanger={false}
              showQuickJumper={false}
              style={{ textAlign: 'center' }}
              className="custom-pagination"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="primary"
              size="small"
              icon={<SearchOutlined />}
              onClick={handleSearchClick}
              style={{ borderRadius: '4px' }}
            >
              应用筛选
            </Button>
            <Button
              type="default"
              size="small"
              onClick={handleResetFilters}
              style={{ marginLeft: '8px' }}
            >
              重置筛选
            </Button>
          </div>
        </Card>
      )}

      {/* 加载状态 */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" tip="加载数据中..." />
        </div>
      )}

      {/* 列表内容 */}
      {!loading && (
        <>
          <Row gutter={24}>
            {currentPageData.map((item, index) => (
              <Col key={index} xs={24} sm={24} md={12} lg={8} xl={8} style={{ marginBottom: 24 }}>
                <Card
                  hoverable
                  style={{
                    borderRadius: '8px',
                    height: '100%',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    backgroundColor: '#ffffff'
                  }}
                  bodyStyle={{ padding: '16px', height: '100%' }}
                  onClick={() => handleCardClick(item)}
                >
                  <Flex align="center" style={{ marginBottom: 16 }}>
                    <Avatar
                      icon={<UserOutlined />}
                      src={item.platform && platformAvatars[item.platform] ? platformAvatars[item.platform] : undefined}
                      size={54}
                      style={{}}
                    />
                    <div style={{ marginLeft: 16, flex: 1 }}>
                      <Flex align="center" gap={8}>
                        <Title
                          level={4}
                          style={{
                            margin: 0,
                            color: token.colorTextHeading,
                          }}
                        >
                          {item.title}
                        </Title>
                        <Tag
                          color={primaryColor}
                          style={{
                            borderRadius: '12px',
                            fontSize: '14px',
                          }}
                        >
                          {item.area}
                        </Tag>
                      </Flex>
                      <Flex align="center" style={{ marginTop: 4 }}>
                        <CalendarOutlined
                          style={{ color: token.colorTextSecondary, marginRight: 4 }}
                        />
                        <span style={{ color: token.colorTextSecondary, fontSize: '14px' }}>
                          {item.date}
                        </span>
                      </Flex>
                    </div>
                  </Flex>

                  <Paragraph
                    ellipsis={{ rows: 3 }}
                    style={{
                      fontSize: '14px',
                      color: token.colorTextSecondary,
                      marginBottom: 16,
                      height: '60px',
                    }}
                  >
                    {item.description}
                  </Paragraph>

                  <Flex justify="center" align="center" style={{ marginTop: 'auto' }}>
                    <Statistic
                      title={
                        <Flex align="center" justify="center">
                          <FireOutlined style={{ color: primaryColor }} />
                          <span style={{ marginLeft: 4 }}>热度值</span>
                        </Flex>
                      }
                      value={item.heatValue}
                      valueStyle={{
                        fontSize: '2em',
                        background: `linear-gradient(45deg, #a0d7ff, #1890ff 80%)`,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textAlign: 'center',
                      }}
                    />
                  </Flex>
                </Card>
              </Col>
            ))}
          </Row>

          {filteredData.length === 0 && !loading ? (
            <Card style={{
              textAlign: 'center',
              padding: '40px 0',
              borderRadius: '8px',
              backgroundColor: '#ffffff'
            }}>
              没有找到符合条件的新闻事件
            </Card>
          ) : (
            <Row justify="center" style={{ marginTop: 32, marginBottom: 32 }}>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={filteredData.length}
                onChange={handlePageChange}
                showSizeChanger={false}
                showQuickJumper
                showTotal={(total) => `共 ${total} 条数据`}
                className="custom-pagination"
                itemRender={(page, type, element) => {
                  if (type === 'page' && page === currentPage) {
                    return (
                      <div
                        style={{
                          backgroundColor: primaryColor,
                          color: 'white',
                          borderRadius: '4px',
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {page}
                      </div>
                    );
                  }
                  return element;
                }}
              />
            </Row>
          )}
        </>
      )}

      {/* 添加自定义CSS */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .filter-card.expanded {
          max-height: 400px;
        }

        .custom-pagination .ant-pagination-item-active {
          background-color: ${primaryColor};
          border-color: ${primaryColor};
        }

        .custom-pagination .ant-pagination-item-active a {
          color: white;
        }
      `
      }} />
    </div>
  );
};

export default Articles;
