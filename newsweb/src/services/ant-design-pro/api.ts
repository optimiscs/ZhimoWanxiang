// @ts-ignore
/* eslint-disable */
import { request } from '@umijs/max';

/** 获取当前的用户 GET /api/currentUser */
export async function currentUser(options?: { [key: string]: any }) {
  return request<{
    data: API.CurrentUser;
  }>('/api/currentUser', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 退出登录接口 POST /api/login/outLogin */
export async function outLogin(options?: { [key: string]: any }) {
  return request<Record<string, any>>('/api/login/outLogin', {
    method: 'POST',
    ...(options || {}),
  });
}

/** 登录接口 POST /api/login/account */
export async function login(body: API.LoginParams, options?: { [key: string]: any }) {
  return request<API.LoginResult>('/api/login/account', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 注册接口 POST /api/register */
export async function register(body: API.RegisterParams, options?: { [key: string]: any }) {
  return request<API.RegisterResult>('/api/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/notices */
export async function getNotices(options?: { [key: string]: any }) {
  return request<API.NoticeIconList>('/api/notices', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 获取规则列表 GET /api/rule */
export async function rule(
  params: {
    // query
    /** 当前的页码 */
    current?: number;
    /** 页面的容量 */
    pageSize?: number;
  },
  options?: { [key: string]: any },
) {
  return request<API.RuleList>('/api/rule', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 更新规则 PUT /api/rule */
export async function updateRule(options?: { [key: string]: any }) {
  return request<API.RuleListItem>('/api/rule', {
    method: 'POST',
    data: {
      method: 'update',
      ...(options || {}),
    },
  });
}

/** 新建规则 POST /api/rule */
export async function addRule(options?: { [key: string]: any }) {
  return request<API.RuleListItem>('/api/rule', {
    method: 'POST',
    data: {
      method: 'post',
      ...(options || {}),
    },
  });
}

/** 删除规则 DELETE /api/rule */
export async function removeRule(options?: { [key: string]: any }) {
  return request<Record<string, any>>('/api/rule', {
    method: 'POST',
    data: {
      method: 'delete',
      ...(options || {}),
    },
  });
}

/** 流式聊天接口 - 支持文本和图像 POST /api/v1/chat/sessions/{sessionId}/stream */
export async function streamChat(
  body: {
    message: string; // 用户输入的文本消息
    images?: string[]; // base64 编码的图片数据数组（可选）
    model?: string; // 可选，指定使用的模型名称
  },
  options?: {
    sessionId: string; // 会话ID，必须提供
    onStart?: () => void; // 回调函数：处理流开始事件
    onReady?: () => void; // 回调函数：处理流就绪事件
    onUpdate?: (data: any) => void; // 回调函数：处理流式更新的文本片段
    onSuccess?: (data: any) => void; // 回调函数：处理完整的成功响应
    onError?: (error: Error) => void; // 回调函数：处理错误情况
    onThinking?: (data: any) => void; // 回调函数：处理思考状态更新
    [key: string]: any; // 其他可能的选项参数
  },
): Promise<void> {
  const { sessionId, onStart, onReady, onUpdate, onSuccess, onError, onThinking, ...rest } = options || {};

  // 打印详细的API调用信息，帮助调试
  console.log('streamChat函数调用详情:', {
    messageLength: body?.message?.length,
    hasImages: !!body?.images?.length,
    sessionId,
    timestamp: new Date().toISOString(),
    optionsKeys: Object.keys(options || {})
  });

  // 验证必须提供sessionId
  if (!sessionId) {
    console.error('缺少必要的会话ID');
    if (onError) {
      onError(new Error('缺少必要的会话ID'));
    }
    return;
  }

  // 确保sessionId是字符串且有效
  if (typeof sessionId !== 'string' || sessionId.trim() === '') {
    console.error('会话ID无效:', sessionId);
    if (onError) {
      onError(new Error('会话ID无效'));
    }
    return;
  }

  try {
    // 添加超时处理
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      if (onError) {
        onError(new Error('请求超时'));
      }
    }, 120000); // 120秒超时

    // 构建API URL
    const url = `/api/v1/chat/sessions/${sessionId}/stream`;
    console.log(`请求URL: ${url}, 会话ID: ${sessionId}, 消息长度: ${body.message.length}`);

    // 步骤1: 使用POST请求发送消息
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId // 在header中也传递sessionId作为备份
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    // 清除超时计时器
    clearTimeout(timeoutId);

    // 处理可能的错误响应
    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg;
      try {
        // 尝试解析为JSON
        const errorData = JSON.parse(errorText);
        errorMsg = errorData.error || `服务器错误 (${response.status})`;
      } catch (e) {
        // 如果不是JSON，直接使用文本
        errorMsg = errorText || `服务器错误 (${response.status})`;
      }
      console.error(`API错误响应: ${errorMsg}, 状态码: ${response.status}, 会话ID: ${sessionId}`);
      throw new Error(errorMsg);
    }

    // 步骤2: 创建EventSource获取SSE流
    let fullResponse = '';

    // 确保使用唯一的URL避免缓存
    const evtSourceUrl = `${url}?_t=${Date.now()}`;
    console.log(`创建EventSource连接: ${evtSourceUrl}`);

    const eventSource = new EventSource(evtSourceUrl);

    // 处理流开始事件
    eventSource.addEventListener('start', (event: MessageEvent) => {
      console.log('流开始事件');
      if (onStart) {
        onStart();
      }
    });

    // 处理流就绪事件
    eventSource.addEventListener('ready', (event: MessageEvent) => {
      console.log('流就绪事件');
      if (onReady) {
        onReady();
      }
    });

    // 处理标准消息 (默认事件类型)
    eventSource.onmessage = (event: MessageEvent) => {
      try {
        const text = event.data;
        console.log(`收到消息: ${text.substring(0, 50)}...`);
        fullResponse += text;

        if (onUpdate) {
          onUpdate({ content: text });
        }
      } catch (e) {
        console.error('处理消息事件失败:', e);
      }
    };

    // 处理思考状态更新
    eventSource.addEventListener('thinking', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('收到思考状态:', data);
        if (onThinking) {
          onThinking(data);
        }
      } catch (e) {
        console.error('处理思考事件失败:', e);
      }
    });

    // 处理错误
    eventSource.addEventListener('error', (event: MessageEvent) => {
      try {
        console.error('SSE错误事件:', event);
        let errorData;
        try {
          // @ts-ignore
          if (event.data) {
            // @ts-ignore
            errorData = JSON.parse(event.data);
          } else {
            errorData = { error: '连接错误' };
          }
        } catch (e) {
          errorData = { error: '处理响应时出错' };
        }

        if (onError) {
          onError(new Error(errorData.error || '服务器错误'));
        }
      } catch (e) {
        console.error('处理错误事件失败:', e);
      } finally {
        eventSource.close();
      }
    });

    // 处理警告事件 - 非严重错误，可以继续处理
    eventSource.addEventListener('warning', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.warn('SSE警告事件:', data);
        // 不中断流程，只记录警告
      } catch (e) {
        console.error('处理警告事件失败:', e);
      }
    });

    // 处理完成
    eventSource.addEventListener('done', (event: MessageEvent) => {
      try {
        console.log('SSE完成事件，响应长度:', fullResponse.length);
        if (onSuccess) {
          onSuccess({ content: fullResponse });
        }
      } catch (e) {
        console.error('处理完成事件失败:', e);
      } finally {
        eventSource.close();
      }
    });

    // 网络错误处理
    eventSource.onerror = (error) => {
      console.error('SSE连接错误:', error);
      // 检查readyState，如果已关闭且没有收到消息，可能是连接问题
      if (eventSource.readyState === EventSource.CLOSED && fullResponse.length === 0) {
        if (onError) {
          onError(new Error('无法建立SSE连接，请检查网络或会话状态'));
        }
      }
      eventSource.close();
    };

  } catch (error) {
    // 处理请求过程中的异常
    console.error('请求失败:', error);
    if (onError) {
      onError(error instanceof Error ? error : new Error('未知错误'));
    }
  }
}

/** 检查API服务状态 GET /api/status */
export async function checkApiStatus(options?: { [key: string]: any }) {
  return request<{
    status: string;
    message: string;
  }>('/api/status', {
    method: 'GET',
    ...(options || {}),
  });
}
