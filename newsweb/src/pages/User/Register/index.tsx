import { register } from '@/services/ant-design-pro/api';
import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { FormattedMessage, Helmet, history, useIntl } from '@umijs/max';
import { Alert, message } from 'antd';
import { createStyles } from 'antd-style';
import React, { useState } from 'react';
import Settings from '../../../../config/defaultSettings';
import AuthPage from '../AuthPage';

const useStyles = createStyles(() => {
  return {
    registerFormContainer: {
      width: '100%',
    },
    formTitle: {
      fontSize: '24px',
      fontWeight: 'bold',
      marginBottom: '16px',
    },
    formSubtitle: {
      fontSize: '16px',
      color: 'rgba(0, 0, 0, 0.65)',
    },
  };
});

const RegisterMessage: React.FC<{
  content: string;
}> = ({ content }) => {
  return (
    <Alert
      style={{
        marginBottom: 24,
      }}
      message={content}
      type="error"
      showIcon
    />
  );
};

const Register: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const { styles } = useStyles();
  const intl = useIntl();

  const handleSubmit = async (values: API.RegisterParams) => {
    try {
      // 调用注册API
      const msg = await register(values);
      if (msg.success) {
        const defaultRegisterSuccessMessage = intl.formatMessage({
          id: 'pages.register.success',
          defaultMessage: '注册成功！',
        });
        message.success(defaultRegisterSuccessMessage);

        // 注册成功后跳转到登录页
        history.push('/user/login');
        return;
      }

      // 如果失败设置错误信息
      setError(msg.error || '注册失败，请重试');
    } catch (error) {
      const defaultRegisterFailureMessage = intl.formatMessage({
        id: 'pages.register.failure',
        defaultMessage: '注册失败，请重试！',
      });

      message.error(defaultRegisterFailureMessage);
    }
  };

  return (
    <AuthPage type="register">
      <Helmet>
        <title>
          {intl.formatMessage({
            id: 'menu.register',
            defaultMessage: '注册页',
          })}
          - {Settings.title}
        </title>
      </Helmet>
      <div className={styles.registerFormContainer}>
        <div className={styles.formTitle}>智模万象</div>
        <div className={styles.formSubtitle}>
          {intl.formatMessage({ id: 'pages.layouts.userLayout.title' })}
        </div>

        <LoginForm
          logo={null}
          title={null}
          subTitle={null}
          submitter={{
            searchConfig: {
              submitText: intl.formatMessage({
                id: 'pages.register.submit',
                defaultMessage: '注册',
              }),
            },
            submitButtonProps: {
              style: {
                width: '100%',
                background: 'linear-gradient(to right, #4776E6, #8E54E9)',
                borderColor: 'transparent',
              }
            }
          }}
          onFinish={async (values) => {
            await handleSubmit(values as API.RegisterParams);
          }}
        >
          {error && <RegisterMessage content={error} />}

          <ProFormText
            name="username"
            fieldProps={{
              size: 'large',
              prefix: <UserOutlined />,
            }}
            placeholder={intl.formatMessage({
              id: 'pages.register.username.placeholder',
              defaultMessage: '请输入用户名',
            })}
            rules={[
              {
                required: true,
                message: (
                  <FormattedMessage
                    id="pages.register.username.required"
                    defaultMessage="请输入用户名!"
                  />
                ),
              },
            ]}
          />

          <ProFormText
            name="email"
            fieldProps={{
              size: 'large',
              prefix: <MailOutlined />,
            }}
            placeholder={intl.formatMessage({
              id: 'pages.register.email.placeholder',
              defaultMessage: '请输入邮箱',
            })}
            rules={[
              {
                required: true,
                message: (
                  <FormattedMessage
                    id="pages.register.email.required"
                    defaultMessage="请输入邮箱!"
                  />
                ),
              },
              {
                type: 'email',
                message: (
                  <FormattedMessage
                    id="pages.register.email.invalid"
                    defaultMessage="邮箱格式错误!"
                  />
                ),
              },
            ]}
          />

          <ProFormText.Password
            name="password"
            fieldProps={{
              size: 'large',
              prefix: <LockOutlined />,
            }}
            placeholder={intl.formatMessage({
              id: 'pages.register.password.placeholder',
              defaultMessage: '请输入密码',
            })}
            rules={[
              {
                required: true,
                message: (
                  <FormattedMessage
                    id="pages.register.password.required"
                    defaultMessage="请输入密码！"
                  />
                ),
              },
              {
                min: 6,
                message: (
                  <FormattedMessage
                    id="pages.register.password.length"
                    defaultMessage="密码长度至少为6位！"
                  />
                ),
              },
            ]}
          />
        </LoginForm>
      </div>
    </AuthPage>
  );
};

export default Register;
