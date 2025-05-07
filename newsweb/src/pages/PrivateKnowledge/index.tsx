import React, { useState, useEffect } from 'react';
import {
  Layout,
  Card,
  Typography,
  Upload,
  Button,
  Form,
  Input,
  Select,
  Table,
  Divider,
  Tag,
  Space,
  message,
  Tooltip,
  Modal,
  Progress
} from 'antd';
import {
  InboxOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileUnknownOutlined,
  InfoCircleOutlined,
  EditOutlined,
  GlobalOutlined,
  LockOutlined
} from '@ant-design/icons';
import { createStyles } from 'antd-style';
import axios from 'axios';
import dayjs from 'dayjs';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;
const { TextArea } = Input;
const { Option } = Select;

// 文件类型图标映射
const FileTypeIcon = ({ type }: { type: string }) => {
  switch (type.toLowerCase()) {
    case 'pdf':
      return <FilePdfOutlined style={{ color: '#ff4d4f' }} />;
    case 'doc':
    case 'docx':
      return <FileWordOutlined style={{ color: '#1890ff' }} />;
    case 'xls':
    case 'xlsx':
      return <FileExcelOutlined style={{ color: '#52c41a' }} />;
    case 'txt':
      return <FileTextOutlined style={{ color: '#faad14' }} />;
    default:
      return <FileUnknownOutlined style={{ color: '#722ed1' }} />;
  }
};

// 样式定义
const useStyles = createStyles(({ token, css }) => {
  return {
    container: css`
      padding: 24px;
      background: ${token.colorBgContainer};
    `,
    header: css`
      margin-bottom: 24px;
    `,
    card: css`
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
      margin-bottom: 24px;
    `,
    dragger: css`
      border-radius: 8px;
    `,
    formItem: css`
      margin-bottom: 16px;
    `,
    divider: css`
      margin: 24px 0;
    `,
    tableCard: css`
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    `,
    tagPublic: css`
      background: ${token.colorPrimary}15;
      color: ${token.colorPrimary};
      border: 1px solid ${token.colorPrimary}30;
    `,
    tagPrivate: css`
      background: ${token.colorError}15;
      color: ${token.colorError};
      border: 1px solid ${token.colorError}30;
    `,
    visibilityLabel: css`
      display: flex;
      align-items: center;
      gap: 4px;
    `,
    progress: css`
      margin-top: 12px;
    `,
  };
});

// 知识项类型定义
interface KnowledgeItem {
  id: string;
  title: string;
  description: string;
  category: string;
  fileType: string;
  fileName: string;
  fileSize: number;
  visibility: 'public' | 'private';
  uploadDate: string;
  status: 'active' | 'pending' | 'processing';
}

// 模拟获取知识列表API
const fetchKnowledgeList = async (): Promise<KnowledgeItem[]> => {
  // 在实际项目中应替换为真实API调用
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          id: '1',
          title: '金融行业危机应对手册',
          description: '针对金融行业各类危机事件的应对指南和最佳实践',
          category: 'finance',
          fileType: 'pdf',
          fileName: '金融危机应对手册v2.1.pdf',
          fileSize: 2457600, // 2.4MB
          visibility: 'private',
          uploadDate: '2025-03-15T08:30:00',
          status: 'active'
        },
        {
          id: '2',
          title: '科技企业公关策略集',
          description: '针对科技企业的舆情分析和公关策略方法论',
          category: 'tech',
          fileType: 'docx',
          fileName: 'tech_PR_strategies.docx',
          fileSize: 1843200, // 1.8MB
          visibility: 'public',
          uploadDate: '2025-03-05T14:20:00',
          status: 'active'
        },
        {
          id: '3',
          title: '食品安全舆情案例集',
          description: '近年来国内外重大食品安全舆情事件分析和处理案例',
          category: 'food',
          fileType: 'xlsx',
          fileName: 'food_safety_cases.xlsx',
          fileSize: 3276800, // 3.2MB
          visibility: 'private',
          uploadDate: '2025-03-10T10:15:00',
          status: 'active'
        }
      ]);
    }, 500);
  });
};

// 格式化文件大小
const formatFileSize = (size: number): string => {
  if (size < 1024) {
    return `${size} B`;
  } else if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  } else if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
};

const PrivateKnowledgePage: React.FC = () => {
  const { styles } = useStyles();
  const [form] = Form.useForm();
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);

  // 页面加载时获取知识列表
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchKnowledgeList();
        setKnowledgeList(data);
      } catch (error) {
        message.error('获取知识列表失败');
        console.error('Error fetching knowledge list:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // 处理上传前的校验
  const beforeUpload = (file: File) => {
    const isValidType = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ].includes(file.type);

    if (!isValidType) {
      message.error('请上传PDF、Word、Excel、TXT或CSV文件!');
      return Upload.LIST_IGNORE;
    }

    const isLt50M = file.size / 1024 / 1024 < 50;
    if (!isLt50M) {
      message.error('文件大小不能超过50MB!');
      return Upload.LIST_IGNORE;
    }

    return true;
  };

  // 处理上传状态变更
  const handleChange = (info: any) => {
    setFileList(info.fileList);

    // 限制只保留一个文件
    if (info.fileList.length > 1) {
      setFileList([info.fileList[info.fileList.length - 1]]);
    }
  };

  // 模拟上传知识
  const handleUpload = async (values: any) => {
    if (fileList.length === 0) {
      message.warning('请先上传文件');
      return;
    }

    setUploading(true);

    // 创建模拟上传进度
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 10);
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        // 模拟上传完成后处理
        setTimeout(() => {
          setUploading(false);
          setUploadModalVisible(false);
          setUploadProgress(0);
          setFileList([]);
          form.resetFields();

          // 添加到列表中
          const newItem: KnowledgeItem = {
            id: Math.random().toString(36).substring(2, 10),
            title: values.title,
            description: values.description,
            category: values.category,
            fileType: fileList[0].name.split('.').pop(),
            fileName: fileList[0].name,
            fileSize: fileList[0].size,
            visibility: values.visibility,
            uploadDate: new Date().toISOString(),
            status: 'active'
          };

          setKnowledgeList([newItem, ...knowledgeList]);
          message.success('知识库资料上传成功!');
        }, 500);
      }
      setUploadProgress(progress);
    }, 200);
  };

  // 删除知识项
  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后将无法恢复，确定要删除该知识资料吗？',
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        setKnowledgeList(knowledgeList.filter(item => item.id !== id));
        message.success('删除成功');
      }
    });
  };

  // 表格列定义
  const columns = [
    {
      title: '知识标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: KnowledgeItem) => (
        <Space>
          <FileTypeIcon type={record.fileType} />
          <Text strong>{text}</Text>
          {record.visibility === 'public' ? (
            <Tag className={styles.tagPublic}>
              <GlobalOutlined /> 公开
            </Tag>
          ) : (
            <Tag className={styles.tagPrivate}>
              <LockOutlined /> 私有
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => {
        const categoryMap: {[key: string]: {color: string, label: string}} = {
          finance: {color: '#1890ff', label: '金融'},
          tech: {color: '#52c41a', label: '科技'},
          food: {color: '#faad14', label: '食品'},
          health: {color: '#eb2f96', label: '医疗健康'},
          education: {color: '#722ed1', label: '教育'},
          realestate: {color: '#fa541c', label: '房地产'},
          other: {color: '#595959', label: '其他'}
        };

        const { color, label } = categoryMap[category] || categoryMap.other;

        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: '文件信息',
      key: 'fileInfo',
      render: (text: string, record: KnowledgeItem) => (
        <Space direction="vertical" size={0}>
          <Text type="secondary" style={{ fontSize: '12px' }}>{record.fileName}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>{formatFileSize(record.fileSize)}</Text>
        </Space>
      ),
    },
    {
      title: '上传时间',
      dataIndex: 'uploadDate',
      key: 'uploadDate',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: KnowledgeItem) => (
        <Space size="middle">
          <Tooltip title="编辑">
            <Button type="text" icon={<EditOutlined />} />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Content className={styles.container}>
      <div className={styles.header}>
        <Title level={4}>私有知识库管理</Title>
        <Paragraph type="secondary">
          上传专业领域文档，提升舆情策略生成系统的知识基础和分析能力
        </Paragraph>
      </div>

      <Card className={styles.card}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: '16px' }}>
          <Text strong style={{ fontSize: '16px' }}>知识资料列表</Text>
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            onClick={() => setUploadModalVisible(true)}
          >
            上传知识
          </Button>
        </Space>
        <Table
          columns={columns}
          dataSource={knowledgeList}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 上传知识弹窗 */}
      <Modal
        title="上传知识资料"
        open={uploadModalVisible}
        onCancel={() => {
          if (!uploading) {
            setUploadModalVisible(false);
            setFileList([]);
            form.resetFields();
          }
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpload}
        >
          <Form.Item
            name="title"
            label="知识标题"
            rules={[{ required: true, message: '请输入知识标题' }]}
          >
            <Input placeholder="输入标题，简洁描述知识内容" maxLength={50} />
          </Form.Item>

          <Form.Item
            name="category"
            label="知识分类"
            rules={[{ required: true, message: '请选择知识分类' }]}
          >
            <Select placeholder="选择知识所属领域分类">
              <Option value="finance">金融</Option>
              <Option value="tech">科技</Option>
              <Option value="food">食品</Option>
              <Option value="health">医疗健康</Option>
              <Option value="education">教育</Option>
              <Option value="realestate">房地产</Option>
              <Option value="other">其他</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="内容描述"
            rules={[{ required: true, message: '请输入内容描述' }]}
          >
            <TextArea
              placeholder="描述该知识的主要内容、适用场景和价值"
              maxLength={200}
              showCount
              rows={4}
            />
          </Form.Item>

          <Form.Item
            name="visibility"
            label="可见性"
            rules={[{ required: true, message: '请选择可见性' }]}
            initialValue="private"
          >
            <Select>
              <Option value="private">
                <div className={styles.visibilityLabel}>
                  <LockOutlined /> 私有（仅自己可用）
                </div>
              </Option>
              <Option value="public">
                <div className={styles.visibilityLabel}>
                  <GlobalOutlined /> 公开（所有用户可用）
                </div>
              </Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="上传文件"
            required
            tooltip={{
              title: '支持PDF、Word、Excel、TXT和CSV格式，单个文件不超过50MB',
              icon: <InfoCircleOutlined />
            }}
          >
            <Dragger
              name="file"
              fileList={fileList}
              beforeUpload={beforeUpload}
              onChange={handleChange}
              multiple={false}
              showUploadList={true}
              maxCount={1}
              className={styles.dragger}
              disabled={uploading}
              customRequest={({ onSuccess }) => {
                // 自定义上传方法，实际项目中替换为真实API调用
                setTimeout(() => {
                  onSuccess && onSuccess("ok");
                }, 0);
              }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持PDF、Word、Excel、TXT和CSV格式，单个文件不超过50MB
              </p>
            </Dragger>
          </Form.Item>

          {uploading && (
            <Progress percent={uploadProgress} status="active" className={styles.progress} />
          )}

          <Form.Item style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  if (!uploading) {
                    setUploadModalVisible(false);
                    setFileList([]);
                    form.resetFields();
                  }
                }}
                disabled={uploading}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={uploading}>
                {uploading ? '上传中...' : '上传'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Content>
  );
};

export default PrivateKnowledgePage;
