import os
import json
import datetime
import traceback
from bson import ObjectId
from flask import current_app
from openai import OpenAI
from ..extensions import db
from celery_app import celery
import logging
import re
import time

# 添加自定义JSON编码器，处理datetime对象序列化
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime.datetime):
            return obj.isoformat()
        elif isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)

# 安全的JSON序列化辅助函数
def safe_json_data(data):
    """将任何无法序列化的对象转换为可序列化的格式"""
    if isinstance(data, dict):
        return {k: safe_json_data(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [safe_json_data(item) for item in data]
    elif isinstance(data, (datetime.datetime, datetime.date)):
        return data.isoformat()
    elif isinstance(data, ObjectId):
        return str(data)
    else:
        return data

class ChatService:
    """
    Service for handling chat operations including PR strategy generation using LLM
    """
    
    @staticmethod
    def get_prompt_template():
        """Load the PR strategy prompt template"""
        try:
            prompt_file = current_app.config.get('PR_STRATEGY_PROMPT_FILE', 'templates/pr_strategy_prompt.txt')
            with open(prompt_file, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            current_app.logger.error(f"无法加载提示词文件: {str(e)}")
            return None
    
    @staticmethod
    def create_chat_session(user_id):
        """Create a new chat session for a user"""
        try:
            # Get the system prompt
            system_prompt = ChatService.get_prompt_template()
            print(system_prompt)
            if not system_prompt:
                system_prompt = """**基于AI对话的公关策略生成器**

你是一位顶级的整合策略顾问和AI助手，拥有深厚的行业分析能力和丰富的策略规划经验。通过引导式对话理解用户需求，结合实时热点分析，自动生成专业、全面的公关与商业整合策略方案。

你有能力通过互联网搜索实时信息。当涉及到公司背景信息、最新舆情事件和行业动态时，请主动利用搜索功能获取最新信息，提供更准确的分析。"""
            
            # Create initial message array with system prompt
            messages = [{"role": "system", "content": system_prompt}]
            
            # Insert into database
            result = db.chat_sessions.insert_one({
                'user_id': ObjectId(user_id),
                'messages': messages,
                'created_at': datetime.datetime.utcnow(),
                'updated_at': datetime.datetime.utcnow(),
                'title': "新对话", # Default title
                'settings': {
                    'model': 'deepseek/deepseek-chat-v3-0324:online', # Default model
                    'temperature': 0.2,
                    'enable_search': True
                }
            })
            
            return str(result.inserted_id)
        except Exception as e:
            current_app.logger.error(f"创建聊天会话失败: {str(e)}")
            traceback.print_exc()
            return None
    
    @staticmethod
    def get_chat_sessions(user_id):
        """Get all chat sessions for a user"""
        try:
            sessions = list(db.chat_sessions.find(
                {'user_id': ObjectId(user_id)},
                {'messages': 0} # Exclude messages to reduce payload
            ).sort('updated_at', -1))
            
            # Convert ObjectId to string
            for session in sessions:
                session['_id'] = str(session['_id'])
                session['user_id'] = str(session['user_id'])
            
            return sessions
        except Exception as e:
            current_app.logger.error(f"获取聊天会话列表失败: {str(e)}")
            traceback.print_exc()
            return []
    
    @staticmethod
    def get_chat_session(session_id):
        """Get a chat session by ID"""
        try:
            session = db.chat_sessions.find_one({'_id': ObjectId(session_id)})
            if not session:
                return None
            
            # Convert ObjectId to string
            session['_id'] = str(session['_id'])
            session['user_id'] = str(session['user_id'])
            
            return session
        except Exception as e:
            current_app.logger.error(f"获取聊天会话失败: {str(e)}")
            traceback.print_exc()
            return None
    
    @staticmethod
    def update_session_title(session_id, title):
        """Update a chat session title"""
        try:
            db.chat_sessions.update_one(
                {'_id': ObjectId(session_id)},
                {'$set': {'title': title, 'updated_at': datetime.datetime.utcnow()}}
            )
            return True
        except Exception as e:
            current_app.logger.error(f"更新聊天会话标题失败: {str(e)}")
            traceback.print_exc()
            return False
    
    @staticmethod
    def update_session_settings(session_id, settings):
        """Update a chat session settings"""
        try:
            db.chat_sessions.update_one(
                {'_id': ObjectId(session_id)},
                {'$set': {'settings': settings, 'updated_at': datetime.datetime.utcnow()}}
            )
            return True
        except Exception as e:
            current_app.logger.error(f"更新聊天会话设置失败: {str(e)}")
            traceback.print_exc()
            return False
    
    @staticmethod
    def delete_chat_session(session_id):
        """Delete a chat session"""
        try:
            db.chat_sessions.delete_one({'_id': ObjectId(session_id)})
            return True
        except Exception as e:
            current_app.logger.error(f"删除聊天会话失败: {str(e)}")
            traceback.print_exc()
            return False
    
    @staticmethod
    def add_message(session_id, role, content, retry_count=3):
        """Add a message to a chat session with retry mechanism"""
        current_app.logger.debug(f"添加消息到会话 {session_id}, 角色: {role}, 内容长度: {len(content)}")
        
        # 重试计数器
        attempt = 0
        last_error = None
        
        while attempt < retry_count:
            try:
                # Get the first user message to set as title if this is the first user message
                is_first_user_message = False
                session = db.chat_sessions.find_one({'_id': ObjectId(session_id)})
                if session:
                    user_messages = [m for m in session.get('messages', []) if m.get('role') == 'user']
                    is_first_user_message = len(user_messages) == 0 and role == 'user'
                else:
                    current_app.logger.error(f"会话 {session_id} 不存在")
                    return False
            
                # Add message to session with timestamp for better tracking
                result = db.chat_sessions.update_one(
                    {'_id': ObjectId(session_id)},
                    {
                        '$push': {'messages': {
                            'role': role, 
                            'content': content,
                            'timestamp': datetime.datetime.utcnow().isoformat()  # 直接存储为ISO格式字符串
                        }},
                        '$set': {'updated_at': datetime.datetime.utcnow()}
                    }
                )
            
                # If this is the first user message, update the title
                if is_first_user_message and content:
                    title = content[:30] + ('...' if len(content) > 30 else '')
                    ChatService.update_session_title(session_id, title)
            
                if result.modified_count > 0:
                    current_app.logger.debug(f"成功添加消息到会话 {session_id}")
                    return True
                else:
                    current_app.logger.warning(f"消息添加操作未修改任何文档，会话ID: {session_id}")
                    # 检查会话是否仍然存在，可能在我们尝试添加消息时被删除
                    session_exists = db.chat_sessions.count_documents({'_id': ObjectId(session_id)})
                    if not session_exists:
                        current_app.logger.error(f"无法添加消息：会话 {session_id} 不存在")
                        return False
                    
                    # 会话存在但未修改，可能是重复消息或其他问题
                    attempt += 1
                    # 如果已达到最大重试次数，仍然返回True(假定消息已存在)
                    if attempt >= retry_count:
                        current_app.logger.warning(f"达到最大重试次数({retry_count})，假定消息已存在于会话中")
                        return True
                    
                    # 短暂等待后重试
                    time.sleep(0.5)
            except Exception as e:
                last_error = e
                current_app.logger.error(f"添加消息失败 (尝试 {attempt+1}/{retry_count}): {str(e)}")
                traceback.print_exc()
                attempt += 1
                
                # 如果还有重试机会，等待一段时间后重试
                if attempt < retry_count:
                    time.sleep(0.5 * attempt)  # 使用指数退避策略
                else:
                    break
        
        # 所有重试都失败
        current_app.logger.error(f"添加消息到会话 {session_id} 失败，已尝试 {retry_count} 次: {str(last_error)}")
        return False
    
    @staticmethod
    def get_chat_history(session_id):
        """Get chat history for a session"""
        try:
            session = db.chat_sessions.find_one({'_id': ObjectId(session_id)})
            if not session:
                return []
            
            return session.get('messages', [])
        except Exception as e:
            current_app.logger.error(f"获取聊天历史失败: {str(e)}")
            traceback.print_exc()
            return []
    
    @staticmethod
    def get_model_response(messages, settings=None):
        """
        Get a response from the AI model
        Non-streaming version for simple requests
        """
        if settings is None:
            settings = {
                'model': 'deepseek/deepseek-chat-v3-0324:online',
                'temperature': 0.2,
                'enable_search': True
            }
        
        try:
            # Get API credentials from config
            api_key = current_app.config.get('OPENROUTER_API_KEY') or os.getenv('OPENROUTER_API_KEY')
            base_url = current_app.config.get('OPENROUTER_BASE_URL') or os.getenv('OPENROUTER_BASE_URL')
            
           
            # Create OpenAI client
            client = OpenAI(
                api_key=api_key,
                base_url=base_url
            )
            
            # Setup extra body for optional features like web search
            extra_body = {}
            
            # Add web search if enabled
            if settings.get('enable_search', True):
                extra_body['enable_search'] = True
            
            # Call the API
            response = client.chat.completions.create(
                model=settings.get('model', 'deepseek/deepseek-chat-v3-0324:online'),
                messages=messages,
                temperature=settings.get('temperature', 0.2),
                extra_body=extra_body
            )
            
            # Log token usage
            if hasattr(response, 'usage') and response.usage:
                usage = response.usage
                ChatService.log_token_usage(
                    settings.get('model', 'deepseek/deepseek-chat-v3-0324:online'),
                    usage.prompt_tokens,
                    usage.completion_tokens,
                    usage.total_tokens
                )
            
            return response.choices[0].message.content
        except Exception as e:
            current_app.logger.error(f"API调用失败: {str(e)}")
            traceback.print_exc()
            return f"很抱歉，我在处理您的请求时遇到了问题: {str(e)}"
    
    @staticmethod
    def stream_model_response(messages, settings=None):
        """
        Stream a response from the AI model using Server-Sent Events (SSE).
        Yields dictionaries representing SSE events:
        {'event': 'message', 'data': 'content chunk'}
        {'event': 'thinking', 'data': {'status': '...', 'message': '...'}} # Example, adjust as needed
        {'event': 'error', 'data': {'error': '...'}}
        """
        default_settings = {
            'model': 'deepseek/deepseek-chat-v3-0324:online',
            'temperature': 0.2,
            'enable_search': True # Default search setting
        }
        if settings is None:
            settings = default_settings
        else:
            # Merge user settings with defaults, user settings take precedence
            merged_settings = default_settings.copy()
            merged_settings.update(settings)
            settings = merged_settings

        try:
            api_key = current_app.config.get('OPENROUTER_API_KEY') or os.getenv('OPENROUTER_API_KEY')
            base_url = current_app.config.get('OPENROUTER_BASE_URL') or os.getenv('OPENROUTER_BASE_URL')

            if not api_key or not base_url:
                current_app.logger.error("API Key or Base URL is not configured.")
                yield {'event': 'error', 'data': {'error': 'API 服务未配置'}}
                return

            current_app.logger.debug(f"Streaming API Request: Model={settings.get('model')}, BaseURL={base_url}, SearchEnabled={settings.get('enable_search')}, Messages={len(messages)}")

            client = OpenAI(api_key=api_key, base_url=base_url)

            # 从配置或环境变量获取参数
            max_tokens = current_app.config.get('MAX_TOKENS') or os.getenv('MAX_TOKENS') or 2048
            try:
                max_tokens = int(max_tokens)
            except (ValueError, TypeError):
                max_tokens = 2048
                current_app.logger.warning(f"Invalid MAX_TOKENS value, using default: {max_tokens}")

            # Prepare request parameters
            request_params = {
                'model': settings.get('model'),
                'messages': messages,
                'temperature': settings.get('temperature'),
                'stream': True,
            }
            
            # 只有在不为0的情况下添加 max_tokens 参数
            if max_tokens > 0:
                request_params['max_tokens'] = max_tokens
                current_app.logger.debug(f"Setting max_tokens={max_tokens}")

            # 处理额外参数，通过配置指定不同供应商的特殊参数
            provider_specific_params = current_app.config.get('PROVIDER_SPECIFIC_PARAMS', {})
            # 从环境变量获取额外参数，JSON格式
            env_specific_params = os.getenv('PROVIDER_SPECIFIC_PARAMS')
            if env_specific_params:
                try:
                    import json
                    env_params = json.loads(env_specific_params)
                    if isinstance(env_params, dict):
                        provider_specific_params.update(env_params)
                except Exception as e:
                    current_app.logger.error(f"Failed to parse PROVIDER_SPECIFIC_PARAMS: {e}")
            
            # 添加额外参数到请求
            for key, value in provider_specific_params.items():
                # 确保不添加datetime类型的参数
                if not isinstance(value, (datetime.datetime, datetime.date)):
                    request_params[key] = value
                else:
                    # 如果是日期时间类型，转换为ISO格式字符串
                    request_params[key] = value.isoformat()
                current_app.logger.debug(f"Adding provider-specific parameter: {key}={value}")

            # 添加 web_search 参数到 extra_body
            extra_body = {}
            if settings.get('enable_search', False):
                # 根据 OpenRouter 文档设置 web_search 参数
                web_search_config = current_app.config.get('WEB_SEARCH_CONFIG', {'enable': True})
                # 从环境变量获取替代配置
                env_web_search = os.getenv('WEB_SEARCH_CONFIG')
                if env_web_search:
                    try:
                        web_search_config = json.loads(env_web_search)
                    except Exception as e:
                        current_app.logger.error(f"Failed to parse WEB_SEARCH_CONFIG: {e}")
                
                # 确保web_search_config中没有datetime对象
                web_search_config = safe_json_data(web_search_config)
                extra_body['web_search'] = web_search_config
                current_app.logger.debug(f"Web search enabled with config: {web_search_config}")
                
                # 确保extra_body中没有datetime对象
                extra_body = safe_json_data(extra_body)
                request_params['extra_body'] = extra_body
                
            # 最后检查所有请求参数，确保不含datetime对象
            request_params = safe_json_data(request_params)

            # 发送就绪事件，告知前端准备接收数据
            yield {'event': 'ready', 'data': {'status': 'ready'}}

            # 创建响应流
            current_app.logger.debug(f"Starting API stream request with params: {request_params}")
            response = client.chat.completions.create(**request_params)
            current_app.logger.debug("API stream response started.")

            # 使用更小的缓冲区，更频繁地发送数据
            buffer = ""
            buffer_max_size = 5  # 更小的缓冲区，每5个字符发送一次，提高实时性
            chunk_count = 0
            last_send_time = time.time()
            max_interval = 0.1  # 100ms最大间隔，确保实时性
            
            try:
                for chunk in response:
                    chunk_count += 1
                    if chunk.choices and len(chunk.choices) > 0:
                        delta = chunk.choices[0].delta
                        if hasattr(delta, 'content') and delta.content is not None:
                            content_chunk = delta.content
                            buffer += content_chunk
                            
                            current_time = time.time()
                            # 只要达到缓冲区大小，是首个响应块，或者达到最大时间间隔，立即发送
                            if (len(buffer) >= buffer_max_size or 
                                chunk_count <= 2 or 
                                (current_time - last_send_time) >= max_interval):
                                # 发送当前缓冲区内容
                                yield {'event': 'message', 'data': buffer}
                                if chunk_count % 50 == 0:  # 减少日志频率
                                    current_app.logger.debug(f"Yielding message chunk {chunk_count}: {buffer[:30]}...")
                                buffer = ""  # 清空缓冲区
                                last_send_time = current_time
            except Exception as e:
                error_message = f"Error processing API response chunk: {str(e)}"
                current_app.logger.error(error_message, exc_info=True)
                yield {'event': 'error', 'data': safe_json_data({'error': error_message})}
                # 退出循环，但会继续执行后续代码发送剩余缓冲区

            # 发送剩余的缓冲区内容
            if buffer:
                yield {'event': 'message', 'data': buffer}

            current_app.logger.debug(f"API stream finished after {chunk_count} chunks.")
            # The 'done' event will be sent by the calling generate() function in chat.py

        except Exception as e:
            error_message = f"Streaming API call failed: {str(e)}"
            current_app.logger.error(error_message, exc_info=True)
            # Yield an error event
            yield {'event': 'error', 'data': safe_json_data({'error': error_message})}
    
    @staticmethod
    def log_token_usage(model, prompt_tokens, completion_tokens, total_tokens):
        """Log token usage for billing and monitoring"""
        try:
            db.token_usage.insert_one({
                'timestamp': datetime.datetime.utcnow(),
                'model': model,
                'prompt_tokens': prompt_tokens,
                'completion_tokens': completion_tokens,
                'total_tokens': total_tokens
            })
        except Exception as e:
            current_app.logger.error(f"记录Token使用量失败: {str(e)}")
            traceback.print_exc()
            return None
    
    @staticmethod
    @celery.task(name='chat.save_response', bind=True, max_retries=5)
    def save_response_task(self, session_id, role, content):
        """Celery task to save message to database asynchronously with retry mechanism"""
        try:
            current_app.logger.debug(f"异步保存消息到会话 {session_id}, 角色: {role}, 内容长度: {len(content)}")
            
            # 验证会话存在
            session = db.chat_sessions.find_one({'_id': ObjectId(session_id)})
            if not session:
                current_app.logger.error(f"异步保存消息失败: 会话 {session_id} 不存在")
                return False
                
            # 添加消息到会话
            result = db.chat_sessions.update_one(
                {'_id': ObjectId(session_id)},
                {
                    '$push': {'messages': {
                        'role': role, 
                        'content': content,
                        'timestamp': datetime.datetime.utcnow().isoformat(),  # 直接存储为ISO格式字符串
                        'saved_by': 'async_task'  # 标记为异步任务保存，便于追踪
                    }},
                    '$set': {'updated_at': datetime.datetime.utcnow()}
                }
            )
            
            if result.modified_count > 0:
                current_app.logger.debug(f"异步保存消息成功: session_id={session_id}, role={role}")
                return True
            else:
                current_app.logger.warning(f"异步保存消息操作未修改任何文档: session_id={session_id}")
                
                # 检查消息是否已存在（可能是重复保存）
                existing_msg_count = db.chat_sessions.count_documents({
                    '_id': ObjectId(session_id),
                    'messages': {'$elemMatch': {'role': role, 'content': content}}
                })
                
                if existing_msg_count > 0:
                    current_app.logger.debug(f"消息已存在于会话中，无需重复保存: session_id={session_id}")
                    return True
                else:
                    current_app.logger.error(f"异步保存消息失败: 会话存在但消息未被添加: session_id={session_id}")
                    return False
            
        except Exception as e:
            current_app.logger.error(f"异步保存消息时发生错误: {str(e)}")
            traceback.print_exc()
            
            # 使用Celery内置的重试机制
            try:
                # 使用指数退避策略，最多重试5次
                retry_count = self.request.retries
                countdown = 2 ** retry_count  # 1, 2, 4, 8, 16秒
                self.retry(exc=e, countdown=countdown, max_retries=5)
            except self.MaxRetriesExceededError:
                current_app.logger.error(f"异步保存消息重试次数已达上限: session_id={session_id}")
                return False
                
            return False

    @staticmethod
    @celery.task(name='chat.analyze_hot_news')
    def analyze_hot_news(vertical_domain):
        """
        Analyze hot news for a specific industry domain
        This is a Celery task that performs background analysis
        """
        try:
            current_app.logger.info(f"开始分析 {vertical_domain} 领域的热点新闻...")
            
            # Get recent news from the database
            recent_news = list(db.processed_news.find(
                {"type": {"$regex": vertical_domain, "$options": "i"}},
                {"_id": 0}
            ).sort("rank", 1).limit(5))
            
            # If no domain-specific news found, get general hot news
            if not recent_news:
                recent_news = list(db.processed_news.find(
                    {},
                    {"_id": 0}
                ).sort("rank", 1).limit(5))
            
            # Format news for analysis
            news_text = "\n\n".join([
                f"标题: {news.get('title', '')}\n"
                f"简介: {news.get('introduction', '')}\n"
                f"类型: {news.get('type', '')}\n"
                f"平台: {news.get('platform', '')}"
                for news in recent_news
            ])
            
            # System prompt for analysis
            system_prompt = """你是一位专业的舆情分析助手。请分析以下热点新闻，提取关键信息:
1. 行业风险点: 这些新闻反映了哪些潜在的行业风险?
2. 整体舆情态势: 当前舆论环境的总体特点和倾向
3. 核心关注点: 公众和媒体最关注的问题
4. 最需要关注的事件: 最值得关注的热点事件概述

请简明扼要地提供分析结果，每部分不超过100字。"""
            
            # Create messages for analysis
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"请分析以下{vertical_domain}行业的热点新闻:\n\n{news_text}"}
            ]
            
            # Get analysis from model
            analysis = ChatService.get_model_response(messages)
            
            # Store analysis result
            result_id = db.news_analysis.insert_one({
                'vertical_domain': vertical_domain,
                'analysis': analysis,
                'news_count': len(recent_news),
                'created_at': datetime.datetime.utcnow()
            }).inserted_id
            
            return {
                'status': 'success',
                'analysis_id': str(result_id),
                'vertical_domain': vertical_domain
            }
            
        except Exception as e:
            current_app.logger.error(f"热点新闻分析失败: {str(e)}")
            traceback.print_exc()
            return {
                'status': 'error',
                'error': str(e),
                'vertical_domain': vertical_domain
            }
    
    @staticmethod
    def get_latest_analysis(vertical_domain):
        """Get the latest analysis for a domain"""
        try:
            analysis = db.news_analysis.find_one(
                {'vertical_domain': vertical_domain},
                {'_id': 0}
            )
            
            if not analysis:
                return None
                
            return analysis
        except Exception as e:
            current_app.logger.error(f"获取分析结果失败: {str(e)}")
            traceback.print_exc()
            return None
    
    @staticmethod
    @celery.task(name='chat.generate_pr_strategy')
    def generate_pr_strategy(session_id, strategy_data):
        """
        Generate PR strategy based on collected information
        This is a Celery task that performs background strategy generation
        """
        try:
            current_app.logger.info(f"开始生成公关策略，会话ID: {session_id}")
            
            # Create specialized prompt for strategy generation
            strategy_prompt = f"""作为专业的公关策略顾问，请根据以下信息生成一份全面的公关与商业整合策略:

【事件概要】
{strategy_data.get('event_summary', '无信息')}

【事实核查】
{strategy_data.get('fact_check', '无信息')}

【已采取行动】
{strategy_data.get('initial_actions', '无信息')}

【短期目标】
{strategy_data.get('short_term_goals', '无信息')}

【中期目标】
{strategy_data.get('mid_term_goals', '无信息')}

【长期目标】
{strategy_data.get('long_term_goals', '无信息')}

【时间约束】
{strategy_data.get('time_constraints', '无信息')}

【预算约束】
{strategy_data.get('budget_constraints', '无信息')}

【补充信息】
{strategy_data.get('additional_info', '无信息')}

请提供以下内容:
1. 全面的公关策略，包括危机应对、舆情控制和声誉修复措施
2. 配套的商业策略调整建议，包括业务调整和长期品牌建设
3. 具体实施步骤和时间表
4. 每个策略点的预期效果评估

策略应具有专业性、可行性和针对性。"""
            
            # System prompt
            system_prompt = """你是一位顶级的整合策略顾问和AI助手，拥有深厚的行业分析能力和丰富的策略规划经验。你擅长生成专业、全面的公关与商业整合策略方案。
你有能力通过互联网搜索实时信息。当涉及到公司背景信息、最新舆情事件和行业动态时，请主动利用搜索功能获取最新信息，提供更准确的分析。"""
            
            # Create messages for strategy generation
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": strategy_prompt}
            ]
            
            # Get the session settings
            session = ChatService.get_chat_session(session_id)
            settings = session.get('settings', {}) if session else None
            
            # Generate strategy
            strategy = ChatService.get_model_response(messages, settings)
            
            # Store strategy result
            result_id = db.strategy_results.insert_one({
                'session_id': session_id,
                'strategy_data': strategy_data,
                'strategy': strategy,
                'created_at': datetime.datetime.utcnow()
            }).inserted_id
            
            # Add strategy to chat session as assistant message
            ChatService.add_message(session_id, 'assistant', strategy)
            
            return {
                'status': 'success',
                'strategy_id': str(result_id),
                'session_id': session_id
            }
            
        except Exception as e:
            current_app.logger.error(f"生成公关策略失败: {str(e)}")
            traceback.print_exc()
            
            # Add error message to chat session
            error_msg = f"很抱歉，在生成策略时遇到了问题: {str(e)}"
            ChatService.add_message(session_id, 'assistant', error_msg)
            
            return {
                'status': 'error',
                'error': str(e),
                'session_id': session_id
            }
 