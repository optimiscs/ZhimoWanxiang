import json
import time
import uuid
import traceback
import requests
import os
from pymongo import MongoClient
import datetime
from bson.objectid import ObjectId
from flask import current_app
from openai import OpenAI
from ..utils.data_utils import safe_json_data  # 导入安全JSON处理函数

# 获取MongoDB连接 - 优先使用Flask应用上下文中的连接
def get_db():
    try:
        # 尝试从Flask应用上下文获取数据库连接
        from ..extensions import db
        if hasattr(db, 'db') and db.db is not None:
            print("使用Flask应用上下文的数据库连接")
            return db.db
    except Exception as e:
        print(f"无法获取Flask应用上下文的数据库连接: {str(e)}")
    
    # 后备方案：使用环境变量创建新连接
    try:
        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
        db_name = os.getenv("DB_NAME", "zhimo")
        print(f"使用环境变量创建数据库连接: {mongo_uri}, DB: {db_name}")
        client = MongoClient(mongo_uri)
        return client[db_name]
    except Exception as e:
        print(f"创建数据库连接失败: {str(e)}")
        raise

class ReportService:
    """舆情分析报告生成服务"""
    
    @staticmethod
    def initialize_db():
        """初始化数据库索引和集合"""
        try:
            db = get_db()
            
            # 确保有messages集合
            if "messages" not in db.list_collection_names():
                print("创建messages集合")
                db.create_collection("messages")
            
            # 创建会话ID索引
            db.messages.create_index("session_id")
            
            # 创建报告集合和索引
            if "reports" not in db.list_collection_names():
                print("创建reports集合")
                db.create_collection("reports")
            
            # 创建报告ID和会话ID索引
            db.reports.create_index("report_id", unique=True)
            db.reports.create_index("session_id")
            
            print("数据库索引初始化完成")
            return True
        except Exception as e:
            print(f"初始化数据库索引失败: {str(e)}")
            return False
    
    @staticmethod
    def get_report_prompt():
        """获取报告生成的系统提示词"""
        return {
            "role": "system",
            "content": """你是一个专业的舆情分析专家。请基于用户与AI的对话内容，生成一份完整的舆情分析报告。
            
报告必须符合以下JSON格式，字段定义如下：

```json
{
  "meta": {
    "title": "报告标题",
    "subtitle": "副标题（可选）",
    "reportId": "报告唯一ID",
    "generatedAt": "生成时间ISO格式",
    "version": "版本号",
    "confidenceLevel": 0.8, // 可信度0-1
    "analysisContext": "分析上下文描述",
    "keywords": ["关键词1", "关键词2"]
  },
  "executiveSummary": {
    "keyFindings": ["关键发现1", "关键发现2"],
    "overallSentiment": {
      "label": "正面/负面/中性/复杂",
      "score": 0.7, // 0-1
      "distribution": {
        "positive": 70, // 百分比
        "negative": 20,
        "neutral": 10
      }
    },
    "heatLevel": 75, // 舆情热度0-100
    "impactLevel": 80, // 影响力等级0-100
    "topTrends": [
      {"name": "趋势1", "value": 85, "sentiment": "正面"},
      {"name": "趋势2", "value": 65, "sentiment": "负面"}
    ],
    "timespan": {
      "start": "ISO日期",
      "end": "ISO日期"
    }
  },
  "detailedAnalysis": {
    "sentimentAnalysis": {
      "overview": "情感分析概述",
      "details": [
        {"dimension": "情感维度1", "score": 80, "description": "维度描述"},
        {"dimension": "情感维度2", "score": 60, "description": "维度描述"}
      ],
      "timeline": [
        {
          "timestamp": "ISO日期",
          "sentiment": {"positive": 60, "negative": 30, "neutral": 10}
        }
      ],
      "emotionalFactors": [
        {"factor": "因素1", "impact": 8, "description": "因素描述"},
        {"factor": "因素2", "impact": -5, "description": "因素描述"}
      ]
    },
    "topicAnalysis": {
      "overview": "话题分析概述",
      "mainTopics": [
        {
          "topic": "话题1",
          "weight": 85,
          "sentiment": "正面",
          "relatedKeywords": ["关键词1", "关键词2"],
          "sourceCount": 120
        }
      ],
      "topicRelations": {
        "nodes": [
          {"id": "node1", "name": "节点1", "value": 100},
          {"id": "node2", "name": "节点2", "value": 80}
        ],
        "links": [
          {"source": "node1", "target": "node2", "value": 0.8}
        ]
      },
      "keywordCloud": [
        {"word": "关键词1", "weight": 85, "sentiment": "正面"},
        {"word": "关键词2", "weight": 65, "sentiment": "负面"}
      ]
    },
    "propagationAnalysis": {
      "overview": "传播分析概述",
      "channels": [
        {
          "name": "渠道1",
          "volume": 1200,
          "influence": 85,
          "sentiment": {"positive": 70, "negative": 20, "neutral": 10}
        }
      ],
      "timeline": [
        {
          "timestamp": "ISO日期",
          "volume": 500,
          "channels": [{"name": "渠道1", "count": 300}]
        }
      ],
      "peakEvents": [
        {
          "timestamp": "ISO日期",
          "title": "事件标题",
          "description": "事件描述",
          "impact": 85
        }
      ],
      "geographicDistribution": [
        {"region": "地区1", "value": 85, "sentiment": "正面"}
      ]
    },
    "audienceAnalysis": {
      "overview": "受众分析概述",
      "demographics": [
        {
          "type": "年龄",
          "groups": [{"name": "18-24", "percentage": 30}]
        }
      ],
      "keyOpinions": [
        {
          "opinion": "观点1",
          "supportRate": 75,
          "sourceGroups": ["群体1", "群体2"]
        }
      ],
      "engagementMetrics": [
        {
          "metric": "评论",
          "value": 1500,
          "trend": "上升",
          "percentage": 15
        }
      ]
    }
  },
  "insightsAndRecommendations": {
    "keyChallenges": [
      {"challenge": "挑战1", "severity": 8, "description": "挑战描述"}
    ],
    "opportunities": [
      {"opportunity": "机会1", "potential": 9, "description": "机会描述"}
    ],
    "recommendations": [
      {
        "title": "建议1",
        "priority": "高",
        "description": "建议描述",
        "expectedOutcome": "预期效果",
        "timeframe": "短期"
      }
    ],
    "riskAssessment": {
      "riskLevel": "中",
      "potentialRisks": [
        {
          "risk": "风险1",
          "probability": 70,
          "impact": 80,
          "mitigationStrategy": "缓解策略"
        }
      ]
    }
  },
  "analysisDetails": {
    "methodologies": ["方法1", "方法2"],
    "dataSources": [
      {
        "name": "来源1",
        "type": "类型",
        "reliability": 85,
        "coverage": 90
      }
    ],
    "limitations": ["限制1", "限制2"],
    "confidenceIntervals": [
      {
        "metric": "指标1",
        "min": 70,
        "max": 90,
        "confidence": 95
      }
    ],
    "analyticalModels": ["模型1", "模型2"]
  },
  "rawDataSummary": {
    "totalSources": 120,
    "totalMessages": 1500,
    "timeRange": {
      "start": "ISO日期",
      "end": "ISO日期"
    },
    "sampleData": [
      {
        "content": "内容示例",
        "source": "来源",
        "timestamp": "ISO日期",
        "sentiment": "正面",
        "topics": ["话题1", "话题2"]
      }
    ]
  }
}
```

必须严格遵循上述JSON格式，确保所有字段都存在并有合理的值。使用对话内容中的信息，尽可能准确地填充这些字段。

如果对话内容中没有明确提到某些信息，请基于上下文进行合理推断，并在分析详情部分说明这些推断的限制。

你的分析必须专业、客观、全面，从多个维度深入分析舆情数据，提供有价值的洞察和建议。

请确保最终生成的是一个完整的、格式正确的JSON对象，不要添加任何额外说明。"""
        }
        
    @staticmethod
    def get_session_messages(session_id):
        """获取指定会话的消息历史"""
        try:
            print(f"开始获取会话消息，会话ID: {session_id}")
            db = get_db()
            
            # 检查连接
            try:
                # 简单检查数据库连接
                db.command('ping')
                print("MongoDB连接成功")
            except Exception as conn_err:
                print(f"MongoDB连接测试失败: {str(conn_err)}")
                return None
            
            # 尝试将session_id转换为ObjectId (如果它是字符串)
            session_id_obj = None
            if isinstance(session_id, str):
                try:
                    session_id_obj = ObjectId(session_id)
                    print(f"已将session_id字符串转换为ObjectId: {session_id_obj}")
                except Exception as e:
                    print(f"无法将session_id转换为ObjectId，将使用原始值: {str(e)}")
            
            # 查询chat_sessions确认会话是否存在
            session = None
            # 尝试使用原始session_id
            print(f"尝试使用原始ID {session_id} 查询会话")
            session = db.chat_sessions.find_one({"_id": session_id})
            
            # 如果没找到且有ObjectId，尝试使用ObjectId
            if not session and session_id_obj:
                print(f"尝试使用ObjectId {session_id_obj} 查询会话")
                session = db.chat_sessions.find_one({"_id": session_id_obj})
            
            if not session:
                print(f"无法找到会话，尝试其他ID格式")
                # 最后尝试直接查找字符串形式
                if session_id_obj:
                    session = db.chat_sessions.find_one({"_id": str(session_id_obj)})
                    
            # 如果会话不存在，返回空
            if not session:
                print(f"找不到会话，ID: {session_id}")
                return None
                
            print(f"找到会话: {session.get('title', '无标题')}")
            
            # 获取会话中的messages字段
            # 首先尝试直接从会话中获取消息 - 这是主要存储方式
            messages = session.get('messages', [])
            if messages:
                print(f"从会话记录中直接获取到 {len(messages)} 条消息")
                # 转换为LLM需要的格式
                conversation_context = []
                for msg in messages:
                    role = msg.get("role")
                    if role not in ["system", "user", "assistant"]:
                        print(f"跳过角色类型 '{role}'")
                        continue
                        
                    conversation_context.append({
                        "role": role,
                        "content": msg.get("content", "")
                    })
                
                print(f"转换后的对话上下文包含 {len(conversation_context)} 条消息")
                
                # 如果没有有效消息，返回空
                if not conversation_context:
                    print("没有有效的对话消息")
                    return None
                    
                return conversation_context
            
            # 如果在会话中没找到消息，尝试在单独的messages集合中查找
            print("会话中没有直接包含消息，尝试查询messages集合")
            query_conditions = [
                {"session_id": session_id}
            ]
            
            if session_id_obj:
                query_conditions.append({"session_id": session_id_obj})
                query_conditions.append({"session_id": str(session_id_obj)})
            
            # 使用 $or 组合查询条件
            messages = list(db.messages.find({"$or": query_conditions}).sort("created_at", 1))
            
            print(f"从messages集合中查询到 {len(messages) if messages else 0} 条消息")
            
            if not messages:
                print("未找到任何消息记录")
                return None
                
            # 转换为LLM需要的格式
            conversation_context = []
            for msg in messages:
                role = msg.get("role")
                if role not in ["system", "user", "assistant"]:
                    print(f"跳过角色类型 '{role}'")
                    continue
                    
                conversation_context.append({
                    "role": role,
                    "content": msg.get("content", "")
                })
            
            print(f"转换后的对话上下文包含 {len(conversation_context)} 条消息")
            
            # 如果没有有效消息，返回空
            if not conversation_context:
                print("没有有效的对话消息")
                return None
                
            return conversation_context
        except Exception as e:
            print(f"获取会话消息失败，详细错误: {str(e)}")
            traceback.print_exc()
            return None
    
    @classmethod        
    def generate_report(cls, session_id):
        """生成舆情分析报告"""
        try:
            current_app.logger.info(f"开始为会话 {session_id} 生成舆情分析报告")
            
            # 获取会话消息
            conversation_context = cls.get_session_messages(session_id)
            
            # 没有会话消息时，尝试获取会话基本信息
            if not conversation_context:
                current_app.logger.warning(f"会话 {session_id} 没有消息记录，尝试生成基本报告")
                
                # 尝试获取会话信息
                db = get_db()
                session_info = None
                try:
                    # 尝试各种可能的 ID 格式
                    session_info = db.chat_sessions.find_one({"_id": session_id})
                    
                    # 使用ObjectId尝试
                    if not session_info and isinstance(session_id, str):
                        try:
                            session_id_obj = ObjectId(session_id)
                            session_info = db.chat_sessions.find_one({"_id": session_id_obj})
                            if not session_info:
                                session_info = db.chat_sessions.find_one({"_id": str(session_id_obj)})
                        except:
                            pass
                except Exception as e:
                    current_app.logger.error(f"获取会话信息失败: {str(e)}")
                
                # 如果会话信息也没有，返回错误
                if not session_info:
                    current_app.logger.error(f"无法找到会话信息，无法生成报告")
                    return {"success": False, "error": "会话记录为空或不存在"}, 400
                
                # 创建最小上下文
                conversation_context = [
                    {
                        "role": "system", 
                        "content": "这是一个舆情分析会话，请基于有限的信息生成一份基础舆情报告。"
                    },
                    {
                        "role": "user",
                        "content": f"请根据会话ID {session_id} 的信息生成一份舆情分析报告。会话标题: {session_info.get('title', '未命名会话')}"
                    }
                ]
                current_app.logger.info("已创建最小上下文用于生成基础报告")
            
            # 获取报告提示词
            report_prompt = cls.get_report_prompt()
            
            # 构建完整的请求消息
            messages_to_llm = [report_prompt] + conversation_context
            
            # 将会话消息打印到日志以供调试
            current_app.logger.info(f"发送到LLM的消息数量: {len(messages_to_llm)}")
            for i, msg in enumerate(messages_to_llm):
                role = msg.get("role", "unknown")
                content = msg.get("content", "")
                # 只打印内容的前100个字符
                current_app.logger.debug(f"消息 {i+1}, 角色: {role}, 内容: {content[:100]}...")
            
            # 配置API参数
            api_key = current_app.config.get('OPENROUTER_API_KEY') or os.getenv('OPENROUTER_API_KEY') or os.getenv("LLM_API_KEY", "")
            base_url = current_app.config.get('OPENROUTER_BASE_URL') or os.getenv('OPENROUTER_BASE_URL') or os.getenv("LLM_API_URL", "http://localhost:11434/v1")
            model = current_app.config.get('LLM_MODEL') or os.getenv("LLM_MODEL", "google/gemini-2.5-pro-preview-03-25:online")
            
            # 创建配置字典
            settings = {
                'model': model,
                'temperature': 0.2,
                'response_format': {"type": "json_object"}
            }
            
            current_app.logger.info(f"API配置: model={model}, base_url={base_url}")
            
            try:
                # 创建OpenAI客户端
                client = OpenAI(
                    api_key=api_key,
                    base_url=base_url
                )
                
                # 设置请求参数
                request_params = {
                    'model': settings.get('model'),
                    'messages': messages_to_llm,
                    'temperature': settings.get('temperature'),
                    'response_format': settings.get('response_format')
                }
                
                # 调用API
                current_app.logger.info("开始调用LLM API生成报告...")
                response = client.chat.completions.create(**request_params)
                current_app.logger.info("LLM API调用完成")
                
                # 获取完整响应内容
                if not response or not hasattr(response, 'choices') or not response.choices:
                    current_app.logger.error("API返回结果为空或格式不正确")
                    raise ValueError("API返回结果为空或格式不正确")
                
                report_data = response.choices[0].message.content
                current_app.logger.info(f"收到LLM响应，长度: {len(report_data) if report_data else 0}")
                
                # 如果响应为空，则抛出错误
                if not report_data:
                    current_app.logger.error("API响应内容为空")
                    raise ValueError("API响应内容为空")
                
                # 尝试解析JSON
                try:
                    # 先尝试直接解析
                    report_json = json.loads(report_data)
                except json.JSONDecodeError:
                    # 如果直接解析失败，尝试修复
                    current_app.logger.warning("直接JSON解析失败，尝试修复...")
                    report_json = cls.fix_json_content(report_data)
                    if not report_json:
                        current_app.logger.error("JSON修复失败，报告数据无效")
                        raise ValueError("无效的JSON格式数据")
                
                # 验证必要字段
                required_top_fields = ["meta", "executiveSummary", "detailedAnalysis", 
                                      "insightsAndRecommendations", "analysisDetails", "rawDataSummary"]
                
                missing_fields = []
                for field in required_top_fields:
                    if field not in report_json:
                        missing_fields.append(field)
                
                if missing_fields:
                    current_app.logger.warning(f"报告缺少必要字段: {', '.join(missing_fields)}")
                    # 尝试添加缺失字段
                    for field in missing_fields:
                        report_json[field] = cls.generate_fallback_field(field)
                    
                    current_app.logger.info("已补充缺失字段")
                
                # 保存报告到数据库
                db = get_db()
                report_id = str(uuid.uuid4())
                db.reports.insert_one({
                    "report_id": report_id,
                    "session_id": session_id,
                    "created_at": time.time(),
                    "data": report_json,
                    "has_fixed_fields": len(missing_fields) > 0
                })
                
                # 返回成功和数据
                return {
                    "success": True,
                    "report_id": report_id,
                    "data": report_json
                }, 200
                
            except Exception as api_error:
                current_app.logger.error(f"API调用失败: {str(api_error)}")
                current_app.logger.error(traceback.format_exc())
                
                # 如果API不可用，生成一个基本报告模板
                current_app.logger.info("LLM服务不可用，生成基本报告模板")
                report_json = cls.generate_fallback_report(session_id)
                
                # 保存基本报告
                db = get_db()
                report_id = str(uuid.uuid4())
                db.reports.insert_one({
                    "report_id": report_id,
                    "session_id": session_id,
                    "created_at": time.time(),
                    "data": report_json,
                    "is_fallback": True,
                    "error": str(api_error)
                })
                
                return {
                    "success": True,
                    "report_id": report_id,
                    "data": report_json,
                    "warning": f"使用了基础模板生成报告，因为LLM服务不可用: {str(api_error)}"
                }, 200
                
        except Exception as e:
            current_app.logger.error(f"生成报告失败: {str(e)}")
            current_app.logger.error(traceback.format_exc())
            
            try:
                # 尝试生成基础报告作为错误恢复机制
                report_json = cls.generate_fallback_report(session_id) 
                
                # 保存报告
                db = get_db()
                report_id = str(uuid.uuid4())
                db.reports.insert_one({
                    "report_id": report_id,
                    "session_id": session_id,
                    "created_at": time.time(),
                    "data": report_json,
                    "is_fallback": True,
                    "error": str(e)
                })
                
                return {
                    "success": True,
                    "report_id": report_id,
                    "data": report_json,
                    "warning": f"发生错误，使用基础报告: {str(e)}"
                }, 200
            except Exception as recovery_err:
                current_app.logger.error(f"错误恢复也失败: {str(recovery_err)}")
                return {
                    "success": False,
                    "error": f"生成报告失败: {str(e)}",
                    "recovery_failed": True
                }, 500
    
    @staticmethod
    def get_report(report_id):
        """获取特定报告"""
        try:
            db = get_db()
            
            # 查询数据库获取报告
            report = db.reports.find_one({"report_id": report_id})
            
            if not report:
                return {
                    "success": False,
                    "error": f"报告不存在: {report_id}"
                }, 404
                
            # 返回报告数据
            return {
                "success": True,
                "data": report.get("data", {}),
                "is_fallback": report.get("is_fallback", False),
                "created_at": report.get("created_at")
            }, 200
            
        except Exception as e:
            print(f"获取报告失败: {str(e)}")
            traceback.print_exc()
            return {
                "success": False,
                "error": f"获取报告失败: {str(e)}"
            }, 500
    
    @staticmethod
    def fix_json_content(content):
        """尝试修复无效的JSON内容"""
        try:
            # 先尝试直接解析
            try:
                return json.loads(content)
            except:
                pass
            
            # 检查是否包含markdown代码块
            if "```json" in content:
                json_block = content.split("```json")[1].split("```")[0].strip()
                try:
                    return json.loads(json_block)
                except:
                    pass
            elif "```" in content:
                json_block = content.split("```")[1].split("```")[0].strip()
                try:
                    return json.loads(json_block)
                except:
                    pass
            
            # 寻找JSON开始和结束的位置
            start_index = content.find('{')
            end_index = content.rfind('}')
            
            if start_index != -1 and end_index != -1 and end_index > start_index:
                json_content = content[start_index:end_index+1]
                try:
                    return json.loads(json_content)
                except:
                    pass
                
                # 尝试替换常见错误，如单引号替换为双引号
                json_content = json_content.replace("'", '"')
                try:
                    return json.loads(json_content)
                except:
                    pass
                
                # 尝试修复可能的转义问题
                json_content = json_content.replace('\\"', '"')
                try:
                    return json.loads(json_content)
                except:
                    pass
            
            return None
        except Exception as e:
            print(f"修复JSON失败: {str(e)}")
            return None
    
    @staticmethod
    def generate_fallback_report(session_id):
        """生成基础报告模板"""
        current_time = datetime.datetime.now().isoformat()
        fallback_report = {
            "meta": {
                "title": "舆情分析基础报告",
                "subtitle": "系统生成的基本分析",
                "reportId": str(uuid.uuid4()),
                "generatedAt": current_time,
                "version": "1.0",
                "confidenceLevel": 0.6,
                "analysisContext": f"基于会话ID {session_id} 生成的基础报告",
                "keywords": ["自动生成", "基础分析", "舆情概要"]
            },
            "executiveSummary": {
                "keyFindings": ["无法获取详细分析，仅提供基础报告"],
                "overallSentiment": {
                    "label": "中性",
                    "score": 0.5,
                    "distribution": {
                        "positive": 33,
                        "negative": 33,
                        "neutral": 34
                    }
                },
                "heatLevel": 50,
                "impactLevel": 50,
                "topTrends": [
                    {"name": "基础趋势1", "value": 50, "sentiment": "中性"},
                    {"name": "基础趋势2", "value": 40, "sentiment": "中性"}
                ],
                "timespan": {
                    "start": (datetime.datetime.now() - datetime.timedelta(days=30)).isoformat(),
                    "end": current_time
                }
            },
            "detailedAnalysis": {
                "sentimentAnalysis": {
                    "overview": "基础情感分析概述",
                    "details": [
                        {"dimension": "整体情感", "score": 50, "description": "基础情感分析"}
                    ],
                    "timeline": [
                        {
                            "timestamp": current_time,
                            "sentiment": {"positive": 33, "negative": 33, "neutral": 34}
                        }
                    ],
                    "emotionalFactors": [
                        {"factor": "基础因素", "impact": 5, "description": "基础情感因素"}
                    ]
                },
                "topicAnalysis": {
                    "overview": "基础话题分析概述",
                    "mainTopics": [
                        {
                            "topic": "基础话题1",
                            "weight": 60,
                            "sentiment": "中性",
                            "relatedKeywords": ["关键词1", "关键词2"],
                            "sourceCount": 50
                        }
                    ],
                    "topicRelations": {
                        "nodes": [
                            {"id": "node1", "name": "话题1", "value": 60},
                            {"id": "node2", "name": "话题2", "value": 40}
                        ],
                        "links": [
                            {"source": "node1", "target": "node2", "value": 0.5}
                        ]
                    },
                    "keywordCloud": [
                        {"word": "关键词1", "weight": 60, "sentiment": "中性"},
                        {"word": "关键词2", "weight": 50, "sentiment": "中性"}
                    ]
                },
                "propagationAnalysis": {
                    "overview": "基础传播分析概述",
                    "channels": [
                        {
                            "name": "互联网",
                            "volume": 500,
                            "influence": 50,
                            "sentiment": {"positive": 33, "negative": 33, "neutral": 34}
                        }
                    ],
                    "timeline": [
                        {
                            "timestamp": current_time,
                            "volume": 500,
                            "channels": [{"name": "互联网", "count": 500}]
                        }
                    ],
                    "peakEvents": [
                        {
                            "timestamp": current_time,
                            "title": "基础事件",
                            "description": "基础事件描述",
                            "impact": 50
                        }
                    ],
                    "geographicDistribution": [
                        {"region": "全国", "value": 50, "sentiment": "中性"}
                    ]
                },
                "audienceAnalysis": {
                    "overview": "基础受众分析概述",
                    "demographics": [
                        {
                            "type": "年龄",
                            "groups": [{"name": "综合", "percentage": 100}]
                        }
                    ],
                    "keyOpinions": [
                        {
                            "opinion": "基础观点",
                            "supportRate": 50,
                            "sourceGroups": ["互联网用户"]
                        }
                    ],
                    "engagementMetrics": [
                        {
                            "metric": "互动量",
                            "value": 500,
                            "trend": "稳定",
                            "percentage": 0
                        }
                    ]
                }
            },
            "insightsAndRecommendations": {
                "keyChallenges": [
                    {"challenge": "数据获取", "severity": 5, "description": "无法获取详细数据"}
                ],
                "opportunities": [
                    {"opportunity": "基础机会", "potential": 5, "description": "提供基础参考"}
                ],
                "recommendations": [
                    {
                        "title": "增加数据源",
                        "priority": "中",
                        "description": "增加更多数据源以提供更准确分析",
                        "expectedOutcome": "更详细的分析报告",
                        "timeframe": "中期"
                    }
                ],
                "riskAssessment": {
                    "riskLevel": "中",
                    "potentialRisks": [
                        {
                            "risk": "数据不足",
                            "probability": 50,
                            "impact": 50,
                            "mitigationStrategy": "增加数据源"
                        }
                    ]
                }
            },
            "analysisDetails": {
                "methodologies": ["基础分析方法"],
                "dataSources": [
                    {
                        "name": "系统数据",
                        "type": "内部数据",
                        "reliability": 50,
                        "coverage": 50
                    }
                ],
                "limitations": ["数据有限", "分析深度有限"],
                "confidenceIntervals": [
                    {
                        "metric": "整体准确度",
                        "min": 40,
                        "max": 60,
                        "confidence": 90
                    }
                ],
                "analyticalModels": ["基础模型"]
            },
            "rawDataSummary": {
                "totalSources": 1,
                "totalMessages": 1,
                "timeRange": {
                    "start": (datetime.datetime.now() - datetime.timedelta(days=30)).isoformat(),
                    "end": current_time
                },
                "sampleData": [
                    {
                        "content": "基础数据示例",
                        "source": "系统",
                        "timestamp": current_time,
                        "sentiment": "中性",
                        "topics": ["基础话题"]
                    }
                ]
            }
        }
        return fallback_report
    
    @staticmethod
    def generate_fallback_field(field_name):
        """为缺失的字段生成基础数据"""
        current_time = datetime.datetime.now().isoformat()
        
        if field_name == "meta":
            return {
                "title": "舆情分析报告",
                "subtitle": "系统补充的分析",
                "reportId": str(uuid.uuid4()),
                "generatedAt": current_time,
                "version": "1.0",
                "confidenceLevel": 0.6,
                "analysisContext": "系统补充的分析上下文",
                "keywords": ["自动生成", "舆情分析"]
            }
        
        elif field_name == "executiveSummary":
            return {
                "keyFindings": ["系统补充的关键发现"],
                "overallSentiment": {
                    "label": "中性",
                    "score": 0.5,
                    "distribution": {
                        "positive": 33,
                        "negative": 33,
                        "neutral": 34
                    }
                },
                "heatLevel": 50,
                "impactLevel": 50,
                "topTrends": [
                    {"name": "系统补充趋势", "value": 50, "sentiment": "中性"}
                ],
                "timespan": {
                    "start": (datetime.datetime.now() - datetime.timedelta(days=30)).isoformat(),
                    "end": current_time
                }
            }
        
        elif field_name == "detailedAnalysis":
            return {
                "sentimentAnalysis": {
                    "overview": "系统补充的情感分析",
                    "details": [
                        {"dimension": "整体情感", "score": 50, "description": "系统补充的情感维度"}
                    ],
                    "timeline": [
                        {
                            "timestamp": current_time,
                            "sentiment": {"positive": 33, "negative": 33, "neutral": 34}
                        }
                    ],
                    "emotionalFactors": [
                        {"factor": "系统补充因素", "impact": 5, "description": "系统补充的情感因素"}
                    ]
                },
                "topicAnalysis": {
                    "overview": "系统补充的话题分析",
                    "mainTopics": [
                        {
                            "topic": "系统补充话题",
                            "weight": 60,
                            "sentiment": "中性",
                            "relatedKeywords": ["系统", "补充"],
                            "sourceCount": 50
                        }
                    ],
                    "topicRelations": {
                        "nodes": [
                            {"id": "node1", "name": "补充话题1", "value": 60},
                            {"id": "node2", "name": "补充话题2", "value": 40}
                        ],
                        "links": [
                            {"source": "node1", "target": "node2", "value": 0.5}
                        ]
                    },
                    "keywordCloud": [
                        {"word": "系统", "weight": 60, "sentiment": "中性"},
                        {"word": "补充", "weight": 50, "sentiment": "中性"}
                    ]
                },
                "propagationAnalysis": {
                    "overview": "系统补充的传播分析",
                    "channels": [
                        {
                            "name": "互联网",
                            "volume": 500,
                            "influence": 50,
                            "sentiment": {"positive": 33, "negative": 33, "neutral": 34}
                        }
                    ],
                    "timeline": [
                        {
                            "timestamp": current_time,
                            "volume": 500,
                            "channels": [{"name": "互联网", "count": 500}]
                        }
                    ],
                    "peakEvents": [
                        {
                            "timestamp": current_time,
                            "title": "系统补充事件",
                            "description": "系统补充的事件描述",
                            "impact": 50
                        }
                    ],
                    "geographicDistribution": [
                        {"region": "全国", "value": 50, "sentiment": "中性"}
                    ]
                },
                "audienceAnalysis": {
                    "overview": "系统补充的受众分析",
                    "demographics": [
                        {
                            "type": "年龄",
                            "groups": [{"name": "综合", "percentage": 100}]
                        }
                    ],
                    "keyOpinions": [
                        {
                            "opinion": "系统补充观点",
                            "supportRate": 50,
                            "sourceGroups": ["互联网用户"]
                        }
                    ],
                    "engagementMetrics": [
                        {
                            "metric": "互动量",
                            "value": 500,
                            "trend": "稳定",
                            "percentage": 0
                        }
                    ]
                }
            }
        
        elif field_name == "insightsAndRecommendations":
            return {
                "keyChallenges": [
                    {"challenge": "系统补充挑战", "severity": 5, "description": "系统补充的挑战描述"}
                ],
                "opportunities": [
                    {"opportunity": "系统补充机会", "potential": 5, "description": "系统补充的机会描述"}
                ],
                "recommendations": [
                    {
                        "title": "系统补充建议",
                        "priority": "中",
                        "description": "系统补充的建议描述",
                        "expectedOutcome": "系统补充的预期结果",
                        "timeframe": "中期"
                    }
                ],
                "riskAssessment": {
                    "riskLevel": "中",
                    "potentialRisks": [
                        {
                            "risk": "系统补充风险",
                            "probability": 50,
                            "impact": 50,
                            "mitigationStrategy": "系统补充的缓解策略"
                        }
                    ]
                }
            }
        
        elif field_name == "analysisDetails":
            return {
                "methodologies": ["系统补充的分析方法"],
                "dataSources": [
                    {
                        "name": "系统补充数据源",
                        "type": "系统数据",
                        "reliability": 50,
                        "coverage": 50
                    }
                ],
                "limitations": ["系统补充的局限性"],
                "confidenceIntervals": [
                    {
                        "metric": "系统补充指标",
                        "min": 40,
                        "max": 60,
                        "confidence": 90
                    }
                ],
                "analyticalModels": ["系统补充的分析模型"]
            }
        
        elif field_name == "rawDataSummary":
            return {
                "totalSources": 1,
                "totalMessages": 1,
                "timeRange": {
                    "start": (datetime.datetime.now() - datetime.timedelta(days=30)).isoformat(),
                    "end": current_time
                },
                "sampleData": [
                    {
                        "content": "系统补充的数据示例",
                        "source": "系统",
                        "timestamp": current_time,
                        "sentiment": "中性",
                        "topics": ["系统补充"]
                    }
                ]
            }
        
        # 默认返回空对象
        return {}
