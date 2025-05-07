from dotenv import load_dotenv

load_dotenv()

class Config:
    # API Configuration
    SEARCH_API_KEY = "sk-1046332dd90148be93f87c7c30fe0e41"
    SEARCH_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    SEARCH_MODEL = "qwen-plus"
    
    # File paths
    BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    RESULTS_DIR = os.path.join(BASE_DIR, 'results')
    TRANSFORMED_RESULTS_FILE = os.path.join(RESULTS_DIR, 'transformed_results.json')
    
    # Other configurations
    DEBUG = True 
    
    # 热搜新闻配置
    TOP_HOT_NEWS_COUNT = 20  # 默认获取前20条热搜新闻 
    import os

    # Flask settings
    SECRET_KEY = os.getenv('SECRET_KEY', '616d6f417411a6c6c54e5e561ae52a11c4caccd8f8952e50')
    
    # MongoDB settings
    MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://db:27017/')
    
    # News API settings
    NEWS_API_KEY = os.getenv('NEWS_API_KEY')
    NEWS_API_BASE_URL = os.getenv('NEWS_API_BASE_URL', 'https://api.vvhan.com/api/hotlist/all')
    
    # OpenAI settings
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
    
    # Application settings
    MAX_NEWS_ARTICLES = int(os.getenv('MAX_NEWS_ARTICLES', 100))
    TREND_UPDATE_INTERVAL = int(os.getenv('TREND_UPDATE_INTERVAL', 3600))  # 1 hour in seconds
    
    # Qwen API settings
    QWEN_API_KEY = os.getenv('QWEN_API_KEY', 'sk-1046332dd90148be93f87c7c30fe0e41')
    QWEN_BASE_URL = os.getenv('QWEN_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1')
    QWEN_MODEL = os.getenv('QWEN_MODEL', 'qwen-max')
    
    # News analysis settings
    NEWS_UPDATE_INTERVAL = int(os.getenv('NEWS_UPDATE_INTERVAL', 3600))  # 1 hour in seconds
    MAX_WORKERS = int(os.getenv('MAX_WORKERS', 16))
    
    # 热门新闻分析设置
    # 选择热度排名前N的新闻进行分析，不再按每个平台分别选择N条
    TOP_HOT_NEWS_COUNT = int(os.getenv('TOP_HOT_NEWS_COUNT', 50))
    # 兼容旧代码，现已弃用，使用TOP_HOT_NEWS_COUNT替代
    MAX_NEWS_PER_PLATFORM = int(os.getenv('MAX_NEWS_PER_PLATFORM', 2))
    # 每日分析限制
    DAILY_ANALYSIS_LIMIT = int(os.getenv('DAILY_ANALYSIS_LIMIT', 20))
    
    # API采集设置
    # 从各平台API获取热搜时，每平台最多获取的条数
    API_NEWS_PER_PLATFORM = int(os.getenv('API_NEWS_PER_PLATFORM', 20))
    
    # Scheduled tasks settings
    ENABLE_SCHEDULED_TASKS = os.getenv('ENABLE_SCHEDULED_TASKS', 'True').lower() == 'true'
    LLM_MODEL = os.getenv('LLM_MODEL', 'google/gemini-2.5-pro-preview-03-25:online')
    # 智能采集设置
    SMART_COLLECTION_ENABLED = os.getenv('SMART_COLLECTION_ENABLED', 'True').lower() == 'true'
    # 数据变化检测的最大有效时间（分钟）
    MAX_DATA_AGE_MINUTES = int(os.getenv('MAX_DATA_AGE_MINUTES', 55))
    # API热力值阈值，高于此值的新闻触发即时分析
    HOT_NEWS_THRESHOLD = float(os.getenv('HOT_NEWS_THRESHOLD', 0.75))
    # 每次深度分析的最大新闻数量
    MAX_ANALYSIS_NEWS_COUNT = int(os.getenv('MAX_ANALYSIS_NEWS_COUNT', 10))
    # 深度分析的时间间隔（小时）
    DEEP_ANALYSIS_INTERVAL_HOURS = int(os.getenv('DEEP_ANALYSIS_INTERVAL_HOURS', 1))
    # 智能调度开始时间（小时:分钟），例如 "02:00"
    ANALYSIS_SCHEDULE_START = os.getenv('ANALYSIS_SCHEDULE_START', '02:00')
    
    # 平台权重配置
    # Platform weights for news popularity calculation
    PLATFORM_WEIGHTS = {
        'weibo': 1.2,
        'zhihu': 1.1,
        'toutiao': 1.0,
        'baidu': 1.3,
        'bilibili': 0.9,
        'newsqq': 1.0
    }
    DEFAULT_PLATFORM_WEIGHT = 1.0
    OPENROUTER_BASE_URL = os.getenv('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1')
    # Data files
    PROCESSED_RESULTS_FILE = os.getenv('PROCESSED_RESULTS_FILE', 'results/processed_results.json')
    TRANSFORMED_RESULTS_FILE = os.getenv('TRANSFORMED_RESULTS_FILE', 'results/transformed_results.json') 