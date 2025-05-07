import React from 'react';
import { BulbOutlined, SearchOutlined, BarChartOutlined, EditOutlined, LoadingOutlined } from '@ant-design/icons';
import { Spin, Space } from 'antd';
import { createStyles } from 'antd-style';

// 定义ThinkingState组件支持的状态类型
export type ThinkingStatus = 'thinking' | 'searching' | 'analyzing' | 'formulating' | 'loading';

// 定义组件接口
export interface ThinkingStateProps {
  status?: ThinkingStatus;
  message?: string;
  style?: React.CSSProperties;
  className?: string;
}

// 创建样式
const useStyles = createStyles(({ token, css }) => ({
  container: css`
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-radius: 8px;
    background-color: ${token.colorBgElevated};
    margin-bottom: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    animation: fadeIn 0.3s ease;

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(5px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `,
  icon: css`
    font-size: 18px;
    margin-right: 12px;
    animation: pulse 1.5s infinite ease-in-out;

    @keyframes pulse {
      0% { opacity: 0.6; }
      50% { opacity: 1; }
      100% { opacity: 0.6; }
    }
  `,
  message: css`
    color: ${token.colorTextSecondary};
    font-size: 14px;
    margin: 0;
  `,
  thinking: css`
    color: ${token.purple6};
  `,
  searching: css`
    color: ${token.blue6};
  `,
  analyzing: css`
    color: ${token.orange6};
  `,
  formulating: css`
    color: ${token.green6};
  `
}));

// ThinkingState组件
const ThinkingState: React.FC<ThinkingStateProps> = ({
  status = 'thinking',
  message = '思考中...',
  style,
  className
}) => {
  const { styles } = useStyles();

  // 根据状态获取对应图标
  const getStatusIcon = () => {
    switch(status) {
      case 'thinking':
        return <BulbOutlined className={`${styles.icon} ${styles.thinking}`} />;
      case 'searching':
        return <SearchOutlined className={`${styles.icon} ${styles.searching}`} />;
      case 'analyzing':
        return <BarChartOutlined className={`${styles.icon} ${styles.analyzing}`} />;
      case 'formulating':
        return <EditOutlined className={`${styles.icon} ${styles.formulating}`} />;
      default:
        return <LoadingOutlined className={styles.icon} />;
    }
  };

  // 构建className
  const containerClassName = `${styles.container} ${className || ''}`;

  return (
    <div className={containerClassName} style={style}>
      {getStatusIcon()}
      <p className={styles.message}>{message}</p>
      <Space style={{ marginLeft: 'auto' }}>
        <Spin size="small" />
      </Space>
    </div>
  );
};

export default ThinkingState;
