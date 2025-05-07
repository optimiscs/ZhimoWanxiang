import React from 'react';
import { createStyles } from 'antd-style';
import './auth.less';

const useStyles = createStyles(({ token }) => {
  return {
    container: {
      position: 'relative',
      width: '100%',
      maxWidth: '500px',
      margin: '0 auto',
      padding: '20px',
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      marginBottom: '24px',
      color: token.colorText,
      textAlign: 'center',
    },
    cardContent: {
      padding: '24px',
    },
    inputField: {
      marginBottom: '16px',
      width: '100%',
      padding: '10px 12px',
      border: '1px solid rgba(0, 0, 0, 0.1)',
      borderRadius: '4px',
      fontSize: '14px',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
    },
    button: {
      padding: '10px 16px',
      backgroundColor: token.colorPrimary,
      color: '#fff',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      transition: 'background-color 0.3s',
      fontWeight: 'bold',
      width: '100%',
      marginTop: '8px',
      '&:hover': {
        backgroundColor: token.colorPrimaryActive,
      },
    },
  };
});

/**
 * Example component demonstrating how to use stacked cards with frosted glass effect
 */
const StackedCards: React.FC = () => {
  const { styles } = useStyles();

  return (
    <div className={styles.container}>
      {/* Main card (top) */}
      <div className="frost-glass stacked-card top-card" style={{ padding: '24px' }}>
        <div className={styles.title}>主卡片</div>
        <div className={styles.cardContent}>
          <input
            type="text"
            className={styles.inputField}
            placeholder="用户名"
          />
          <input
            type="password"
            className={styles.inputField}
            placeholder="密码"
          />
          <button className={styles.button}>登录</button>
        </div>
      </div>

      {/* Background card (depth effect) */}
      <div className="frost-glass stacked-card depth-card light-blur">
        <div style={{ height: '200px' }}></div>
      </div>
    </div>
  );
};

/**
 * Example of a more complex stacked card layout
 */
export const MultipleStackedCards: React.FC = () => {
  const { styles } = useStyles();

  return (
    <div className="stacked-cards-container" style={{ margin: '50px auto', maxWidth: '500px' }}>
      {/* Base card */}
      <div className="frost-glass base-card" style={{ padding: '30px', marginBottom: '15px' }}>
        <div className={styles.title}>欢迎登录</div>

        {/* First stacked card */}
        <div className="frost-glass stacked-card" style={{ padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 15px 0' }}>账号登录</h3>
          <input
            type="text"
            className={styles.inputField}
            placeholder="邮箱"
          />
          <input
            type="password"
            className={styles.inputField}
            placeholder="密码"
          />
          <button className={styles.button}>登录</button>
        </div>

        {/* Second stacked card with different blur intensity */}
        <div className="frost-glass stacked-card high-blur" style={{ padding: '15px' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>其他登录方式</p>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer' }}>微信</button>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer' }}>QQ</button>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer' }}>微博</button>
          </div>
        </div>
      </div>

      {/* Background decorative cards */}
      <div
        className="frost-glass depth-card light-blur"
        style={{
          position: 'absolute',
          top: '20px',
          right: '-15px',
          width: '80%',
          height: '200px',
          zIndex: 0,
          transform: 'rotate(3deg)',
        }}
      ></div>

      <div
        className="frost-glass depth-card medium-blur"
        style={{
          position: 'absolute',
          bottom: '-15px',
          left: '-15px',
          width: '80%',
          height: '150px',
          zIndex: 0,
          transform: 'rotate(-2deg)',
        }}
      ></div>
    </div>
  );
};

export default StackedCards;
