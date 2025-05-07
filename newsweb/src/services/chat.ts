import { request } from '@umijs/max';

// TypeScript interfaces
export interface ChatSession {
  _id: string;
  user_id: string;
  title: string;
  updated_at: string;
  created_at: string;
  settings: {
    model: string;
    temperature: number;
    enable_search: boolean;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PRStrategyData {
  session_id: string;
  event_summary: string;
  fact_check?: string;
  initial_actions?: string;
  short_term_goals?: string;
  mid_term_goals?: string;
  long_term_goals?: string;
  time_constraints?: string;
  budget_constraints?: string;
  additional_info?: string;
}

export interface TaskResponse {
  task_id: string;
  status: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// API endpoints
const API_BASE = '/api/v1/chat';

// Chat session management
export async function getChatSessions() {
  return request<ApiResponse<ChatSession[]>>(`${API_BASE}/sessions`, {
    method: 'GET',
  });
}

export async function createChatSession(initializeConversation = true) {
  return request<ApiResponse<ChatSession>>(`${API_BASE}/sessions`, {
    method: 'POST',
    data: { initialize_conversation: initializeConversation },
  });
}

export async function getChatSession(sessionId: string) {
  return request<ApiResponse<ChatSession>>(`${API_BASE}/sessions/${sessionId}`, {
    method: 'GET',
  });
}

export async function deleteChatSession(sessionId: string) {
  return request<ApiResponse<{ id: string }>>(`${API_BASE}/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

export async function updateSessionTitle(sessionId: string, title: string) {
  return request<ApiResponse<{ id: string; title: string }>>(`${API_BASE}/sessions/${sessionId}/title`, {
    method: 'PUT',
    data: { title },
  });
}

export async function updateSessionSettings(sessionId: string, settings: any) {
  return request<ApiResponse<{ id: string; settings: any }>>(`${API_BASE}/sessions/${sessionId}/settings`, {
    method: 'PUT',
    data: settings,
  });
}

// Chat messages
export async function getChatHistory(sessionId: string) {
  return request<ApiResponse<ChatMessage[]>>(`${API_BASE}/sessions/${sessionId}/messages`, {
    method: 'GET',
  });
}

export async function sendMessage(sessionId: string, message: string) {
  return request<ApiResponse<{ response: string }>>(`${API_BASE}/sessions/${sessionId}/messages`, {
    method: 'POST',
    data: { message },
  });
}

// For streaming messages, use EventSource directly in the component:
// const eventSource = new EventSource(`/api/v1/chat/sessions/${sessionId}/stream`);

// News analysis
export async function analyzeNews(domain: string) {
  return request<ApiResponse<TaskResponse | any>>(`${API_BASE}/analyze-news`, {
    method: 'POST',
    data: { domain },
  });
}

// PR strategy generation
export async function generatePRStrategy(strategyData: PRStrategyData) {
  return request<ApiResponse<TaskResponse>>(`${API_BASE}/pr-strategy`, {
    method: 'POST',
    data: strategyData,
  });
}

// Task status check
export async function checkTaskStatus(taskId: string) {
  return request<ApiResponse<{ status: string; result?: any }>>(`${API_BASE}/task-status/${taskId}`, {
    method: 'GET',
  });
}

// Export chat
export async function getExportChatUrl(sessionId: string) {
  return `${API_BASE}/export-chat/${sessionId}`;
}

// Custom EventSource wrapper for stream API
export class ChatEventSource {
  private eventSource: EventSource | null = null;
  private sessionId: string;
  private message: string;
  private handlers: {
    onStart?: () => void;
    onMessage?: (chunk: any) => void;
    onError?: (error: any) => void;
    onComplete?: (fullResponse: string) => void;
  };

  constructor(sessionId: string, message: string, handlers: {
    onStart?: () => void;
    onMessage?: (chunk: any) => void;
    onError?: (error: any) => void;
    onComplete?: (fullResponse: string) => void;
  }) {
    this.sessionId = sessionId;
    this.message = message;
    this.handlers = handlers;
  }

  start() {
    // Create a POST request to start the stream
    fetch(`${API_BASE}/sessions/${this.sessionId}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: this.message }),
    }).then(response => {
      if (response.ok) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullResponse = '';

        // Process the stream
        const processStream = () => {
          if (!reader) return;

          reader.read().then(({ done, value }) => {
            if (done) {
              if (this.handlers.onComplete) {
                this.handlers.onComplete(fullResponse);
              }
              return;
            }

            // Decode the chunks and process events
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // Split on double newlines (SSE format)
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';

            for (const event of events) {
              const lines = event.split('\n');
              const eventType = lines[0].replace('event: ', '');
              const data = lines[1].replace('data: ', '');

              if (eventType === 'start' && this.handlers.onStart) {
                this.handlers.onStart();
              } else if (eventType === 'message' && this.handlers.onMessage) {
                try {
                  const parsedData = JSON.parse(data);
                  this.handlers.onMessage(parsedData);

                  // Extract content for the full response
                  if (parsedData.choices && parsedData.choices.length > 0) {
                    const delta = parsedData.choices[0].delta;
                    if (delta && delta.content) {
                      fullResponse += delta.content;
                    }
                  }
                } catch (error) {
                  console.error('Error parsing SSE message:', error);
                }
              } else if (eventType === 'done' && this.handlers.onComplete) {
                this.handlers.onComplete(fullResponse);
              }
            }

            // Continue reading
            processStream();
          }).catch(error => {
            if (this.handlers.onError) {
              this.handlers.onError(error);
            }
          });
        };

        // Start processing
        processStream();
      } else {
        if (this.handlers.onError) {
          this.handlers.onError(new Error(`Server returned ${response.status}`));
        }
      }
    }).catch(error => {
      if (this.handlers.onError) {
        this.handlers.onError(error);
      }
    });
  }
}
