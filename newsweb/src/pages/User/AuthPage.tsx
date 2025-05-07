import React, { useState, useEffect } from 'react';
import { createStyles } from 'antd-style';
import { history, SelectLang } from '@umijs/max';
import { Footer } from '@/components';
import './auth.less';

// Style definitions
const useStyles = createStyles(({ token }) => {
  return {
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      backgroundImage: "url('/back.jpeg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      position: 'relative',
    },
    content: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'flex-end',
      padding: '20px 10%',
      flex: 1,
    },
    card: {
      backdropFilter: 'blur(10px)',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      padding: '32px',
      width: '100%',
      maxWidth: '460px',
      transition: 'all 0.3s ease-in-out',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      overflow: 'hidden',
      position: 'relative',
      marginTop: '50px',
      '&:hover': {
        boxShadow: '0 12px 48px rgba(0, 0, 0, 0.1)',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
      },
    },
    formWrapper: {
      width: '100%',
    },
    switchMode: {
      cursor: 'pointer',
      color: token.colorPrimary,
      textAlign: 'center',
      margin: '16px 0 0',
      fontWeight: 'bold',
      fontSize: '14px',
      transition: 'color 0.3s',
      display: 'inline-block',
      '&:hover': {
        color: token.colorPrimaryActive,
        textDecoration: 'underline',
      },
    },
    lang: {
      width: 42,
      height: 42,
      lineHeight: '42px',
      position: 'fixed',
      right: 16,
      top: 16,
      borderRadius: token.borderRadius,
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      ':hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
      },
    },
    footer: {
      backgroundColor: 'transparent',
      color: 'rgba(255, 255, 255, 0.1)',
      padding: '10px 0',
    }
  };
});

const Lang = () => {
  const { styles } = useStyles();

  return (
    <div className={styles.lang} data-lang>
      {SelectLang && <SelectLang />}
    </div>
  );
};

interface AuthPageProps {
  children: React.ReactNode;
  type: 'login' | 'register';
}

const AuthPage: React.FC<AuthPageProps> = ({ children, type }) => {
  const { styles } = useStyles();
  const [mode, setMode] = useState<'login' | 'register'>(type);
  const [key, setKey] = useState(Date.now()); // Used to trigger animation

  // When type changes, update the mode and trigger animation
  useEffect(() => {
    if (type !== mode) {
      setMode(type);
      setKey(Date.now());
    }
  }, [type, mode]);

  const toggleMode = () => {
    const newMode = mode === 'login' ? 'register' : 'login';
    history.push(`/user/${newMode}`);
  };

  return (
    <div className={styles.container}>
      <Lang />
      <div className={styles.content}>
        <div className={`${styles.card} auth-card frost-glass`}>
          <div key={key} className={`${styles.formWrapper} auth-form`}>
            {children}
            <div style={{ textAlign: 'center' }}>
              <span className={styles.switchMode} onClick={toggleMode}>
                {mode === 'login' ? '没有账号？立即注册' : '已有账号？返回登录'}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.footer}>
        <Footer />
      </div>
    </div>
  );
};

export default AuthPage;
