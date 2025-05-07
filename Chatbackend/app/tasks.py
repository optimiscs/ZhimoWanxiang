"""
Simple tasks module for scheduled tasks using Celery
"""
import datetime
from flask import current_app
import traceback

# 导入 Celery 应用实例
from celery_app import celery

@celery.task(name='tasks.heartbeat')
def heartbeat():
    """Simple heartbeat task that prints the current time"""
    current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[Celery Heartbeat] Application running at {current_time}")
    return True

@celery.task(name='tasks.collect_news')
def collect_news_task():
    """Collect news from external sources via Celery"""
    try:
        print(f"[{datetime.datetime.now()}] [Celery] Starting news collection...")
        # 服务逻辑应该在 Flask 上下文中执行（由 ContextTask 处理）
        from .services.news_collection_service import NewsCollectionService
        stats = NewsCollectionService.collect_news()
        
        print(f"[{datetime.datetime.now()}] [Celery] News collection completed: {stats if stats else ''}")
        return stats
    except Exception as e:
        print(f"[{datetime.datetime.now()}] [Celery] Error in news collection: {str(e)}")
        traceback.print_exc()
        # 可以考虑 Celery 的重试机制
        # raise self.retry(exc=e, countdown=60)
        return {"error": str(e)}

@celery.task(name='tasks.smart_collect')
def smart_collect_news_task():
    """
    智能收集热门新闻，包含内容变化检测 (Celery Task)
    """
    try:
        print(f"[{datetime.datetime.now()}] [Celery] 启动智能热门新闻采集...")
        
        from .services.news_collection_service import NewsCollectionService
        from flask import current_app
        
        # 从metadata集合获取API更新模式
        pattern = None
        try:
            from app.extensions import db
            pattern_doc = db.api_update_patterns.find_one({"type": "hourly_pattern"})
            if pattern_doc:
                pattern = pattern_doc.get("common_minute")
                confidence = pattern_doc.get("confidence", 0)
                print(f"[Celery] 检测到API更新模式: 通常在每小时的第{pattern}分钟更新，置信度: {confidence:.2f}")
        except Exception as e:
            print(f"[Celery] 获取API更新模式失败: {str(e)}")
        
        max_age = current_app.config.get('MAX_DATA_AGE_MINUTES', 55)
        stats = NewsCollectionService.smart_collect_news(force=False, max_age_minutes=max_age)
        
        print(f"[{datetime.datetime.now()}] [Celery] 智能热门新闻采集完成: {stats}")
        
        if stats.get("status") in ["unchanged", "success"]:
            print("[Celery] 检测高热度新闻...")
            threshold = current_app.config.get('HOT_NEWS_THRESHOLD', 0.75)
            high_heat_result = NewsCollectionService.detect_high_heat_news(threshold=threshold)
            print(f"[Celery] 高热度新闻检测结果: {high_heat_result}")
            if high_heat_result.get("status") == "high_heat_detected":
                stats["high_heat_detection"] = high_heat_result
        
        return stats
    except Exception as e:
        print(f"[{datetime.datetime.now()}] [Celery] 智能热门新闻采集错误: {str(e)}")
        traceback.print_exc()
        return {"error": str(e)}

@celery.task(name='tasks.update_hot_news')
def update_current_hot_news_task():
    """
    更新当前热搜新闻缓存表 (Celery Task)
    """
    try:
        print(f"[{datetime.datetime.now()}] [Celery] 开始更新当前热搜新闻缓存...")
        
        from .services.news_service import NewsService
        from flask import current_app
        
        n = current_app.config.get('TOP_HOT_NEWS_COUNT', 20)
        result = NewsService.update_current_hot_news(n=n)
        
        print(f"[{datetime.datetime.now()}] [Celery] 热搜新闻缓存更新完成: {result}")
        return result
    except Exception as e:
        print(f"[{datetime.datetime.now()}] [Celery] 热搜新闻缓存更新错误: {str(e)}")
        traceback.print_exc()
        return {"error": str(e)}

@celery.task(name='tasks.analyze_trending')
def analyze_trending_news_task():
    """
    深度分析热门新闻 (Celery Task)
    """
    try:
        print(f"[{datetime.datetime.now()}] [Celery] 启动热门新闻深度分析...")
        
        from .services.news_collection_service import NewsCollectionService
        from flask import current_app
        
        max_news = current_app.config.get('MAX_ANALYSIS_NEWS_COUNT', 10)
        print(f"[Celery] 将分析最多{max_news}条热门新闻")
        
        result = NewsCollectionService.schedule_deep_analysis(max_news=max_news)
        
        print(f"[{datetime.datetime.now()}] [Celery] 热门新闻分析调度完成: {result}")
        return result
    except Exception as e:
        print(f"[{datetime.datetime.now()}] [Celery] 热门新闻分析错误: {str(e)}")
        traceback.print_exc()
        return {"error": str(e)}

@celery.task(name='tasks.process_news')
def process_news_task():
    """Process and analyze collected news via Celery"""
    try:
        print(f"[{datetime.datetime.now()}] [Celery] Starting news analysis...")
        
        from .services.news_service import NewsService
        from flask import current_app
        
        top_news_count = current_app.config.get('TOP_HOT_NEWS_COUNT')
        if top_news_count is None:
            top_news_count = current_app.config.get('MAX_NEWS_PER_PLATFORM')
        print(f"[Celery] 分析热度排名前 {top_news_count} 条新闻")
        
        schedule_result = NewsService.schedule_news_analysis()
        print(f"[Celery] News scheduling result: {schedule_result}")
        
        process_result = NewsService.process_analysis_queue(max_workers=16, limit=5)
        print(f"[Celery] Analysis processing result: {process_result}")
        
        cleanup_result = NewsService.cleanup_old_queue_items(max_age_hours=48)
        print(f"[Celery] Cleanup result: removed {cleanup_result} old records")
        
        print(f"[{datetime.datetime.now()}] [Celery] News analysis completed")
        return {"scheduled": schedule_result, "processed": process_result, "cleaned": cleanup_result}
    except Exception as e:
        print(f"[{datetime.datetime.now()}] [Celery] Error in news analysis: {str(e)}")
        traceback.print_exc()
        return {"error": str(e)} 

# 确保移除了旧的 simple_scheduler 相关代码（例如 tasks 列表和调度函数）
# (根据阅读的文件内容，似乎没有这些旧代码，因此无需移除) 