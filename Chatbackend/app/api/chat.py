from flask import Blueprint, jsonify, request, current_app, Response, stream_with_context
from flask_login import login_required, current_user
import json
import time
from datetime import datetime
from bson.objectid import ObjectId

from ..services.chat_service import ChatService

# 添加自定义JSON编码器，处理datetime对象序列化
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)

# 辅助函数：安全的JSON序列化
def safe_json_dumps(data):
    try:
        return json.dumps(data, cls=CustomJSONEncoder)
    except TypeError as e:
        current_app.logger.error(f"JSON序列化错误: {str(e)}, 数据类型: {type(data)}")
        # 尝试简化数据结构
        if isinstance(data, dict):
            sanitized_data = {}
            for k, v in data.items():
                if isinstance(v, (str, int, float, bool, type(None))):
                    sanitized_data[k] = v
                else:
                    sanitized_data[k] = str(v)
            return json.dumps(sanitized_data)
        elif isinstance(data, (list, tuple)):
            return json.dumps([str(item) if not isinstance(item, (str, int, float, bool, type(None))) else item for item in data])
        return json.dumps({"error": "无法序列化的数据", "message": str(e)})

chat_api = Blueprint('chat_api', __name__)

@chat_api.route('/sessions', methods=['GET'])
@login_required
def get_chat_sessions():
    """Get all chat sessions for the current user"""
    try:
        sessions = ChatService.get_chat_sessions(current_user.get_id())
        return jsonify({
            "success": True,
            "data": sessions
        })
    except Exception as e:
        current_app.logger.error(f"获取聊天会话列表失败: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@chat_api.route('/sessions', methods=['POST'])
@login_required
def create_chat_session():
    """Create a new chat session"""
    try:
        # Create a new session
        session_id = ChatService.create_chat_session(current_user.get_id())
        if not session_id:
            return jsonify({
                "success": False,
                "error": "创建聊天会话失败"
            }), 500
        
        # Get the created session
        session = ChatService.get_chat_session(session_id)
        
        # Start conversation with initial AI message if specified
        data = request.get_json()
        if data and data.get('initialize_conversation', False):
            settings = session.get('settings', {})
            
            # Get messages without the first user message
            messages = ChatService.get_chat_history(session_id)
            
            # Add a welcome message from the assistant
            welcome_msg = """👋 您好！我是您的AI公关策略顾问。我将通过对话引导您完成信息输入，结合实时热点分析，为您自动生成一份专业的公关商业整合策略报告。整个过程我会处理所有技术细节，您只需要专注于事件本身就好啦。

为了开始，请告诉我您需要处理的舆情事件主要涉及哪个**垂直领域**？（例如：汽车、教育、医药、科技、食品等）"""
            
            # Add the welcome message to the chat history
            ChatService.add_message(session_id, 'assistant', welcome_msg)
            
            # Update session with welcome message
            session = ChatService.get_chat_session(session_id)
        
        return jsonify({
            "success": True,
            "data": session
        })
    except Exception as e:
        current_app.logger.error(f"创建聊天会话失败: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@chat_api.route('/sessions/<session_id>', methods=['GET'])
@login_required
def get_chat_session(session_id):
    """Get a specific chat session"""
    try:
        session = ChatService.get_chat_session(session_id)
        if not session:
            return jsonify({
                "success": False,
                "error": "聊天会话不存在"
            }), 404
        
        # Verify this session belongs to the current user
        if str(session.get('user_id')) != current_user.get_id():
            return jsonify({
                "success": False,
                "error": "无权访问此聊天会话"
            }), 403
        
        return jsonify({
            "success": True,
            "data": session
        })
    except Exception as e:
        current_app.logger.error(f"获取聊天会话失败: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@chat_api.route('/sessions/<session_id>', methods=['DELETE'])
@login_required
def delete_chat_session(session_id):
    """Delete a chat session"""
    try:
        # Verify this session belongs to the current user
        session = ChatService.get_chat_session(session_id)
        if not session:
            return jsonify({
                "success": False,
                "error": "聊天会话不存在"
            }), 404
        
        if str(session.get('user_id')) != current_user.get_id():
            return jsonify({
                "success": False,
                "error": "无权删除此聊天会话"
            }), 403
        
        # Delete the session
        result = ChatService.delete_chat_session(session_id)
        if not result:
            return jsonify({
                "success": False,
                "error": "删除聊天会话失败"
            }), 500
        
        return jsonify({
            "success": True,
            "data": {"id": session_id}
        })
    except Exception as e:
        current_app.logger.error(f"删除聊天会话失败: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@chat_api.route('/sessions/<session_id>/messages', methods=['GET'])
@login_required
def get_chat_history(session_id):
    """Get chat history for a session"""
    try:
        # Verify this session belongs to the current user
        session = ChatService.get_chat_session(session_id)
        if not session:
            return jsonify({
                "success": False,
                "error": "聊天会话不存在"
            }), 404
        
        if str(session.get('user_id')) != current_user.get_id():
            return jsonify({
                "success": False,
                "error": "无权访问此聊天会话"
            }), 403
        
        # Get chat history
        messages = ChatService.get_chat_history(session_id)
        
        return jsonify({
            "success": True,
            "data": messages
        })
    except Exception as e:
        current_app.logger.error(f"获取聊天历史失败: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@chat_api.route('/sessions/<session_id>/messages', methods=['POST'])
@login_required
def send_message(session_id):
    """Send a message to the chat session"""
    try:
        # Verify this session belongs to the current user
        session = ChatService.get_chat_session(session_id)
        if not session:
            return jsonify({
                "success": False,
                "error": "聊天会话不存在"
            }), 404
        
        if str(session.get('user_id')) != current_user.get_id():
            return jsonify({
                "success": False,
                "error": "无权访问此聊天会话"
            }), 403
        
        # Get the message content
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({
                "success": False,
                "error": "消息内容不能为空"
            }), 400
        
        message = data.get('message')
        
        # Add user message to chat history
        ChatService.add_message(session_id, 'user', message)
        
        # Get the complete message history
        messages = ChatService.get_chat_history(session_id)
        
        # Get session settings
        settings = session.get('settings', {})
        
        # Get the AI response
        response = ChatService.get_model_response(messages, settings)
        
        # Add AI response to chat history
        ChatService.add_message(session_id, 'assistant', response)
        
        return jsonify({
            "success": True,
            "data": {
                "response": response
            }
        })
    except Exception as e:
        current_app.logger.error(f"发送消息失败: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@chat_api.route('/sessions/<session_id>/stream', methods=['POST', 'GET'])
@login_required
def stream_message(session_id):
    """Stream a message response from the chat session using Server-Sent Events (SSE)."""
    try:
        current_app.logger.debug(f"SSE request received for session: {session_id}, method: {request.method}")

        # Verify session ownership
        session = ChatService.get_chat_session(session_id)
        if not session:
            return Response(
                "event: error\ndata: {\"error\": \"聊天会话不存在\"}\n\n",
                status=404, 
                mimetype='text/event-stream'
            )
            
        if str(session.get('user_id')) != current_user.get_id():
            return Response(
                "event: error\ndata: {\"error\": \"无权访问此聊天会话\"}\n\n",
                status=403, 
                mimetype='text/event-stream'
            )

        # 处理不同的请求方法
        if request.method == 'POST':
            # POST 方法 - 从请求体获取新消息
            data = request.get_json()
            if not data or 'message' not in data:
                return Response(
                    "event: error\ndata: {\"error\": \"消息内容不能为空\"}\n\n",
                    status=400, 
                    mimetype='text/event-stream'
                )

            message = data.get('message')
            current_app.logger.debug(f"User message (POST) received: {message[:50]}...")

            # 直接保存用户消息到数据库，确保即使流处理失败也有记录
            try:
                # 同步添加消息，这是关键数据，必须尽快保存
                save_result = ChatService.add_message(session_id, 'user', message)
                if not save_result:
                    current_app.logger.error(f"直接保存用户消息失败，session_id: {session_id}")
                    try:
                        # 尝试异步保存作为备份
                        ChatService.save_response_task.delay(session_id, 'user', message)
                        current_app.logger.debug("已调度异步任务保存用户消息")
                    except Exception as e:
                        current_app.logger.error(f"无法调度异步保存用户消息: {str(e)}", exc_info=True)
            except Exception as e:
                current_app.logger.error(f"保存用户消息时发生错误: {str(e)}", exc_info=True)
                # 尽管保存失败，依然继续处理请求，避免阻塞用户体验
                # 但会记录失败情况以便后续调查
        
        elif request.method == 'GET':
            # GET 方法 - 用于 EventSource 连接，获取现有历史中的最后一条用户消息
            # 不添加新消息，只获取最近添加的用户消息所对应的AI响应
            messages = ChatService.get_chat_history(session_id)
            current_app.logger.debug(f"Stream request (GET) received, history length: {len(messages)}")
            
            # 检查是否有足够的历史记录
            if len(messages) < 1:
                return Response(
                    "event: error\ndata: {\"error\": \"没有足够的聊天历史\"}\n\n",
                    status=400, 
                    mimetype='text/event-stream'
                )
                
            # 不需要额外添加消息，因为已在 POST 请求中添加了
            current_app.logger.debug(f"Using existing chat history for streaming response")

        # 准备 API 调用的消息历史和设置
        messages = ChatService.get_chat_history(session_id)
        settings = session.get('settings', {})
        current_app.logger.debug(f"Prepared {len(messages)} messages for streaming API call.")

        def generate():
            current_app.logger.debug("SSE generator started.")
            full_response = ""
            error_occurred = False
            
            try:
                # 发送初始事件，通知前端流已经开始
                yield "event: start\ndata: {\"status\":\"started\"}\n\n"
                
                # Stream the response from the model
                for event_data in ChatService.stream_model_response(messages, settings):
                    event_type = event_data.get('event', 'message')  # Default to 'message'
                    data = event_data.get('data', '')
                    
                    if event_type == 'error':
                        # Handle error events
                        error_message = data.get('error', 'Unknown error')
                        current_app.logger.error(f"Error in model response: {error_message}")
                        yield f"event: error\ndata: {safe_json_dumps({'error': error_message})}\n\n"
                        error_occurred = True
                        break
                    elif event_type == 'thinking':
                        # Handle thinking state updates
                        yield f"event: thinking\ndata: {safe_json_dumps(data)}\n\n"
                    elif event_type == 'ready':
                        # 流准备就绪事件，告知前端准备好接收数据
                        yield f"event: ready\ndata: {safe_json_dumps(data)}\n\n"
                    elif event_type == 'message':
                        # For message events (content chunks)
                        if isinstance(data, str):
                            # Append to full response
                            full_response += data
                            # Send the chunk as a message event - 不使用json.dumps以加快传输
                            yield f"data: {data}\n\n"
                            # 立即刷新缓冲区，确保数据尽快发送到客户端
                            if hasattr(Response, 'flush'):
                                Response.flush()
                        else:
                            # Handle unexpected data format
                            current_app.logger.warning(f"Unexpected message data format: {type(data)}")
                            yield f"data: {safe_json_dumps(data)}\n\n"
                
                # Send a done event if no error occurred
                if not error_occurred:
                    yield "event: done\ndata: {\"status\":\"complete\"}\n\n"
                    current_app.logger.debug("SSE stream completed, sent done event.")

            except Exception as e:
                current_app.logger.error(f"Error within SSE generator: {str(e)}", exc_info=True)
                yield f"event: error\ndata: {safe_json_dumps({'error': f'内部服务器错误: {str(e)}'})}\n\n"
                error_occurred = True

            # Save the complete assistant response after streaming is finished (if no error)
            if full_response and not error_occurred:
                try:
                    # 首先尝试直接保存（优先级高，确保关键数据不丢失）
                    current_app.logger.debug(f"尝试直接保存AI响应 (length: {len(full_response)})...")
                    
                    # 直接保存到MongoDB，确保数据持久化
                    save_result = ChatService.add_message(session_id, 'assistant', full_response)
                    
                    if save_result:
                        current_app.logger.debug("AI响应直接保存成功")
                    else:
                        # 如果直接保存失败，尝试使用异步任务
                        current_app.logger.warning("直接保存失败，尝试使用异步任务...")
                        ChatService.save_response_task.delay(session_id, 'assistant', full_response)
                        current_app.logger.debug("响应保存任务已调度")
                        
                except Exception as e:
                    current_app.logger.error(f"保存AI响应失败: {str(e)}", exc_info=True)
                    # 在出错时尝试异步保存作为备份方案
                    try:
                        ChatService.save_response_task.delay(session_id, 'assistant', full_response)
                        current_app.logger.debug("已调度异步保存任务作为备份")
                        yield f"event: warning\ndata: {safe_json_dumps({'warning': f'直接保存失败，已尝试异步保存: {str(e)}'})}\n\n"
                    except Exception as backup_error:
                        current_app.logger.error(f"备份异步保存也失败: {str(backup_error)}", exc_info=True)
                        yield f"event: warning\ndata: {safe_json_dumps({'warning': f'响应已发送但保存失败，请刷新页面检查会话记录: {str(e)}'})}\n\n"

        # 配置 SSE 响应对象
        response = Response(stream_with_context(generate()), mimetype='text/event-stream')
        # 设置响应头，确保实时传输
        response.headers['Cache-Control'] = 'no-cache, no-transform'
        response.headers['X-Accel-Buffering'] = 'no'
        response.headers['Connection'] = 'keep-alive'
        # 增加缓冲区大小和超时设置
        response.headers['Content-Encoding'] = 'identity'  # 禁用内容压缩，避免缓冲
        current_app.logger.debug("Returning SSE response object.")
        return response

    except Exception as e:
        current_app.logger.error(f"Error in stream_message endpoint: {str(e)}", exc_info=True)
        # Return a non-streaming error response in SSE format
        return Response(
            f"event: error\ndata: {safe_json_dumps({'error': f'服务器错误: {str(e)}'})}\n\n",
            status=500,
            mimetype='text/event-stream'
        )

@chat_api.route('/sessions/<session_id>/title', methods=['PUT'])
@login_required
def update_session_title(session_id):
    """Update a chat session title"""
    try:
        # Verify this session belongs to the current user
        session = ChatService.get_chat_session(session_id)
        if not session:
            return jsonify({
                "success": False,
                "error": "聊天会话不存在"
            }), 404
        
        if str(session.get('user_id')) != current_user.get_id():
            return jsonify({
                "success": False,
                "error": "无权修改此聊天会话"
            }), 403
        
        # Get the new title
        data = request.get_json()
        if not data or 'title' not in data:
            return jsonify({
                "success": False,
                "error": "标题不能为空"
            }), 400
        
        title = data.get('title')
        
        # Update the title
        result = ChatService.update_session_title(session_id, title)
        if not result:
            return jsonify({
                "success": False,
                "error": "更新聊天会话标题失败"
            }), 500
        
        return jsonify({
            "success": True,
            "data": {"id": session_id, "title": title}
        })
    except Exception as e:
        current_app.logger.error(f"更新聊天会话标题失败: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@chat_api.route('/sessions/<session_id>/settings', methods=['PUT'])
@login_required
def update_session_settings(session_id):
    """Update a chat session settings"""
    try:
        # Verify this session belongs to the current user
        session = ChatService.get_chat_session(session_id)
        if not session:
            return jsonify({
                "success": False,
                "error": "聊天会话不存在"
            }), 404
        
        if str(session.get('user_id')) != current_user.get_id():
            return jsonify({
                "success": False,
                "error": "无权修改此聊天会话"
            }), 403
        
        # Get the new settings
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "设置不能为空"
            }), 400
        
        # Update the settings
        result = ChatService.update_session_settings(session_id, data)
        if not result:
            return jsonify({
                "success": False,
                "error": "更新聊天会话设置失败"
            }), 500
        
        return jsonify({
            "success": True,
            "data": {"id": session_id, "settings": data}
        })
    except Exception as e:
        current_app.logger.error(f"更新聊天会话设置失败: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@chat_api.route('/analyze-news', methods=['POST'])
@login_required
def analyze_news():
    """Analyze hot news for a specific domain"""
    try:
        # Get domain from request
        data = request.get_json()
        if not data or 'domain' not in data:
            return jsonify({
                "success": False,
                "error": "需要提供垂直领域"
            }), 400
        
        domain = data.get('domain')
        
        # Check if we have a recent analysis (within 1 hour)
        recent_analysis = ChatService.get_latest_analysis(domain)
        if recent_analysis:
            # Check if analysis is recent (within 1 hour)
            created_at = recent_analysis.get('created_at')
            if created_at and (datetime.utcnow() - created_at).total_seconds() < 3600:
                return jsonify({
                    "success": True,
                    "data": recent_analysis,
                    "source": "cache"
                })
        
        # Schedule news analysis task
        task = ChatService.analyze_hot_news.delay(domain)
        
        return jsonify({
            "success": True,
            "data": {
                "task_id": task.id,
                "status": "processing",
                "domain": domain,
                "message": "新闻分析任务已启动，请稍后查询结果"
            }
        })
    except Exception as e:
        current_app.logger.error(f"分析新闻失败: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@chat_api.route('/pr-strategy', methods=['POST'])
@login_required
def generate_pr_strategy():
    """Generate PR strategy based on collected information"""
    try:
        # Get strategy data from request
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "策略数据不能为空"
            }), 400
        
        # Validate required fields
        required_fields = ['session_id', 'event_summary']
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            return jsonify({
                "success": False,
                "error": f"缺少必要的字段: {', '.join(missing_fields)}"
            }), 400
        
        session_id = data.get('session_id')
        
        # Verify this session belongs to the current user
        session = ChatService.get_chat_session(session_id)
        if not session:
            return jsonify({
                "success": False,
                "error": "聊天会话不存在"
            }), 404
        
        if str(session.get('user_id')) != current_user.get_id():
            return jsonify({
                "success": False,
                "error": "无权访问此聊天会话"
            }), 403
        
        # Extract strategy data
        strategy_data = {
            'event_summary': data.get('event_summary', ''),
            'fact_check': data.get('fact_check', ''),
            'initial_actions': data.get('initial_actions', ''),
            'short_term_goals': data.get('short_term_goals', ''),
            'mid_term_goals': data.get('mid_term_goals', ''),
            'long_term_goals': data.get('long_term_goals', ''),
            'time_constraints': data.get('time_constraints', ''),
            'budget_constraints': data.get('budget_constraints', ''),
            'additional_info': data.get('additional_info', '')
        }
        
        # Add a system message to chat indicating strategy generation
        ChatService.add_message(session_id, 'assistant', "好的，我正在整合所有信息，准备生成策略...")
        
        # Schedule strategy generation task
        task = ChatService.generate_pr_strategy.delay(session_id, strategy_data)
        
        return jsonify({
            "success": True,
            "data": {
                "task_id": task.id,
                "status": "processing",
                "session_id": session_id,
                "message": "策略生成任务已启动，结果将直接添加到聊天会话中"
            }
        })
    except Exception as e:
        current_app.logger.error(f"生成公关策略失败: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@chat_api.route('/task-status/<task_id>', methods=['GET'])
@login_required
def check_task_status(task_id):
    """Check the status of a background task"""
    try:
        from celery.result import AsyncResult
        
        # Get task result
        task_result = AsyncResult(task_id)
        
        # Check task status
        if task_result.ready():
            if task_result.successful():
                # Get task result
                result = task_result.result
                
                return jsonify({
                    "success": True,
                    "data": {
                        "status": "completed",
                        "result": result
                    }
                })
            else:
                # Task failed
                return jsonify({
                    "success": False,
                    "error": str(task_result.result),
                    "data": {
                        "status": "failed"
                    }
                })
        else:
            # Task still running
            return jsonify({
                "success": True,
                "data": {
                    "status": "processing",
                    "message": "任务正在处理中，请稍后再试"
                }
            })
    except Exception as e:
        current_app.logger.error(f"检查任务状态失败: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@chat_api.route('/export-chat/<session_id>', methods=['GET'])
@login_required
def export_chat(session_id):
    """Export chat history as JSON"""
    try:
        # Verify this session belongs to the current user
        session = ChatService.get_chat_session(session_id)
        if not session:
            return jsonify({
                "success": False,
                "error": "聊天会话不存在"
            }), 404
        
        if str(session.get('user_id')) != current_user.get_id():
            return jsonify({
                "success": False,
                "error": "无权访问此聊天会话"
            }), 403
        
        # Get chat history
        messages = ChatService.get_chat_history(session_id)
        
        # Filter out system messages
        user_messages = [msg for msg in messages if msg.get('role') != 'system']
        
        # Create export data
        export_data = {
            "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            "title": session.get('title', "未命名对话"),
            "messages": user_messages
        }
        
        # Convert to JSON and return as file
        response = Response(
            json.dumps(export_data, ensure_ascii=False, indent=2),
            mimetype='application/json'
        )
        response.headers['Content-Disposition'] = f'attachment; filename=chat_export_{time.strftime("%Y%m%d_%H%M%S")}.json'
        
        return response
    except Exception as e:
        current_app.logger.error(f"导出聊天记录失败: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500 