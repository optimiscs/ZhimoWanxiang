import React from 'react';
import { Card, Row, Col, Tabs, Button, Space, Typography } from 'antd';
import { UserOutlined, LockOutlined, MobileOutlined, KeyOutlined } from '@ant-design/icons';
import './auth.less';

const { Title, Text } = Typography;

/**
 * FrostedGlassDemo - A component that demonstrates how to use frosted glass effects
 * for stacked cards in different UI components.
 */
const FrostedGlassDemo: React.FC = () => {
  // 定义渐变蓝紫色样式
  const blueVioletGradient = {
    background: 'linear-gradient(135deg, #6e8efb 0%, #a777e3 100%)',
    border: 'none',
    color: 'white'
  };

  const gradientTextStyle = {
    background: 'linear-gradient(135deg, #6e8efb 0%, #a777e3 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    textFillColor: 'transparent',
    fontWeight: 600
  };

  return (
    <div style={{
      padding: 24,
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #c850c0 0%, #4158d0 100%)',
      backgroundSize: 'cover'
    }}>
      <Row gutter={[24, 24]} justify="center">
        <Col xs={24} sm={24} md={12} lg={10} xl={8}>
          <Title level={2} style={{ textAlign: 'center', color: 'white', marginBottom: 40 }}>
            Frosted Glass UI Examples
          </Title>

          <Title level={4} style={{ color: 'white', marginBottom: 16 }}>
            Basic Stacked Cards
          </Title>

          {/* Basic stacked cards example */}
          <div className="stacked-cards-container" style={{ height: 320, marginBottom: 60 }}>
            {/* Background decoration card */}
            <Card
              className="frost-glass depth-card light-blur"
              style={{
                width: '90%',
                height: '90%',
                top: 40,
                left: 40,
                transform: 'rotate(-5deg)',
                borderRadius: 16
              }}
            />

            {/* Middle decoration card */}
            <Card
              className="frost-glass depth-card medium-blur"
              style={{
                width: '95%',
                height: '95%',
                top: 20,
                left: 10,
                transform: 'rotate(-2deg)',
                borderRadius: 16
              }}
            />

            {/* Main content card */}
            <Card
              className="frost-glass stacked-card high-blur"
              title="Login"
              style={{ borderRadius: 16, height: '100%' }}
              extra={<UserOutlined />}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <label>Username</label>
                  <input
                    type="text"
                    placeholder="Username"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      background: 'rgba(255, 255, 255, 0.2)',
                      backdropFilter: 'blur(5px)',
                      color: '#333'
                    }}
                  />
                </div>
                <div>
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="Password"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      background: 'rgba(255, 255, 255, 0.2)',
                      backdropFilter: 'blur(5px)',
                      color: '#333'
                    }}
                  />
                </div>

                {/* 添加忘记密码链接 */}
                <div style={{ textAlign: 'right' }}>
                  <a style={gradientTextStyle}>忘记密码</a>
                </div>

                {/* 更新登录按钮使用渐变蓝紫色 */}
                <Button
                  type="primary"
                  block
                  style={blueVioletGradient}
                >
                  登录
                </Button>

                {/* 添加注册链接 */}
                <div style={{ textAlign: 'center', marginTop: 10 }}>
                  <Text>没有账号？<a style={gradientTextStyle}>立即注册</a></Text>
                </div>
              </Space>
            </Card>
          </div>

          <Title level={4} style={{ color: 'white', marginBottom: 16 }}>
            Complex Stacked Cards
          </Title>

          {/* Complex stacked cards example */}
          <div className="stacked-cards-container" style={{ height: 400, marginBottom: 60 }}>
            {/* Background decoration cards */}
            {[...Array(3)].map((_, i) => (
              <Card
                key={`bg-${i}`}
                className="frost-glass depth-card light-blur"
                style={{
                  width: `${80 + i * 5}%`,
                  height: `${80 + i * 5}%`,
                  top: 60 - i * 20,
                  left: 60 - i * 20,
                  transform: `rotate(${-6 + i * 2}deg)`,
                  borderRadius: 16,
                  opacity: 0.6 + i * 0.1
                }}
              />
            ))}

            {/* Main content card */}
            <Card
              className="frost-glass stacked-card high-blur"
              style={{ borderRadius: 16, height: '100%', padding: 0 }}
              bodyStyle={{ padding: 0, height: '100%' }}
            >
              <Tabs
                centered
                items={[
                  {
                    key: '1',
                    label: 'Login',
                    icon: <UserOutlined />,
                    children: (
                      <div style={{ padding: 24 }}>
                        <Space direction="vertical" style={{ width: '100%' }} size="large">
                          <Button block icon={<MobileOutlined />} size="large" className="frost-glass medium-blur">
                            Continue with Phone
                          </Button>
                          <Button block icon={<UserOutlined />} size="large" className="frost-glass medium-blur">
                            Continue with Email
                          </Button>
                          <Button block icon={<LockOutlined />} size="large" className="frost-glass medium-blur">
                            Continue with Password
                          </Button>

                          {/* 更新登录按钮使用渐变蓝紫色 */}
                          <Button block size="large" style={blueVioletGradient}>
                            登录
                          </Button>

                          <div style={{ textAlign: 'center', marginTop: 16 }}>
                            <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                              Don&apos;t have an account? <a style={gradientTextStyle}>立即注册</a>
                            </Text>
                            <div style={{ marginTop: 8 }}>
                              <a style={gradientTextStyle}>忘记密码?</a>
                            </div>
                          </div>
                        </Space>
                      </div>
                    ),
                  },
                  {
                    key: '2',
                    label: 'Register',
                    icon: <KeyOutlined />,
                    children: (
                      <div style={{ padding: 24 }}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Text>Registration form would go here</Text>
                          <Button style={blueVioletGradient} block size="large">立即注册</Button>
                        </Space>
                      </div>
                    ),
                  },
                ]}
              />
            </Card>
          </div>
        </Col>
      </Row>

      <div style={{ padding: 24, textAlign: 'center', color: 'white' }}>
        <Text style={{ color: 'white', opacity: 0.8 }}>
          The frosted glass effect is created using CSS backdrop-filter property.
          Different blur intensities can be applied to create depth.
        </Text>
      </div>
    </div>
  );
};

export default FrostedGlassDemo;
