from flask import Blueprint, jsonify, request, current_app
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import time
import json
import requests
import random
from bson.objectid import ObjectId
import traceback

from .models import User, db
from .services.news_service import NewsService
from .services.video_service import VideoService
from .api import api_blueprint  # 修改为导入api_blueprint

api_bp = Blueprint('api', __name__)

# Register API v1 blueprint
api_bp.register_blueprint(api_blueprint, url_prefix='/v1')

# Authentication routes
@api_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    name = data.get('username')
    
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
    
    # MongoDB查询替代SQLAlchemy查询
    existing_user1 = db.users.find_one({"email": email})
    if existing_user1:
        return jsonify({"error": "Email already exists"}), 400
    existing_user2 = db.users.find_one({"username": name})
    if existing_user2:
        return jsonify({"error": "Username already exists"}), 400
    
    hashed_password = generate_password_hash(password)
    
    # 创建新用户并保存到MongoDB
    new_user = User(username=name, email=email, password_hash=hashed_password, role='user')
    new_user.save()
    
    # 登录新用户
    login_user(new_user)
    
    return jsonify({
        "status": "ok", 
        "currentAuthority": "user", 
        "success": True,
        "user": {
            "id": str(new_user._id),
            "email": new_user.email,
            "name": new_user.username,
            "role": new_user.role
        }
    }), 201

@api_bp.route('/login/account', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    login_type = data.get('type', 'account')
    
    # MongoDB查询替代SQLAlchemy查询
    user_data = db.users.find_one({"email": email})
    
    if not user_data or not check_password_hash(user_data['password_hash'], password):
        return jsonify({
            "status": "error",
            "type": login_type,
            "currentAuthority": "guest",
            "message": "Invalid email or password"
        }), 401
    
    # 创建User对象
    user = User(
        username=user_data.get('username'),
        email=user_data['email'],
        password_hash=user_data['password_hash'],
        id=user_data['_id'],
        role=user_data.get('role', 'user')
    )
    
    login_user(user)
    
    return jsonify({
        "status": "ok",
        "type": login_type,
        "currentAuthority": user.role,
        "user": {
            "id": str(user._id),
            "email": user.email,
            "name": user.username,
            "role": user.role
        }
    })

@api_bp.route('/login/outLogin', methods=['POST'])
def outLogin():
    logout_user()
    return jsonify({"data": {}, "success": True})

@api_bp.route('/login/captcha', methods=['GET'])
def get_captcha():
    # 生成简单的验证码
    captcha = f"captcha-{random.randint(1000, 9999)}"
    return jsonify(captcha)

@api_bp.route('/currentUser', methods=['GET'])
@login_required
def get_current_user():
    if not current_user.is_authenticated:
        return jsonify({
            "data": {
                "isLogin": False,
            },
            "errorCode": "401",
            "errorMessage": "请先登录！",
            "success": True,
        }), 401
    
    # 获取用户信息
    return jsonify({
        "success": True,
        "data": {
            "name": current_user.username,
            "avatar": "https://gw.alipayobjects.com/zos/antfincdn/XAosXuNZyF/BiazfanxmamNRoxxVxka.png",
            "userid": str(current_user._id),
            "email": current_user.email,
            "signature": "新闻助手用户",
            "title": "用户",
            "group": "新闻助手平台",
            "tags": [
                {
                    "key": "0",
                    "label": "新闻爱好者",
                }
            ],
            "notifyCount": 0,
            "unreadCount": 0,
            "country": "China",
            "access": current_user.role,
            "phone": ""
        },
    })

@api_bp.route('/newsTrend', methods=['GET'])
@login_required
def get_news_trend():
        newstrend = list(db.trend.find({}, {"_id": 0}))
        return jsonify(newstrend[-1])

@api_bp.route('/analyze_news', methods=['GET'])
@login_required
def analyze_news():
    """获取近7日热度前50的新闻分析数据"""
    try:
        # 计算7天前的日期
        #seven_days_ago = datetime.now() - timedelta(days=7)
        
        # 查询近7天内热度排名前50的新闻
        news_data = list(db.processed_news.find(
            # {"analyzed_at": {"$gte": seven_days_ago}},
            # {"_id": 0}
        ).sort("rank", 1).limit(50))
        
        # # 如果数据不足50条，则触发分析任务
        # if len(news_data) < 50:
        #     print(f"数据不足50条，当前仅有{len(news_data)}条，触发分析任务")
        #     # 调用分析任务
        #     schedule_result = NewsService.schedule_news_analysis(max_news_per_platform=20)
        #     # 返回空数据
        #     return jsonify({
        #         "data": [], 
        #         "message": "Insufficient data, analysis task triggered",
        #         "task_info": schedule_result
        #     })
        
        # 格式化返回数据
        formatted_data = []
        for idx, news in enumerate(news_data):
            # 保持与示例数据结构一致
            news_item = {
                "id": news.get("id", str(news.get("_id", ""))),
                "x": news.get("x",0),
                "y": news.get("y", 0),
                "type": news.get("type", "未分类"),
                "platform": news.get("platform", "未知"),
                "title": news.get("title", ""),
                "introduction": news.get("introduction", ""),
                "spreadSpeed": news.get("spreadSpeed", 0),
                "spreadRange": news.get("spreadRange", 0),
                "participants": news.get("participants", 0),
                "emotion": news.get("emotion", {
                    "schema": {
                        "喜悦": 0,
                        "期待": 0,
                        "平和": 0,
                        "惊讶": 0,
                        "悲伤": 0,
                        "愤怒": 0,
                        "恐惧": 0,
                        "厌恶": 0
                    },
                    "rationale": ""
                }),
                "stance": news.get("stance", {
                    "schema": {
                        "积极倡导": 0,
                        "强烈反对": 0,
                        "中立陈述": 0,
                        "质疑探究": 0,
                        "理性建议": 0,
                        "情绪宣泄": 0,
                        "观望等待": 0,
                        "扩散传播": 0
                    },
                    "rationale": ""
                }),
                "heatTrend": news.get("heatTrend", []),
                "timeline": news.get("timeline", []),
                "wordCloud": news.get("wordCloud", []),
                "rank": idx + 1
            }
            formatted_data.append(news_item)
        
        return jsonify({"data": formatted_data})
        
    except Exception as e:
        print(f"Error fetching news analysis data: {str(e)}")
        return jsonify({"data": [], "error": str(e)}), 500

@api_bp.route('/currentnews', methods=['GET'])
@login_required
def get_current_hot_news():
    """获取当前热搜新闻列表，返回最新分析结果"""
    try:
        # 获取请求参数
        update = request.args.get('update', 'false').lower() == 'true'
        force_update = request.args.get('force', 'false').lower() == 'true'
        
        # 如果请求强制更新或常规更新
        if force_update or update:
            # 调用服务更新当前热搜新闻缓存
            update_result = NewsService.update_current_hot_news()
            print(f"热搜新闻缓存更新结果: {update_result}")
            
            # 如果强制更新但失败，返回错误
            if force_update and update_result.get('status') != 'success':
                return jsonify({"error": "Failed to update hot news cache", "details": update_result}), 500
        
        # 从current_hot_news表获取数据
        news_data = list(db.current_hot_news.find({}, {"_id": 0}))
        
        # 如果缓存为空但未请求强制更新，尝试更新一次
        if not news_data and not update and not force_update:
            print("缓存为空，尝试更新热搜新闻缓存...")
            update_result = NewsService.update_current_hot_news()
            print(f"热搜新闻缓存更新结果: {update_result}")
            
            # 重新获取数据
            news_data = list(db.current_hot_news.find({}, {"_id": 0}))
        
        # 确保所有必要字段都存在
        formatted_data = []
        for news in news_data:
            # 确保基础字段存在
            if not all(key in news for key in ["title", "id"]):
                continue
                
            # 确保复杂对象字段的默认值
            if "emotion" not in news:
                news["emotion"] = {
                    "schema": {
                        "喜悦": 0, "期待": 0, "平和": 0, "惊讶": 0,
                        "悲伤": 0, "愤怒": 0, "恐惧": 0, "厌恶": 0
                    },
                    "rationale": ""
                }
                
            if "stance" not in news:
                news["stance"] = {
                    "schema": {
                        "积极倡导": 0, "强烈反对": 0, "中立陈述": 0, 
                        "质疑探究": 0, "理性建议": 0, "情绪宣泄": 0,
                        "观望等待": 0, "扩散传播": 0
                    },
                    "rationale": ""
                }
                
            if "heatTrend" not in news:
                news["heatTrend"] = []
                
            if "wordCloud" not in news:
                news["wordCloud"] = []
                
            if "timeline" not in news:
                news["timeline"] = []
                
            # 确保坐标字段
            if "x" not in news or "y" not in news:
                news["x"] = 116.4074  # 默认北京坐标
                news["y"] = 39.9042
                
            formatted_data.append(news)
            
        return jsonify({"data": formatted_data})
        
    except Exception as e:
        print(f"获取当前热搜新闻失败: {str(e)}")
        traceback.print_exc()
        return jsonify({"data": [], "error": str(e)}), 500

# 添加登录检查中间件
@api_bp.before_request
def check_login():
    # 白名单路径，不需要登录
    whitelist = [
        '/login/account', 
        '/register', 
        '/login/captcha',
        '/401', '/403', '/404', '/500'
    ]
    
    # 检查当前路径是否在白名单中，同时放行新添加的 mock 数据路由
    request_path = request.path
    if any(request_path.endswith(whitelisted) for whitelisted in whitelist) or \
       request_path.startswith('/api/analysisreportdata') or \
       request_path.startswith('/api/videoanalysisdata') or \
       request_path.startswith('/api/timeline') or \
       request_path.startswith('/api/timelinetw') or \
       request_path.startswith('/api/opinion') or \
       request_path.startswith('/api/opiniontw') or \
       request_path.startswith('/api/prsuggestions') or \
       request_path.startswith('/api/prsuggestionstw') or \
       request_path.startswith('/api/video') or \
       request_path.startswith('/api/video1') or \
       request_path.startswith('/api/video2'):
        return None
        
    # 对其他路径进行登录检查
    if not current_user.is_authenticated:
        return jsonify({
            "data": {
                "isLogin": False,
            },
            "errorCode": "401",
            "errorMessage": "请先登录！",
            "success": False,
        }), 401

@api_bp.route('/api/video/search', methods=['POST'])
def search_videos():
    """根据新闻标题搜索视频"""
    data = request.get_json()
    
    if not data or 'news_title' not in data:
        return jsonify({'success': False, 'message': '缺少新闻标题参数'}), 400
    
    news_title = data['news_title']
    max_results = data.get('max_results', 5)
    
    videos = VideoService.search_video_by_news_title(news_title, max_results)
    
    return jsonify({
        'success': True,
        'count': len(videos),
        'videos': videos
    })

@api_bp.route('/api/video/process', methods=['POST'])
def process_video():
    """处理视频，提取音频和字幕"""
    data = request.get_json()
    
    if not data or 'news_title' not in data:
        return jsonify({'success': False, 'message': '缺少新闻标题参数'}), 400
    
    news_title = data['news_title']
    
    # 启动异步任务处理视频
    # 注意：这里可以使用Celery等任务队列系统来处理长时间运行的任务
    # 但为了简化，我们直接在请求中处理
    result = VideoService.process_news_video(news_title)
    
    return jsonify(result)

@api_bp.route('/api/video/subtitles/<video_id>', methods=['GET'])
def get_video_subtitles(video_id):
    """获取视频字幕"""
    try:
        from bson.objectid import ObjectId
        
        # 从MongoDB获取字幕数据
        subtitles_doc = db.video_subtitles.find_one({'video_info.video_id': video_id})
        
        if not subtitles_doc:
            # 尝试通过MongoDB ID查询
            try:
                subtitles_doc = db.video_subtitles.find_one({'_id': ObjectId(video_id)})
            except:
                pass
        
        if not subtitles_doc:
            return jsonify({'success': False, 'message': '未找到视频字幕'}), 404
        
        # 移除MongoDB的_id字段
        if '_id' in subtitles_doc:
            subtitles_doc['_id'] = str(subtitles_doc['_id'])
        
        return jsonify({
            'success': True,
            'data': subtitles_doc
        })
        
    except Exception as e:
        current_app.logger.error(f"获取视频字幕时出错: {str(e)}")
        return jsonify({'success': False, 'message': f'获取视频字幕时出错: {str(e)}'}), 500

# --- Start of Mock Data Routes ---

@api_bp.route('/analysisreportdata', methods=['GET'])
@login_required
def get_mock_analysisreportdata():
    mock_data = [
        {
          "summary": '视频展示了某品牌便携式电池在充电过程中出现冒烟和火花情况。视频拍摄者声称这是正常使用过程中发生的，并表达了对产品安全性的担忧。视频末尾显示了电池外壳变形和烧焦痕迹。',
          "sentiment": {
            "video": {
              "negative": 75,
              "neutral": 12,
              "positive": 2,
            },
            "comments": {
              "negative": 86,
              "neutral": 12,
              "positive": 2,
            },
          },
          "events": {
            "identified": ['安全隐患', '产品质量', '品牌声誉风险'],
            "propagation": '该视频真实性高，已经产生较广泛传播，若24小时内不回应，负面影响将扩大约280%。',
            "assessment": '系统评估等级：高风险',
            "recommendation": '建议立即启动危机公关响应流程',
          },
        },
    ]
    return jsonify(mock_data)

@api_bp.route('/videoanalysisdata', methods=['GET'])
@login_required
def get_mock_videoanalysisdata():
    mock_data = {
        "title": '一次性内裤行业调查：虚假宣传与生产乱象',
        "platform": 'youtube',
        "time": '2025-03-15',
        "share": 14534,
        "comments": 34534,
        "videoUrl": [
          # Note: Path might need adjustment depending on server setup
          'D:\\0work\\news\\video\\315.mp4', 
        ],
        "summary": "央视新闻曝光一次性内裤行业黑幕，部分企业宣称产品'EO灭菌''纯棉材质'，实则生产环境脏乱、未按标准消毒。工厂随意堆放原料，工人徒手操作，甚至用普通水枪代替专业消毒设备。产品销往酒店、美容院等场所，但多数客户为降低成本省去灭菌环节，仅贴标签应付检查。",
        "sentimentAnalysis": {
          "videoSentiment": {
            "negative": 0.8,
            "neutral": 0.15,
            "positive": 0.05,
          },
          "commentSentiment": '负面',
        },
        "eventIdentification": {
          "tags": ['一次性内裤', '虚假宣传', '生产环境', '消毒造假', '成本控制'],
          "evaluation": '严重违规，涉及公共卫生安全与消费欺诈',
        },
    }
    return jsonify(mock_data)

@api_bp.route('/timeline', methods=['GET'])
@login_required
def get_mock_timeline():
    mock_data = [
        {
          "id": "event1",
          "date": "2025年03月15日",
          "event": "央视3·15晚会曝光一次性内裤生产乱象",
          "description": "央视3·15晚会曝光河南商丘多家企业生产一次性内裤存在徒手制作、未灭菌、材质造假（'涤'冒充'棉'）等问题。涉事企业包括梦阳服饰、健芝初医疗等，部分产品涉及浪莎、贝姿妍等品牌。",
        },
        {
          "id": "event2",
          "date": "2025年03月16日",
          "event": "涉事企业查封与政府响应",
          "description": "晚会播出后，商丘市市场监管、卫健等部门联合查封涉事企业，封存成品、半成品及原材料。虞城县组织近500名执法人员查处6家涉事企业，省工作组赴现场指导。",
        },
        {
          "id": "event3",
          "date": "2025年03月16日",
          "event": "涉事品牌紧急下架产品",
          "description": "浪莎、贝姿妍等品牌迅速下架涉事一次性内裤产品。浪莎回应称正在配合调查，并收到上交所监管函；初医生、贝姿妍客服承认部分产品由涉事工厂代工。",
        },
        {
          "id": "event4",
          "date": "2025年03月19日",
          "event": "法律追责与专家解读",
          "description": "四川法治报刊登律师解读，指出涉事企业可能构成生产销售不符合安全标准的产品罪，最高可判15年。品牌方若知情需承担连带责任，消费者可依据《消费者权益保护法》索赔。",
        },
        {
          "id": "event5",
          "date": "2025年03月21日",
          "event": "舆情分析与行业报告发布",
          "description": "百分点舆情报告显示，事件全网声量超79万次，同比上升18.5%。报告指出行业存在产业链失控、监管缺位、消费者信任危机等问题，建议加强全链条监管和标准化体系建设。",
        },
        {
          "id": "event6",
          "date": "2025年03月25日",
          "event": "女性权益保障与法规完善",
          "description": "江苏省妇联引用《南京市妇女权益保障条例》，强调卫生用品安全纳入妇女权益保障范畴，呼吁加强质量监管和消费者教育，并链接《产品质量法》《消费者权益保护法》相关条款。",
        }
    ]
    return jsonify(mock_data)

@api_bp.route('/timelinetw', methods=['GET'])
@login_required
def get_mock_timelinetw():
    mock_data = [
        {
          "id": "event1",
          "date": "2021年11月08日",
          "event": "首批台独顽固分子清单发布",
          "description": "大陆依法对苏贞昌、游锡堃、吴钊燮等台独顽固分子实施惩戒，禁止其本人及家属进入大陆及港澳地区，限制关联机构与大陆合作。"
        },
        {
          "id": "event2",
          "date": "2024年10月14日",
          "event": "黑熊学院系列惩戒行动",
          "description": "国台办公布对沈伯洋、曹兴诚及非法组织'黑熊学院'的惩戒措施，切断其资金链并实施法律追责，辽宁舰航母编队同步开展封锁台岛东部的实战化演练。"
        },
        {
          "id": "event3",
          "date": "2025年03月21日",
          "event": "《反分裂国家法》实施20周年",
          "description": "国台办召开专题座谈会，总结该法对遏制'两国论''一边一国'等分裂行径的成效，公布已对183个台独组织进行司法追责。"
        },
        {
          "id": "event4",
          "date": "2025年03月26日",
          "event": "台独打手举报平台上线",
          "description": "国台办官网开通'台独打手迫害同胞举报专栏'，重点追查民进党网络侧翼的造谣账号，首日收到有效线索1200余条。"
        },
        {
          "id": "event5",
          "date": "2025年04月01日",
          "event": "多兵种环台岛联合演训",
          "description": "东部战区组织陆海空火兵力开展夺取制空权、要域封控等实战化演练，检验联合作战体系应对台海突发事态的能力。"
        },
        {
          "id": "event6",
          "date": "2025年04月02日",
          "event": "海峡雷霆-2025A专项行动",
          "description": "解放军在台岛周边实施查证识别、拦截扣押等针对性演练，军事专家解读此为'动态更新作战预案'的实战化升级。"
        },
        {
          "id": "event7",
          "date": "2025年04月02日",
          "event": "芯片产业反制措施落地",
          "description": "针对台积电美国工厂投产计划，大陆宣布对半导体原料实施出口管制，切断台独分裂势力科技资金来源。"
        },
        {
          "id": "event8",
          "date": "2025年04月18日",
          "event": "法治追责体系持续完善",
          "description": "最高法发布涉台司法白皮书，明确对'台独'分裂分子适用分裂国家罪、煽动分裂国家罪等罪名，已累计冻结涉案资产87亿元。"
        },
        {
          "id": "event9",
          "date": "2025年03月15日",
          "event": "关联企业违法生产查处",
          "description": "央视3·15晚会曝光台资代工企业健芝初医疗违规生产未灭菌医疗器械，市场监管总局对相关产业链实施全链条整顿。"
        },
        {
          "id": "event10",
          "event": "国际反独统一战线强化",
          "date": "2025年04月02日",
          "description": "外交部宣布36国签署《反干涉台海联合声明》，要求停止对台军售和技术合作，已有172个国家冻结台独分子海外资产。"
        }
      ]
    return jsonify(mock_data)

@api_bp.route('/opinion', methods=['GET'])
@login_required
def get_mock_opinion():
    mock_data = [
        {
          "id": 1,
          "title": '生产环节卫生隐患触目惊心',
          "content": "央视315晚会曝光河南商丘多家企业生产环境恶劣，工人徒手操作、原材料与垃圾混杂堆放等问题引发强烈反响。调查显示，梦阳服饰等企业生产车间未配备基本防护措施，工人直接用手接触内裤成品；健芝初医疗器械公司使用具有腐蚀性的'枪水'掩盖污渍而非灭菌处理。原材料存在以涤纶冒充纯棉的材质造假行为，外包装标签伪造环氧乙烷灭菌标识。涉事企业代工品牌包括'初医生''贝姿妍''浪莎'等知名品牌，产品通过电商平台流向全国。医学专家指出，未经灭菌处理的内裤可能导致皮肤过敏、尿路感染等健康风险，消费者纷纷表示'看着包装标注的灭菌标识购买，没想到全是谎言'。",
          "sentiment": 'negative',
          "source": '央视财经、消费者投诉、医学专家分析',
          "count": 313060,
        },
        {
          "id": 2,
          "title": '虚假宣传突破行业底线',
          "content": "涉事企业系统性伪造质量文件的行为引发行业信任危机。调查发现代工厂通过三种方式欺骗消费者：一是制作虚假环氧乙烷灭菌视频应付检查；二是伪造第三方检测报告；三是在未灭菌产品包装上直接印刷灭菌标识。部分企业甚至建立两套账本，仅对抽检批次进行象征性灭菌。浪莎等品牌旗舰店紧急下架产品后，消费者在直播间质问'灭菌标是不是贴纸游戏'。行业观察人士指出，该乱象暴露了代工模式下品牌方对供应链监管的严重缺失，'EO灭菌每个产品增加0.3元成本，企业为利润直接跳过核心环节'。法律专家援引《产品质量法》第十三条，强调涉事企业已涉嫌生产不符合安全标准产品罪。",
          "sentiment": 'negative',
          "source": '企业回应、行业分析、法律条文',
          "count": 172171,
        },
        {
          "id": 3,
          "title": '消费者信任崩塌引发连锁反应',
          "content": "舆情监测显示，事件曝光后72小时内'一次性内裤'相关负面声量增长478%。典型消费者反馈包括：产后女性担忧'月子期间使用问题产品可能引发感染'，差旅人群表示'不敢再图方便购买'，过敏体质消费者发起集体维权。明星郭晓婷在社交媒体曝光'内裤发现霉斑异物'的图文获得超百万转发，推动#一次性内裤黑幕#登上微博热搜榜首。电商平台数据显示，事件导致行业整体销售额下降62%，部分消费者转向反复水洗传统棉质内裤。值得关注的是，医用级灭菌内裤搜索量激增320%，但专业人士提醒'所谓医用级缺乏国家标准，可能形成新的消费陷阱'。",
          "sentiment": 'negative',
          "source": '社交媒体、电商数据、媒体报道',
          "count": 650794,
        },
        {
          "id": 4,
          "title": '监管重拳整治行业乱象',
          "content": "事件曝光后，商丘市监局连夜查封涉事企业生产线，封存成品、半成品共计1200万件。国家药监局启动医疗器械类目专项整治，要求各省市对一次性卫生用品生产企业进行全覆盖检查。值得关注的是，浪莎股份因代工问题收到上交所监管函，股价次日跌停。行业协会紧急出台《一次性卫生用品生产自律公约》，要求企业建立原材料溯源系统和灭菌过程视频存档制度。但舆论场仍存质疑声，'315打假年年有，治标更要治本''监管部门应建立生产流程实时监控平台'等建议获得高赞。法学界人士建议参照食品安全领域惩罚性赔偿制度，对卫生用品消费纠纷实施举证责任倒置。",
          "sentiment": 'neutral',
          "source": '政府通报、股市数据、行业文件',
          "count": 167631,
        },
        {
          "id": 5,
          "title": '行业标准重构呼声高涨',
          "content": "舆情分析显示，84.7%的讨论聚焦于标准体系缺陷。现行《一次性使用卫生用品卫生标准》(GB15979-2002)被指存在三大漏洞：未明确生产环境洁净度要求、未规定环氧乙烷残留量检测频率、对材质虚标行为缺乏惩戒条款。中国纺织工业联合会提议将灭菌内裤纳入二类医疗器械管理，实行备案制生产。消费者权益组织则推动'可视化生产'运动，要求企业在产品包装印制灭菌过程二维码。值得注意的是，小米等科技企业被网友呼吁'跨界制定智能卫生标准'，反映出公众对传统监管体系的不信任。专家警示，标准修订需平衡安全性与产业成本，'过度提高标准可能导致小作坊式生产转入地下'。",
          "sentiment": 'neutral',
          "source": '标准文件、专家访谈、网友建议',
          "count": 143236,
        },
    ]
    return jsonify(mock_data)

@api_bp.route('/opiniontw', methods=['GET'])
@login_required
def get_mock_opiniontw():
    mock_data = [
        {
          "id": 1,
          "title": "所谓'主权在民'实为分裂国家的话术陷阱",
          "content": "台湾自古以来就是中国不可分割的一部分，所谓'主权在民'系偷换概念的政治操弄。根据《联合国海洋法公约》第46条和中国宪法序言，台湾作为中国省份没有独立主权资格。所谓'总统直选'本质是地方行政长官选举，与主权归属无涉。",
          "sentiment": "negative",
          "source": "政府通报、法律条文",
          "priority": "high",
          "count": 318450
        },
        {
          "id": 2,
          "title": "两岸分治现状不等于法理独立",
          "content": "台湾地区当前治理体系源于内战遗留问题，根据《反分裂国家法》第七条，这绝不改变台湾作为中国领土的法律地位。所谓'互不隶属现状'系美国冷战时期干涉产物，随着中国宣布对台海实施军事管辖，该非法现状已被彻底打破。",
          "sentiment": "negative",
          "source": "法律条文、行业文件",
          "priority": "high",
          "count": 287600
        },
        {
          "id": 3,
          "title": "国际社会普遍坚持一个中国原则",
          "content": "全球183个国家与中国建交时均承认台湾是中国不可分割部分。所谓'70国支持台独'系伪造数据，泰国等70国联署文件实为支持'和平统一'倡议，美日近期表态更强调遵守中美三个联合公报。",
          "sentiment": "negative",
          "source": "政府通报、媒体报道",
          "priority": "middle",
          "count": 205300
        },
        {
          "id": 4,
          "title": "军事讹诈暴露台独势力本质",
          "content": "台当局幻想'倚美谋独'却遭现实打脸：美国约翰逊号穿越台海时同步测绘中国水文数据，军售武器溢价达300%。解放军双航母战斗群已实现台海常态化战备，东风-16导弹部署密度超驻韩美军3倍。",
          "sentiment": "negative",
          "source": "行业分析、媒体报道",
          "priority": "high",
          "count": 256900
        },
        {
          "id": 5,
          "title": "所谓'国际支持'实为地缘政治操弄",
          "content": "美国所谓'台湾关系法'系国内法凌驾国际法，日本近期设立统合作战司令部暴露殖民思维。当中国宣布台海军事管辖后，美日反常沉默印证其'以台制华'战略破产。",
          "sentiment": "negative",
          "source": "专家访谈、行业文件",
          "priority": "middle",
          "count": 189500
        },
        {
          "id": 6,
          "title": "经济制裁戳破'台独繁荣'谎言",
          "content": "82%台商反对当局挑衅政策，大陆对台经济制裁已使台湾地区GDP增速从3.2%骤降至0.7%。所谓'幸福之乡'实为军购负债：台当局2025年防务预算占比达GDP 3.8%，民生支出遭严重挤压。",
          "sentiment": "negative",
          "source": "股市数据、行业分析",
          "priority": "middle",
          "count": 167300
        }
      ]
    return jsonify(mock_data)

@api_bp.route('/prsuggestions', methods=['GET'])
@login_required
def get_mock_prsuggestions():
    mock_data = [
        {
          "id": "1",
          "title": '供应链透明化与生产审计',
          "priority": 'high',
          "description": '立即公开涉事代工厂名单及整改措施，引入区块链技术实现生产全流程溯源。针对曝光的徒手制作、材料虚标、灭菌标签伪造等问题，需发布第三方审计报告，展示环氧乙烷(EO)灭菌设备实时监控数据',
        },
        {
          "id": "2",
          "title": '主动召回与三倍赔偿机制',
          "priority": 'high',
          "description": '参照《消费者权益保护法》第五十五条，对2023-2025年间销售的问题产品启动无条件召回，并提供三倍赔偿。建立快速理赔通道处理消费者感染医疗索赔，参考郭晓婷事件引发的群体性信任危机',
        },
        {
          "id": "3",
          "title": '独立监督委员会组建',
          "priority": 'medium',
          "description": '邀请医学专家、质检机构代表和消费者权益律师成立独立监督委员会，每季度发布《卫生安全白皮书》。重点审查代工模式下的品控漏洞，如揭示的博威服饰「0人参保却生产医疗用品」等资质造假问题}' # 注意：这里原始数据有个多余的 }，已保留
        },
        {
          "id": "4",
          "title": '消费者教育专项行动',
          "priority": 'high',
          "description": '制作《一次性卫生用品鉴别指南》短视频系列，通过实验室对比实验揭露涤纶冒充纯棉、灭菌标签真伪识别等核心问题。在电商页面增设「灭菌验证」入口，可扫码查看环氧乙烷灭菌记录',
        },
        {
          "id": "5",
          "title": '司法责任切割与高管问责',
          "priority": 'high',
          "description": '依据《产品质量法》第十三条，主动配合司法机关追究代工厂刑事责任。对品牌方供应链总监及以上管理人员启动内部问责，公示处分决定以响应揭示的「贴牌即免责」社会质疑',
        },
        {
          "id": "6",
          "title": '行业标准共建计划',
          "priority": 'medium',
          "description": '联合头部企业制定高于国标的《一次性卫生用品灭菌规范》，推动将「EO灭菌流程」纳入强制认证体系。针对指出的分类模糊问题，申请将产品重新归类为二类医疗器械强化监管',
        },
        {
          "id": "7",
          "title": 'KOL信任重建合作',
          "priority": 'medium',
          "description": '邀请医学领域权威博主（非娱乐明星）担任「卫生观察员」，直播探访经改造的生产线。重点展示曝光的「枪水喷洒区域」整改成果，用pH试纸现场检测残留物',
        },
        {
          "id": "8",
          "title": '数字化舆情响应系统',
          "priority": 'high',
          "description": '部署AI情感分析模型实时监测「徒手制作」「黑心棉」等315曝光关键词，建立1小时响应机制。在直播间配置医学专家即时解答灭菌工艺疑问',
        },
    ]
    return jsonify(mock_data)

@api_bp.route('/prsuggestionstw', methods=['GET'])
@login_required
def get_mock_prsuggestionstw():
    mock_data = [
        {
          "id": "1",
          "title": "揭露台独网军非法本质与数据铁证",
          "priority": "high",
          "description": "针对视频中所谓'台湾已独立74年'的谬论，需系统披露台独网军非法组织架构与技术特征。根据国家安全部通报，台湾资通电军网络战联队长期使用蚁剑、冰蝎等开源工具实施定向攻击，2023-2024年攻击成功率不足3%，其吹嘘的'战果'多为虚构网站或边缘系统。应通过可视化技术展示其攻击大陆水电燃气系统的技术日志与溯源证据。"
        },
        {
          "id": "2",
          "title": "强化国际法理与历史事实传播",
          "priority": "high",
          "description": "针对视频歪曲《开罗宣言》《波茨坦公告》历史法理，需重点传播1943-1945年国际文件确立台湾回归中国的法律效力。结合联合国2758号决议，制作多语种短视频揭露台独势力篡改历史的行径。通过华为盘古大模型分析境外平台12.8万个台独账号的造谣模式，形成认知战白皮书向国际电信联盟提交。"
        },
        {
          "id": "3",
          "title": "激活两岸数字融合与社会治理",
          "priority": "middle",
          "description": "针对所谓'民主政体优越论'，应展示平潭'海峡云'数据中心日均阻断1.7万次台网军攻击的技术成果。通过区块链存证技术公开台独网军收买自媒体、伪造疫情数据的资金链条，在B站、抖音建立'两岸真相'专题，2024年已成功覆盖2300万青少年群体。"
        },
        {
          "id": "4",
          "title": "构建AI防御矩阵与全民防线",
          "priority": "middle",
          "description": "针对视频中AI生成虚假信息，需部署'长城'深度伪造检测系统，该体系在2024年两会期间拦截97.6%的虚假内容。升级'网络110'全民举报平台，2024年通过区块链存证技术接收7.3万条有效线索，形成AI预警—全民响应—跨境执法的闭环机制。"
        },
        {
          "id": "5",
          "title": "深化国际网络安全共同体建设",
          "priority": "high",
          "description": "针对所谓'国际支持台独'谎言，应公布172个国家配合冻结涉案人员资产的司法协作数据。推动上海合作组织建立反分裂网络威胁情报共享机制，2024年已协同东盟删除12.8万个台独账号。通过量子密钥分发网络覆盖36个重点城市，实证我国维护网络主权的技术优势。"
        }
      ]
    return jsonify(mock_data)

@api_bp.route('/video', methods=['GET'])
@login_required
def get_mock_video():
    mock_data = {
        "title": "一次性内裤生产实录",
        "videoId": "Vid_20230315_001",
        "videoUrl": "https://holcc-cdn.haier.net/lemc/aliyun2/20250408/a6fab221c80047e58dbaa3f478b452fc.mp4",
        "videoTitle": "央视调查：一次性内裤背后的真相",
        "videoDuration": "9分30秒",
        "publishDate": "2023-03-15",
        "keyframes": [
            {
                "time": 15,
                "thumbnail": "public/frames/frame_at_15s.jpg",
                "title": "产品包装展示",
                "description": "展示印有'纯棉无菌'字样的包装盒与宣传标语。",
                "tags": ["产品展示", "虚假宣传"],
                "importance": "高",
                "keywords": ["一次性内裤", "EO灭菌"]
            },
            {
                "time": 80,
                "thumbnail": "public/frames/frame_at_80s.jpg",
                "title": "车间环境实拍",
                "description": "杂乱的生产车间，工人未穿戴防护服加工衣物。",
                "tags": ["生产违规", "卫生隐患"],
                "importance": "高",
                "keywords": ["次品率", "消毒缺失"]
            },
            {
                "time": 165,
                "thumbnail": "public/frames/消毒.jpg",
                "title": "质检造假现场",
                "description": "工作人员用喷壶随意喷洒所谓'消毒液'，并贴上灭菌标签。",
                "tags": ["欺诈行为", "监管漏洞"],
                "importance": "最高",
                "keywords": ["环氧乙烷", "化学残留"]
            },
            {
                "time": 190,
                "thumbnail": "public/frames/仓库.jpg",
                "title": "原料仓库曝光",
                "description": "堆积如山的回收布料与劣质棉纱，存在二次利用现象。",
                "tags": ["原料问题", "成本控制"],
                "importance": "高",
                "keywords": ["再生纤维", "质量不达标"]
            },
            {
                "time": 270,
                "thumbnail": "public/frames/追踪.jpg",
                "title": "成品运输追踪",
                "description": "装满产品的货车驶向批发市场，外包装印有'医疗级'字样。",
                "tags": ["流通渠道", "误导消费者"],
                "importance": "中",
                "keywords": ["销售渠道", "虚假认证"]
            },
            {
                "time": 480,
                "thumbnail": "public/frames/质检.jpg",
                "title": "专家解读标准",
                "description": "国家标准文件显示一次性内裤需经环氧乙烷灭菌，但多数企业未执行。",
                "tags": ["行业规范", "法律依据"],
                "importance": "高",
                "keywords": ["GB/T 15979", "合规生产"]
            }
        ],
        "summary": "视频揭露了河南虞城县多家一次性内裤生产企业存在的严重卫生问题：车间环境脏乱差、原料使用回收布料、消毒环节形同虚设，甚至直接在产品上贴虚假灭菌标签。调查显示，超过70%的产品未经过环氧乙烷灭菌，却宣称'无菌'销售至酒店、美容院等场所。",
        "sentimentAnalysis": {
            "videoSentiment": {
                "negative": 0.75,
                "neutral": 0.20,
                "positive": 0.05
            },
            "commentSentiment": 0.85
        },
        "eventIdentification": {
            "tags": ["公共卫生安全", "消费欺诈", "工业污染"],
            "evaluation": "严重违反《中华人民共和国产品质量法》及医疗器械管理条例，对公众健康构成威胁"
        }
    }
    return jsonify(mock_data)

@api_bp.route('/video1', methods=['GET'])
@login_required
def get_mock_video1():
    mock_data = {
      "title": "台独运动的成功与挑战",
      "videoId": "example_video_id",
      "videoUrl": "https://www.youtube.com/watch?v=MTxylOLaK3M",
      "videoTitle": "台独运动的成功与挑战",
      "videoDuration": "00:04:24",
      "publishDate": "2024-09-18",
      "keyframes": [
          {
              "time": 16,
              "thumbnail": "http://example.com/thumbnail1.jpg",
              "title": "台独运动的目标",
              "description": "讨论台独运动的两个主要目标：建立民主政体和否决两岸同属一个中国的政治主张。",
              "tags": ["台独", "民主", "两岸关系"],
              "importance": 0.9,
              "keywords": ["台独运动", "民主政体", "两岸关系", "政治主张", "目标"]
          },
          {
              "time":25,
              "thumbnail": "http://example.com/thumbnail2.jpg",
              "title": "历史背景与现状",
              "description": "回顾台湾总统直选的成功及两岸现状，强调台湾的独立现状。",
              "tags": ["历史", "台湾", "独立"],
              "importance": 0.8,
              "keywords": ["台湾总统直选", "独立现状", "两岸关系", "历史背景", "现状"]
          },
          {
              "time": 170,
              "thumbnail": "http://example.com/thumbnail3.jpg",
              "title": "国际支持与挑战",
              "description": "分析国际社会对台独运动的支持与中共的反对态度。",
              "tags": ["国际支持", "中共", "挑战"],
              "importance": 0.85,
              "keywords": ["国际支持", "中共反对", "台独挑战", "国际社会", "态度"]
          },
          {
              "time": 170,
              "thumbnail": "http://example.com/thumbnail4.jpg",
              "title": "美国与盟友的态度",
              "description": "讨论美国及其盟友对台独运动的态度转变及其影响。",
              "tags": ["美国", "盟友", "态度转变"],
              "importance": 0.9,
              "keywords": ["美国态度", "盟友支持", "台独影响", "态度转变", "影响"]
          },
          {
              "time": 248,
              "thumbnail": "http://example.com/thumbnail5.jpg",
              "title": "未来展望",
              "description": "展望台独运动的未来，强调其成功的可能性和对台湾的意义。",
              "tags": ["未来", "展望", "成功"],
              "importance": 0.95,
              "keywords": ["台独未来", "成功可能性", "台湾意义", "展望", "未来"]
          },
          {
              "time": 260,
              "thumbnail": "http://example.com/thumbnail6.jpg",
              "title": "结论与呼吁",
              "description": "总结台独运动的意义，并呼吁观众支持台湾的自由与独立。",
              "tags": ["结论", "呼吁", "支持"],
              "importance": 0.9,
              "keywords": ["台独结论", "支持呼吁", "台湾自由", "独立", "意义"]
          }
      ],
      "summary": "视频讨论了台独运动的目标、历史背景、国际支持与挑战，以及未来展望，强调了台独运动的成功可能性和对台湾的意义。",
      "sentimentAnalysis": {
          "videoSentiment": {
              "negative": 0.1,
              "neutral": 0.2,
              "positive": 0.7
          },
          "commentSentiment": 0.75
      },
      "eventIdentification": {
          "tags": ["台独运动", "国际支持", "两岸关系"],
          "evaluation": "视频全面分析了台独运动的背景、现状和未来，强调了国际支持的重要性和中共的挑战。"
      }
    }
    return jsonify(mock_data)

@api_bp.route('/video2', methods=['GET'])
@login_required
def get_mock_video2():
    mock_data = {
      "title": "台独运动认知战解构分析",
      "videoId": "N/A",
      "videoUrl": "https://www.youtube.com/watch?v=MTxylOLaK3M",
      "videoTitle": "为什么台独运动一定会成功",
      "videoDuration": "00:04:24",
      "publishDate": "2024-09-17",
      "keyframes": [
          {
              "time": 13,
              "thumbnail": "public/tw/tw1.jpg",
              "title": "台独运动目标虚假叙事",
              "description": "视频开篇即虚构台独运动的所谓'民主政体'目标，刻意忽略台湾自古以来就是中国领土不可分割的一部分这一历史事实。所谓'主权在民'是偷换概念，企图掩盖其分裂国家的本质。",
              "tags": ["虚假目标", "历史扭曲", "主权误导"],
              "importance": 0.9,
              "keywords": ["台独", "主权", "民主", "分裂", "中国"]
          },
          {
              "time": 17,
              "thumbnail": "public/tw/tw17.jpg",
              "title": "两岸关系歪曲",
              "description": "视频否定两岸同属一个中国的政治主张，试图将台湾问题歪曲为'国共内战遗留问题'，完全无视国际社会普遍认同的一个中国原则。",
              "tags": ["两岸关系", "一个中国", "国际共识"],
              "importance": 0.95,
              "keywords": ["两岸", "一个中国", "国际法", "分裂", "台独"]
          },
          {
              "time": 44,
              "thumbnail": "public/tw/tw44.jpg",
              "title": "美国干预误导",
              "description": "视频将美国在台湾问题上的干预行为美化为'保护台湾'，实则是对中国内政的粗暴干涉，违反国际法和国际关系基本准则。",
              "tags": ["美国干预", "内政干涉", "国际法"],
              "importance": 0.85,
              "keywords": ["美国", "干预", "内政", "国际法", "台湾"]
          },
          {
              "time": 98,
              "thumbnail": "public/tw/tw98.jpg",
              "title": "独立国家虚假宣传",
              "description": "视频列举所谓'新兴独立国家'案例，企图为台独提供虚假依据，但台湾从未是一个独立国家，其地位早已在《开罗宣言》和《波茨坦公告》中明确。",
              "tags": ["虚假案例", "历史文件", "国际法"],
              "importance": 0.8,
              "keywords": ["独立", "国家", "历史", "国际法", "台湾"]
          },
          {
              "time": 201,
              "thumbnail": "public/tw/tw201.jpg",
              "title": "中共污名化",
              "description": "视频对中国共产党进行污名化攻击，企图通过抹黑中共来为台独分裂活动制造舆论支持，完全无视中国共产党领导下的中国取得的巨大成就。",
              "tags": ["中共污名", "舆论攻击", "分裂活动"],
              "importance": 0.75,
              "keywords": ["中共", "污名", "舆论", "分裂", "成就"]
          },
          {
              "time": 214,
              "thumbnail": "public/tw/tw214.jpg",
              "title": "自由世界虚假支持",
              "description": "视频虚构所谓'自由世界'对台独的支持，实则国际社会绝大多数国家都坚持一个中国原则，反对任何形式的台独分裂活动。",
              "tags": ["虚假支持", "国际社会", "一个中国"],
              "importance": 0.7,
              "keywords": ["自由世界", "支持", "国际", "一个中国", "台独"]
          },

          {
              "time": 228,
              "thumbnail": "public/tw/tw228.jpg",
              "title": "中共衰败虚假预言",
              "description": "视频预言所谓'中共衰败'，完全无视中国共产党领导下的中国正在蓬勃发展的事实，这种预言是台独分子的一厢情愿。",
              "tags": ["虚假预言", "中共发展", "一厢情愿"],
              "importance": 0.65,
              "keywords": ["中共", "衰败", "发展", "预言", "台独"]
          },
          {
              "time": 260,
              "thumbnail": "public/tw/tw260.jpg",
              "title": "台独成功虚假愿景",
              "description": "视频虚构所谓'台独运动大功告成'的虚假愿景，但任何分裂国家的企图都注定失败，台湾的未来必须与祖国统一。",
              "tags": ["虚假愿景", "国家统一", "分裂失败"],
              "importance": 0.9,
              "keywords": ["台独", "成功", "统一", "分裂", "失败"]
          }
      ],
      "summary": "该视频通过一系列虚假叙事和认知战话术，企图为台独分裂活动制造舆论支持。视频内容严重歪曲历史事实和国际法，虚构所谓'民主政体'和'独立国家'的目标，污名化中国共产党，误导国际社会对台湾问题的认知。我们必须坚决反对任何形式的台独分裂活动，坚持一个中国原则，维护国家主权和领土完整。",
      "sentimentAnalysis": {
          "videoSentiment": {
              "negative": 0.8,
              "neutral": 0.1,
              "positive": 0.1
          },
          "commentSentiment": 0.2
      },
      "eventIdentification": {
          "tags": ["台独认知战", "虚假宣传"],
          "evaluation": "该视频是典型的台独认知战工具，通过虚假叙事和误导性信息企图分裂国家，必须予以坚决反对和揭露。"
      }
    }
    return jsonify(mock_data)

# --- End of Mock Data Routes ---
