import json
import os
from datetime import datetime, timedelta
import traceback
from flask import current_app, jsonify
from app.utils.transform_utils import normalize_scores, process_emotion_stance_data
from .news_analysis_service import NewsAnalysisService
from .news_collection_service import NewsCollectionService
from app.extensions import db
import hashlib
import concurrent.futures
import threading
import time
from tqdm import tqdm
import pymongo

class NewsService:
    @staticmethod
    def load_news_data():
        """
        从MongoDB加载新闻数据
        
        Returns:
            dict: 新闻数据
        """
        try:
            # 优先从hot_news_processed集合获取处理后的热门新闻
            latest = NewsCollectionService.get_latest_processed_news()
            if latest:
                return latest.get("data", [])
                
            # 如果没有处理后的数据，则从老集合获取
            news_data = list(db.transformed_news.find({}, {'_id': 0}))
            if not news_data:
                return {"error": "No news data found in database"}
            return news_data
        except Exception as e:
            return {"error": f"Error loading news data: {str(e)}"}
    
    @staticmethod
    def get_news_titles(max_news_per_platform=5):
        """
        从API获取热门新闻标题
        
        Args:
            max_news_per_platform (int): 每个平台最多获取的新闻数量，默认为5
            
        Returns:
            dict: 包含平台名称和对应热门新闻标题的字典
        """
        from ..utils.api_utils import fetch_news_titles
        
        title_url = current_app.config.get('NEWS_API_BASE_URL')
        return fetch_news_titles(title_url, max_news_per_platform)
    
    @staticmethod
    def analyze_news(max_workers=16, max_news_per_platform=5):
        """
        获取并分析新闻
        
        Args:
            max_workers (int): 最大工作线程数
            max_news_per_platform (int): 每个平台最多分析的新闻数量
            
        Returns:
            dict: 分析结果
        """
        # 获取配置
        api_key = current_app.config.get('QWEN_API_KEY')
        base_url = current_app.config.get('QWEN_BASE_URL')
        model = current_app.config.get('QWEN_MODEL')
        title_url = current_app.config.get('NEWS_API_BASE_URL')
        
        # 创建分析服务
        analysis_service = NewsAnalysisService(api_key, base_url, model)
        
        # 获取并分析新闻
        results = analysis_service.parallel_process(
            title_url=title_url,
            max_workers=max_workers,
            max_news_per_platform=max_news_per_platform
        )
        
        # 保存结果到MongoDB
        NewsService.save_results_to_mongodb(results)
        
        return results
    
    @staticmethod
    def save_results_to_mongodb(results, collection_name="news_data"):
        """
        将分析结果保存到MongoDB
        
        Args:
            results (dict): 分析结果
            collection_name (str): 集合名称，默认为'news_data'
            
        Returns:
            bool: 保存是否成功
        """
        try:
            # 记录保存时间
            timestamp = datetime.now()
            
            # 将结果按平台保存到MongoDB
            platforms_count = 0
            items_count = 0
            
            for platform, news_list in results.items():
                platforms_count += 1
                # 为每条新闻添加时间戳和平台信息
                for news_item in news_list:
                    news_item["saved_at"] = timestamp
                    news_item["platform"] = platform
                    items_count += 1
                    
                    # 插入或更新数据库中的记录
                    # 使用标题作为唯一标识符
                    db.news_data.update_one(
                        {"title": news_item["title"]},
                        {"$set": news_item},
                        upsert=True
                    )
            
            # 同时处理转换后的数据
            transformed_data = NewsService._transform_data_for_display(results)
            for item in transformed_data:
                db.transformed_news.update_one(
                    {"id": item["id"]},
                    {"$set": item},
                    upsert=True
                )
            
            print(f"已保存 {platforms_count} 个平台的 {items_count} 条新闻到MongoDB")
            return True
            
        except Exception as e:
            print(f"保存到MongoDB失败: {str(e)}")
            return False
    
    @staticmethod
    def _transform_data_for_display(results):
        """
        转换数据为显示格式
        
        Args:
            results (dict): 原始分析结果
            
        Returns:
            list: 转换后的数据列表
        """
        transformed_data = []
        
        rank = 1
        for platform, news_list in results.items():
            for news_item in news_list:
                if "analysis" in news_item:
                    # 处理分析数据
                    analysis = news_item["analysis"]
                    analysis["platform"] = platform
                    analysis["rank"] = rank
                    
                    # 处理情感和立场数据
                    processed_analysis = process_emotion_stance_data(analysis)
                    transformed_data.append(processed_analysis)
                    
                    rank += 1
        
        # 按照参与度排序
        transformed_data.sort(key=lambda x: x.get("participants", 0), reverse=True)
        
        # 重新分配排名
        for i, item in enumerate(transformed_data, 1):
            item["rank"] = i
            
        return transformed_data

    @staticmethod
    def process_news_data(data):
        """Process news data using the transformation utilities."""
        if isinstance(data, list):
            return [process_emotion_stance_data(item) for item in data]
        return data

    @staticmethod
    def get_top_news_last_7days(limit=50):
        """
        获取近7天内热度最高的新闻
        
        Args:
            limit (int): 限制返回的记录数量，默认50条
            
        Returns:
            list: 热度最高的新闻分析数据列表
        """
        try:
            from datetime import datetime, timedelta
            from ..models import db
            
            # 计算7天前的时间
            seven_days_ago = datetime.now() - timedelta(days=7)
            
            # 主要从transformed_news集合获取已分析数据（已经包含完整分析结果）
            analyzed_items = list(db.transformed_news.find(
                {}, 
                {'_id': 0}
            ).sort("participants", -1).limit(limit))
            
            # 如果已分析数据不足，则检查是否有更多的原始新闻数据
            if len(analyzed_items) < limit:
                # 查询条件：7天内的新闻
                query = {"saved_at": {"$gte": seven_days_ago}}
                
                # 从news_data集合中获取数据
                news_items = list(db.news_data.find(
                    query, 
                    {'_id': 0}
                ).sort("composite_hot" if "composite_hot" in db.news_data.find_one({}) else "weighted_hot_sum", -1).limit(limit))
                
                # 收集所有已有分析的新闻标题
                analyzed_titles = {item.get("title") for item in analyzed_items}
                
                # 查找新闻分析结果
                for item in news_items:
                    title = item.get("title")
                    if title and title not in analyzed_titles:
                        # 检查是否有对应的分析数据在news_daily_analysis集合中
                        analysis = db.news_daily_analysis.find_one(
                            {"title": title}, 
                            {'_id': 0, 'analysis': 1}
                        )
                        
                        if analysis and 'analysis' in analysis:
                            analyzed_items.append(analysis['analysis'])
                            analyzed_titles.add(title)
                            
                            # 如果达到限制，停止添加
                            if len(analyzed_items) >= limit:
                                break
            
            # 确保所有项目都包含必要的字段
            for item in analyzed_items:
                if 'id' not in item or not item['id']:
                    item['id'] = hashlib.md5(item.get('title', '').encode()).hexdigest()
            
            # 按参与度排序（如果有的话）
            analyzed_items.sort(key=lambda x: x.get('participants', 0), reverse=True)
            
            return analyzed_items
            
        except Exception as e:
            print(f"获取近7天热门新闻失败: {str(e)}")
            return []

    @staticmethod
    def get_news_titles_for_analysis(max_news_per_platform=None):
        """
        获取待分析的新闻标题
        
        优先从MongoDB的hot_news_processed集合获取数据，按综合热度排序取前n条
        
        Args:
            max_news_per_platform: 要检索的最大新闻数量，如果为None则使用配置中的TOP_HOT_NEWS_COUNT值
                                  参数名保留以兼容旧代码，实际作用是获取top_n热度新闻

        Returns:
            list: 包含格式化好的新闻标题列表，每个元素为字典，包含title, platform, url
        """
        try:
            # 从环境变量获取热度前n条的配置
            if max_news_per_platform is None:
                from flask import current_app
                # 优先使用TOP_HOT_NEWS_COUNT配置，如果不存在则回退到MAX_NEWS_PER_PLATFORM
                top_n = current_app.config.get('TOP_HOT_NEWS_COUNT')
                if top_n is None:
                    top_n = current_app.config.get('MAX_NEWS_PER_PLATFORM', 10)
                print(f"获取热度排名前 {top_n} 条新闻")
            else:
                top_n = max_news_per_platform
                
            print(f"从数据库获取热度排名前{top_n}条新闻")
            
            # 从MongoDB获取最新处理过的热门新闻数据
            from ..services.news_collection_service import NewsCollectionService
            latest_processed = NewsCollectionService.get_latest_processed_news()
            
            if latest_processed and "data" in latest_processed:
                # 获取综合热力榜
                for platform_data in latest_processed["data"]:
                    if platform_data.get("platform") == "comprehensive":
                        news_data = platform_data.get("data", [])
                        
                        if news_data and len(news_data) > 0:
                            # 按综合热度降序排序（确保排序正确）
                            sorted_news = sorted(news_data, key=lambda x: x.get("comprehensive_heat", 0), reverse=True)
                            
                            # 获取前n条新闻
                            top_news = sorted_news[:top_n]
                            
                            # 格式化为分析所需的格式
                            formatted_news = [{"title": news.get("title", ""), 
                                             "platform": news.get("platforms", ["unknown"])[0] if news.get("platforms") else "unknown", 
                                             "url": news.get("url", "")} 
                                            for news in top_news]
                            
                            print(f"从数据库获取了{len(formatted_news)}条待分析的热门新闻")
                            return formatted_news
            
            # 如果没有处理过的数据，返回空列表
            print("数据库中没有找到热门新闻数据")
            return []
            
        except Exception as e:
            print(f"获取新闻标题失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return []
            
    @staticmethod
    def _get_titles_from_api(max_news_per_platform=5):
        """
        从API获取热门新闻标题
        
        Args:
            max_news_per_platform (int): 每个平台最多获取的新闻数量
            
        Returns:
            list: 新闻标题列表
        """
        try:
            from ..utils.api_utils import fetch_news_titles
            from flask import current_app
            
            title_url = current_app.config.get('NEWS_API_BASE_URL')
            result = fetch_news_titles(title_url, max_news_per_platform)
            
            # 转换为分析所需的格式
            formatted_news = []
            for platform, news_list in result.items():
                for news in news_list:
                    formatted_news.append({
                        "title": news.get("title", ""),
                        "platform": platform,
                        "url": news.get("url", "")
                    })
            
            print(f"从API获取了{len(formatted_news)}条新闻标题")
            return formatted_news
        except Exception as e:
            print(f"从API获取新闻标题失败: {str(e)}")
            return []
    
    @staticmethod
    def check_news_in_database(news_items, max_age=24):
        """
        检查新闻标题在数据库中是否存在最新分析，优化为单次查询以减少数据库负载
        
        Args:
            news_items (list): 新闻标题列表，每项包含title和platform
            max_age (int): 最大有效时间（小时），超过此时间视为需要更新
            
        Returns:
            tuple: (已有分析的新闻, 需要分析的新闻)
        """
        from ..models import db
        
        # 计算时间阈值
        max_age_time = datetime.now() - timedelta(hours=max_age)
        
        # 提取所有标题并准备查询
        all_titles = [item.get("title") for item in news_items if item.get("title")]
        
        # 如果没有有效标题，直接返回
        if not all_titles:
            return [], []
        
        # 单次查询获取所有已存在的分析
        existing_analyses = list(db.transformed_news.find({"title": {"$in": all_titles}}))
        
        # 创建标题到分析的映射
        title_to_analysis = {}
        for analysis in existing_analyses:
            title_to_analysis[analysis.get("title")] = analysis
        
        # 分类处理每个新闻项
        existing_news = []
        news_to_analyze = []
        
        for item in news_items:
            title = item.get("title")
            if not title:
                continue
                
            analysis = title_to_analysis.get(title)
            
            if analysis:
                # 检查分析时间是否最新
                analyzed_at = analysis.get("analyzed_at")
                if isinstance(analyzed_at, str):
                    try:
                        analyzed_at = datetime.fromisoformat(analyzed_at)
                    except ValueError:
                        analyzed_at = datetime.min
                else:
                    analyzed_at = datetime.min
                
                if analyzed_at > max_age_time:
                    # 分析结果足够新
                    existing_news.append(analysis)
                else:
                    # 需要更新分析
                    news_to_analyze.append(item)
            else:
                # 数据库中没有此新闻
                news_to_analyze.append(item)
        
        return existing_news, news_to_analyze
    
    @staticmethod
    def analyze_specific_news(news_items, max_workers=16, timeout=60):
        """
        分析指定的新闻列表，使用多线程加速处理，优化防止重复处理
        
        Args:
            news_items (list): 待分析的新闻列表，每项包含title和platform
            max_workers (int): 最大工作线程数
            timeout (int): API调用超时时间（秒）
            
        Returns:
            list: 分析结果
        """
        if not news_items:
            return []
        
        # 获取当前应用实例，用于线程内创建上下文
        app = current_app._get_current_object()
        
        # 获取配置
        api_key = current_app.config.get('QWEN_API_KEY')
        base_url = current_app.config.get('QWEN_BASE_URL')
        model = current_app.config.get('QWEN_MODEL')
        
        # 创建分析服务
        from .news_analysis_service import NewsAnalysisService
        analysis_service = NewsAnalysisService(api_key, base_url, model)
        
        # 线程安全的结果列表和处理记录
        analyzed_results = []
        result_lock = threading.Lock()
        
        # 使用集合记录已处理或正在处理的新闻标题，防止多线程重复处理
        processing_news = set()
        processing_lock = threading.Lock()
        
        # API调用监控
        api_stats = {
            "total": 0,
            "success": 0,
            "timeout": 0,
            "error": 0,
            "avg_duration": 0,
            "durations": []
        }
        stats_lock = threading.Lock()
        
        # 过滤掉重复的新闻标题
        filtered_news_items = []
        for item in news_items:
            title = item.get("title", "").strip()
            if not title:
                continue
                
            with processing_lock:
                if title not in processing_news:
                    processing_news.add(title)
                    filtered_news_items.append(item)
        
        # 无新闻需要处理
        if not filtered_news_items:
            return []
            
        # 计算有效的线程数，避免启动过多线程
        effective_workers = min(max_workers, len(filtered_news_items))
        print(f"使用{effective_workers}个线程并行分析{len(filtered_news_items)}条新闻")
        
        # 分析单个新闻的函数
        def analyze_one_news(item):
            # 获取新闻标题和ID，用于唯一识别
            title = item["title"]
            news_id = hashlib.md5(title.encode()).hexdigest()
            
            # 为每个线程创建应用上下文
            with app.app_context():
                start_time = time.time()
                
                try:
                    print(f"开始分析新闻: {title}")
                    
                    # 创建基本新闻数据
                    news_data = {
                        "id": news_id,
                        "title": title
                    }
                    
                    # 标记API调用开始
                    with stats_lock:
                        api_stats["total"] += 1
                    
                    # 使用流式分析方法，提供超时保护
                    try:
                        # 设置超时定时器
                        result = analysis_service.analyze_news(news_data)
                        
                        # 更新API统计
                        api_duration = time.time() - start_time
                        with stats_lock:
                            api_stats["success"] += 1
                            api_stats["durations"].append(api_duration)
                            total_durations = sum(api_stats["durations"])
                            count_durations = len(api_stats["durations"])
                            api_stats["avg_duration"] = total_durations / count_durations
                    
                    except TimeoutError:
                        with stats_lock:
                            api_stats["timeout"] += 1
                        print(f"⏱️ 分析新闻'{title}'超时 (>{timeout}秒)")
                        # # 使用后备方案生成数据
                        # from ..utils.data_utils import generate_fallback_data
                        # result = generate_fallback_data(title)
                    
                    # 添加平台信息和分析时间
                    result["platform"] = item.get("platform", "unknown")
                    result["analyzed_at"] = datetime.now().isoformat()
                    result["title"] = title  # 确保结果中包含title
                    
                    # 保存到数据库 (已在app_context内)
                    db.transformed_news.update_one(
                        {"title": title},
                        {"$set": result},
                        upsert=True
                    )
                    
                    # 安全地添加到结果列表
                    with result_lock:
                        analyzed_results.append(result)
                    
                    print(f"新闻'{title}'分析完成")
                    return result
                    
                except Exception as e:
                    with stats_lock:
                        api_stats["error"] += 1
                    print(f"分析新闻'{title}'失败: {str(e)}")
                    
                    try:
                        # 尝试生成后备数据
                        from ..utils.data_utils import generate_fallback_data
                        fallback = generate_fallback_data(title)
                        fallback["platform"] = item.get("platform", "unknown")
                        fallback["analyzed_at"] = datetime.now().isoformat()
                        fallback["title"] = title  # 确保结果中包含title
                        
                        # 保存后备数据到数据库
                        db.transformed_news.update_one(
                            {"title": title},
                            {"$set": fallback},
                            upsert=True
                        )
                        
                        with result_lock:
                            analyzed_results.append(fallback)
                        
                        return fallback
                    except Exception as e2:
                        print(f"生成后备数据也失败: {str(e2)}")
                        return None
        
        # 使用线程池处理分析任务，带进度条
        with concurrent.futures.ThreadPoolExecutor(max_workers=effective_workers) as executor, \
             tqdm(total=len(filtered_news_items), desc="分析新闻", unit="条") as pbar:
            
            # 提交所有任务
            futures = {}
            for item in filtered_news_items:
                futures[executor.submit(analyze_one_news, item)] = item
            
            # 等待所有任务完成
            for future in concurrent.futures.as_completed(futures):
                item = futures[future]
                try:
                    # 这里我们并不使用future.result()的返回值
                    # 因为结果已经在analyze_one_news函数中添加到analyzed_results中
                    future.result(timeout=timeout + 10)  # 给予额外的10秒完成时间
                except concurrent.futures.TimeoutError:
                    print(f"线程处理新闻'{item['title']}'超时")
                except Exception as e:
                    print(f"处理新闻'{item['title']}'时出错: {str(e)}")
                finally:
                    # 更新进度条
                    pbar.update(1)
                    
                    # 定期输出API调用统计
                    if pbar.n % 5 == 0 or pbar.n == len(filtered_news_items):
                        success_rate = 0
                        if api_stats["total"] > 0:
                            success_rate = (api_stats["success"] / api_stats["total"]) * 100
                        avg_time = api_stats["avg_duration"] if api_stats["durations"] else 0
                        print(f"\n📊 API监控 - 完成: {pbar.n}/{len(filtered_news_items)} | 成功率: {success_rate:.1f}% | 平均时间: {avg_time:.2f}秒 | 超时: {api_stats['timeout']} | 错误: {api_stats['error']}")
        
        # 输出最终统计信息
        print(f"多线程分析完成，成功分析{len(analyzed_results)}/{len(filtered_news_items)}条新闻")
        if api_stats["total"] > 0:
            success_rate = api_stats["success"] / api_stats["total"] * 100
            print(f"API调用成功率: {success_rate:.1f}%，平均响应时间: {api_stats['avg_duration']:.2f}秒")
        
        # 返回排序后的结果
        return sorted(analyzed_results, key=lambda x: x.get("participants", 0), reverse=True)
    
    @staticmethod
    def get_and_analyze_news(max_news_per_platform=2, max_workers=16, max_age=24):
        """
        获取并分析新闻数据的完整流程，按照解耦架构设计:
        1. 获取新闻标题（IO操作）
        2. 检查数据库缓存（DB操作）
        3. 分析需要分析的新闻（计算操作）
        4. 合并结果并排序（内存操作）
        
        Args:
            max_news_per_platform (int): 每个平台最多分析的新闻数量
            max_workers (int): 最大工作线程数
            max_age (int): 最大有效时间（小时）
            
        Returns:
            list: 分析结果
        """
        try:
            # 1. 获取新闻标题
            news_items = NewsService.get_news_titles_for_analysis(max_news_per_platform)
            if not news_items:
                print("未能获取到新闻标题，返回空结果")
                return []
            
            print(f"获取到 {len(news_items)} 条新闻标题")
            
            # 2. 检查数据库中是否已有分析 - 转换为集合操作避免SQL N+1问题
            existing_news, news_to_analyze = NewsService.check_news_in_database(news_items, max_age)
            print(f"数据库中已有 {len(existing_news)} 条新闻的最新分析，需要分析 {len(news_to_analyze)} 条新闻")
            
            # 如果没有需要分析的新闻，直接返回已有结果
            if not news_to_analyze:
                print("所有新闻都已有最新分析，无需再次分析")
                return sorted(existing_news, key=lambda x: x.get("participants", 0), reverse=True)
            
            # 3. 分析需要分析的新闻 - 使用优化后的多线程方法
            new_analyzed = []
            if news_to_analyze:
                print(f"开始分析 {len(news_to_analyze)} 条新闻...")
                
                # 创建分析服务
                api_key = current_app.config.get('QWEN_API_KEY')
                base_url = current_app.config.get('QWEN_BASE_URL')
                model = current_app.config.get('QWEN_MODEL')
                
                analysis_service = NewsAnalysisService(api_key, base_url, model)
                
                # 提取titles和platforms列表用于批量分析
                titles = [item.get("title") for item in news_to_analyze]
                platforms = [item.get("platform") for item in news_to_analyze]
                
                # 使用优化的多线程分析方法
                new_analyzed = analysis_service.analyze_multiple_news(
                    titles, platforms, max_workers=max_workers
                )
                
                print(f"成功分析 {len(new_analyzed)} 条新闻")
            
            # 4. 合并结果并排序
            all_results = existing_news + new_analyzed
            
            # 按参与热度排序
            sorted_results = sorted(all_results, key=lambda x: x.get("participants", 0), reverse=True)
            
            return sorted_results
            
        except Exception as e:
            print(f"获取和分析新闻时出错: {str(e)}")
            import traceback
            traceback.print_exc()
            
            # 发生错误时返回已有的结果
            if existing_news:
                return sorted(existing_news, key=lambda x: x.get("participants", 0), reverse=True)
            return []

    @staticmethod
    def check_valid_news_count(min_count=50, days=7):
        """
        检查数据库中最近几天的有效新闻数量，如果少于指定数量，触发新闻分析任务
        
        Args:
            min_count (int): 最小有效新闻数量，默认50条
            days (int): 检查的天数范围，默认7天
            
        Returns:
            dict: 检查结果
        """
        try:
            # 计算时间范围
            cutoff_time = datetime.now() - timedelta(days=days)
            
            # 查询数据库中最近days天的新闻
            # 注意: 查询非fallback数据，即is_fallback字段不存在或为False
            valid_news_count = db.transformed_news.count_documents({
                "$and": [
                    {"analyzed_at": {"$gte": cutoff_time.isoformat()}},
                    {"$or": [
                        {"is_fallback": {"$exists": False}},
                        {"is_fallback": False}
                    ]}
                ]
            })
            
            print(f"数据库中近{days}天的有效新闻数量: {valid_news_count}")
            
            # 如果有效新闻数量少于最小要求
            if valid_news_count < min_count:
                print(f"有效新闻数量不足 ({valid_news_count}/{min_count})，启动分析任务")
                
                # 计算需要分析的新闻数量
                news_to_analyze_count = min_count - valid_news_count
                
                # 估算每个平台需要获取的新闻数量
                # 假设有5个平台，则每个平台需要 news_to_analyze_count / 5 条
                max_news_per_platform = max(1, news_to_analyze_count // 5)
                
                # 调用安排分析任务的方法
                schedule_result = NewsService.schedule_news_analysis(
                    max_news_per_platform=max_news_per_platform
                )
                
                # 立即处理一部分队列
                process_result = NewsService.process_analysis_queue(
                    max_workers=16, 
                    limit=min(10, news_to_analyze_count)
                )
                
                return {
                    "status": "scheduled",
                    "valid_count": valid_news_count,
                    "required_count": min_count,
                    "scheduled_result": schedule_result,
                    "process_result": process_result
                }
            else:
                return {
                    "status": "sufficient",
                    "valid_count": valid_news_count,
                    "required_count": min_count
                }
                
        except Exception as e:
            print(f"检查有效新闻数量失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"status": "error", "message": str(e)}
    
    @staticmethod
    def get_hot_news():
        """
        获取热门新闻，仅从数据库获取已处理好的数据
        
        Returns:
            dict: 包含热门新闻数据的字典
        """
        try:
            # 从数据库获取最近处理的热门新闻
            from ..services.news_collection_service import NewsCollectionService
            latest_news = NewsCollectionService.get_latest_processed_news()
            
            if latest_news:
                # 按热度排序
                for platform_data in latest_news.get("data", []):
                    if platform_data.get("platform") == "comprehensive":
                        news_list = platform_data.get("data", [])
                        # 确保按热度排序
                        sorted_news = sorted(news_list, key=lambda x: x.get("comprehensive_heat", 0), reverse=True)
                        platform_data["data"] = sorted_news
                
                return {
                    "success": True,
                    "source": "database",
                    "count": latest_news.get("total_news", 0),
                    "data": latest_news.get("data", [])
                }
            
            # 没有找到数据
            return {
                "success": False,
                "error": "No hot news data available in database"
            }
            
        except Exception as e:
            print(f"获取热门新闻失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e)
            }

    @staticmethod
    def get_all_news():
        """获取所有新闻"""
        try:
            news_collection = db.news_collection
            news_items = list(news_collection.find({}, {'_id': 0}))
            return jsonify({"success": True, "data": news_items})
        except Exception as e:
            print(f"Error: {str(e)}")
            return jsonify({"success": False, "error": str(e)}), 500

    @staticmethod
    def get_news_by_id(news_id):
        """根据ID获取新闻"""
        try:
            news_collection = db.news_collection
            news_item = news_collection.find_one({"id": news_id}, {'_id': 0})
            if news_item:
                return jsonify({"success": True, "data": news_item})
            else:
                return jsonify({"success": False, "error": "News not found"}), 404
        except Exception as e:
            print(f"Error: {str(e)}")
            return jsonify({"success": False, "error": str(e)}), 500

    @staticmethod
    def search_news(keyword):
        """搜索新闻"""
        try:
            if not keyword:
                return jsonify({"success": False, "error": "Keyword is required"}), 400

            news_collection = db.news_collection
            # 使用正则表达式进行模糊搜索
            news_items = list(news_collection.find(
                {"title": {"$regex": keyword, "$options": "i"}},
                {'_id': 0}
            ))
            return jsonify({"success": True, "data": news_items})
        except Exception as e:
            print(f"Error: {str(e)}")
            return jsonify({"success": False, "error": str(e)}), 500

    @staticmethod
    def schedule_news_analysis(max_news_per_platform=None, max_workers=16):
        """
        安排新闻分析任务，异步执行，不阻塞用户请求
        此方法应该通过后台任务调度器定期调用，而不是直接在API请求中调用
        
        分析仅使用数据库hot_news_processed集合中的热门新闻，不会从API获取新数据
        
        Args:
            max_news_per_platform: 要获取的热度最高新闻数量，如果为None则使用TOP_HOT_NEWS_COUNT配置
                                   参数名保留以兼容旧代码，实际作用是获取top_n热度新闻
            max_workers (int): 最大工作线程数
            
        Returns:
            dict: 任务安排状态
        """
        try:
            # 1. 获取新闻标题 - 从数据库hot_news_processed集合
            news_items = NewsService.get_news_titles_for_analysis(max_news_per_platform)
            if not news_items:
                print("未能从数据库获取到热门新闻标题，无法安排分析任务")
                return {"status": "error", "message": "未能从数据库获取到热门新闻标题"}
            
            print(f"从数据库获取到 {len(news_items)} 条热门新闻标题，准备安排分析")
            
            # 2. 检查数据库中是否已有分析 - 避免重复分析
            existing_titles = set()
            recent_cutoff = datetime.now() - timedelta(hours=24)
            
            # 查询最近24小时内已分析的新闻
            existing_analyses = list(db.transformed_news.find(
                {"analyzed_at": {"$gte": recent_cutoff.isoformat()}},
                {"title": 1, "_id": 0}
            ))
            
            for analysis in existing_analyses:
                if "title" in analysis:
                    existing_titles.add(analysis["title"])
            
            # 过滤出需要分析的新闻
            news_to_analyze = []
            for item in news_items:
                title = item.get("title", "").strip()
                if title and title not in existing_titles:
                    news_to_analyze.append(item)
                    existing_titles.add(title)  # 避免列表中的重复
            
            # 如果全部已分析，直接返回
            if not news_to_analyze:
                print("所有获取的新闻都已有分析，无需再次分析")
                return {"status": "skipped", "message": "所有新闻已有分析"}
            
            # 3. 将待分析新闻保存到分析队列集合中
            timestamp = datetime.now()
            for item in news_to_analyze:
                # 生成唯一ID
                news_id = hashlib.md5(item.get("title", "").encode()).hexdigest()
                
                # 保存到分析队列
                db.news_analysis_queue.update_one(
                    {"news_id": news_id},
                    {"$set": {
                        "news_id": news_id,
                        "news_data": item,
                        "status": "pending",
                        "queued_at": timestamp.isoformat(),
                        "attempts": 0,
                        "last_attempt": None
                    }},
                    upsert=True
                )
            
            print(f"成功将 {len(news_to_analyze)} 条新闻加入分析队列")
            
            # 4. 立即处理队列中的新闻
            print("立即开始处理队列中的新闻...")
            process_result = NewsService.process_queue_immediately(max_workers)
            
            return {
                "status": "processing", 
                "message": f"已将{len(news_to_analyze)}条新闻加入分析队列并立即开始处理",
                "queued": len(news_to_analyze),
                "process_result": process_result
            }
            
        except Exception as e:
            print(f"安排新闻分析任务失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"status": "error", "message": str(e)}
    
    @staticmethod
    def process_queue_immediately(max_workers=16):
        """
        立即处理队列中的新闻，不等待定时任务
        
        Args:
            max_workers (int): 最大工作线程数
            
        Returns:
            dict: 处理结果
        """
        try:
            # 检查队列中待处理的新闻数量
            pending_count = db.news_analysis_queue.count_documents({"status": "pending"})
            
            if pending_count == 0:
                return {"status": "empty", "message": "分析队列为空，无需处理"}
                
            print(f"队列中有 {pending_count} 条待处理新闻，立即开始处理")
            
            # 获取当前应用实例
            from flask import current_app
            app = current_app._get_current_object()
            
            # 异步线程处理队列
            def process_queue_thread():
                # 在线程中创建新的应用上下文
                with app.app_context():
                    try:
                        print("线程已启动，开始处理队列...")
                        # 处理队列中的所有待处理项目
                        while True:
                            # 检查是否还有待处理项目
                            pending_count = db.news_analysis_queue.count_documents({"status": "pending"})
                            processing_count = db.news_analysis_queue.count_documents({"status": "processing"})
                            
                            print(f"队列状态: 待处理={pending_count}, 处理中={processing_count}")
                            
                            # 如果没有待处理项目并且没有处理中的项目，结束循环
                            if pending_count == 0:
                                if processing_count > 0:
                                    print(f"等待 {processing_count} 个处理中的任务完成...")
                                    time.sleep(5)  # 等待一段时间，给处理中的任务完成的机会
                                    continue
                                else:
                                    print("队列中所有任务已处理完成")
                                    break
                                
                            # 如果有处理中的任务，等待它们完成后再处理新的批次
                            if processing_count > 0:
                                print(f"有 {processing_count} 个任务正在处理中，等待它们完成...")
                                time.sleep(5)
                                continue
                                
                            # 计算当前批次的大小
                            batch_size = min(10, pending_count)
                            print(f"开始处理一批{batch_size}条新闻...")
                            
                            try:
                                # 处理新的批次并等待其完成
                                result = NewsService.process_analysis_queue(max_workers=max_workers, limit=batch_size)
                                print(f"批量处理结果: {result}")
                                
                                # 等待处理完成后，再启动下一个批次
                                wait_count = 0
                                max_wait = 30  # 最多等待30次检查
                                
                                while db.news_analysis_queue.count_documents({"status": "processing"}) > 0:
                                    if wait_count >= max_wait:
                                        print("等待处理中任务完成超时，继续处理下一批")
                                        break
                                        
                                    print("等待处理中的任务完成...")
                                    time.sleep(2)
                                    wait_count += 1
                                
                            except Exception as batch_error:
                                print(f"处理批次时出错: {str(batch_error)}")
                                # 给系统一些恢复时间
                                time.sleep(5)
                            
                            # 给服务器一些喘息时间
                            time.sleep(2)
                    except Exception as e:
                        print(f"队列处理线程出错: {str(e)}")
                        import traceback
                        traceback.print_exc()
            
            # 启动后台线程处理队列
            thread = threading.Thread(target=process_queue_thread)
            thread.daemon = True  # 设置为守护线程，不阻止主程序退出
            thread.start()
            
            return {
                "status": "processing",
                "message": f"开始处理队列中的 {pending_count} 条新闻",
                "thread_id": thread.ident
            }
            
        except Exception as e:
            print(f"立即处理队列失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"status": "error", "message": str(e)}

    @staticmethod
    def process_analysis_queue(max_workers=16, limit=50):
        """
        处理分析队列中的新闻，异步执行分析任务
        此方法应该通过后台任务调度器定期调用，或通过管理员API触发
        
        Args:
            max_workers (int): 最大工作线程数
            limit (int): 单次处理的最大新闻数量
            
        Returns:
            dict: 处理结果
        """
        try:
            # 使用原子操作查找待处理项目并更新为处理中状态
            # 这样可以避免多个进程同时读取和处理同一条新闻
            current_time = datetime.now().isoformat()
            
            # 查找并标记要处理的项目的原子操作
            processing_ids = []
            pending_news = []
            
            # 修改查询方式，优先处理高热度新闻（有priority=high标记的）
            # 第一轮：查找高优先级的新闻
            for _ in range(limit):
                result = db.news_analysis_queue.find_one_and_update(
                    {"status": "pending", "priority": "high"},
                    {"$set": {
                        "status": "processing", 
                        "last_attempt": current_time
                    },
                    "$inc": {"attempts": 1}},
                    sort=[("queued_at", 1)],
                    return_document=True
                )
                
                if result:
                    pending_news.append(result)
                    processing_ids.append(result.get("news_id"))
                else:
                    # 没有更多高优先级的待处理项目
                    break
            
            # 计算还需要处理多少普通优先级的新闻
            remaining_limit = limit - len(pending_news)
            
            # 第二轮：如果还有空间处理普通项目，查找普通优先级的新闻
            if remaining_limit > 0:
                for _ in range(remaining_limit):
                    result = db.news_analysis_queue.find_one_and_update(
                        {"status": "pending", "$or": [{"priority": {"$ne": "high"}}, {"priority": {"$exists": False}}]},
                        {"$set": {
                            "status": "processing", 
                            "last_attempt": current_time
                        },
                        "$inc": {"attempts": 1}},
                        sort=[("queued_at", 1)],
                        return_document=True
                    )
                    
                    if result:
                        pending_news.append(result)
                        processing_ids.append(result.get("news_id"))
                    else:
                        # 没有更多待处理项目
                        break
            
            if not pending_news:
                print("分析队列为空，无需处理")
                return {"status": "empty", "message": "分析队列为空"}
            
            # 分类日志输出
            high_priority_count = sum(1 for news in pending_news if news.get("priority") == "high")
            normal_priority_count = len(pending_news) - high_priority_count
            
            print(f"从队列中获取并锁定 {len(pending_news)} 条待分析新闻 (高优先级: {high_priority_count}, 普通优先级: {normal_priority_count})")
            
            # 获取当前应用实例，用于获取配置
            from flask import current_app
            app = current_app._get_current_object()
            
            # 2. 获取API配置
            api_key = app.config.get('QWEN_API_KEY')
            base_url = app.config.get('QWEN_BASE_URL')
            model = app.config.get('QWEN_MODEL')
            
            if not api_key or not base_url or not model:
                print("API配置不完整，无法进行分析")
                # 重置处理中状态
                for news_id in processing_ids:
                    db.news_analysis_queue.update_one(
                        {"news_id": news_id},
                        {"$set": {"status": "pending"}}
                    )
                return {"status": "error", "message": "API配置不完整"}
                
            print(f"API配置: model={model}, base_url={base_url[:15]}...")
            
            # 3. 创建分析服务
            from .news_analysis_service import NewsAnalysisService
            try:
                analysis_service = NewsAnalysisService(api_key, base_url, model)
                print(f"成功创建分析服务，模型: {model}")
                
                # 检查是否使用了模拟客户端
                if hasattr(analysis_service, 'use_mock') and analysis_service.use_mock:
                    print("注意：使用的是模拟客户端，将生成模拟分析数据")
                    
                    # 为每个新闻生成模拟数据
                    success_count = 0
                    for item in pending_news:
                        try:
                            news_data = item.get("news_data", {})
                            news_id = item.get("news_id")
                            title = news_data.get("title", "未知标题")
                            platform = news_data.get("platform", "unknown")

                            
                            # 使用analyze_news方法，它会处理模拟数据生成
                            try:
                                result = analysis_service.analyze_news(news_data)
                                
                                # 记录分析时间和触发方式
                                timestamp = datetime.now().isoformat()
                                result["analyzed_at"] = timestamp
                                result["analysis_trigger"] = item.get("priority", "normal")
                                
                                # 生成唯一ID，基于标题和时间戳
                                unique_id = f"{title}_{timestamp}"
                                result["id"] = hashlib.md5(unique_id.encode()).hexdigest()
                                
                                # 对数据排序后保存
                                if "comprehensive_heat" in result:
                                    result["rank"] = round(result["comprehensive_heat"] * 100)
                                
                                # 保存到transformed_news集合
                                db.transformed_news.update_one(
                                    {"title": title},
                                    {"$set": result},
                                    upsert=True
                                )
                                
                                # 更新分析记录
                                db.news_analysis_records.update_one(
                                    {"news_id": news_id},
                                    {"$set": {
                                        "news_id": news_id,
                                        "title": title,
                                        "analyzed_at": timestamp,
                                        "status": "completed",
                                        "priority": item.get("priority", "normal")
                                    }},
                                    upsert=True
                                )
                                
                                # 从队列中移除
                                db.news_analysis_queue.delete_one({"news_id": news_id})
                                
                                success_count += 1
                                print(f"成功生成并保存模拟分析: {title[:30]}...")
                            except Exception as e:
                                print(f"保存模拟分析失败: {str(e)}")
                                # 将任务标记为失败
                                db.news_analysis_queue.update_one(
                                    {"news_id": news_id},
                                    {"$set": {"status": "failed", "error": str(e)}}
                                )
                        except Exception as e:
                            print(f"处理新闻数据时出错: {str(e)}")
                            continue
                    return {
                        "status": "success_mock",
                        "message": f"成功处理 {success_count}/{len(pending_news)} 条新闻（使用模拟数据）",
                        "processed": success_count,
                        "mock": True
                    }
            except Exception as e:
                print(f"创建分析服务失败: {str(e)}")
                # 将所有处理中的新闻重置为待处理状态
                for news_id in processing_ids:
                    db.news_analysis_queue.update_one(
                        {"news_id": news_id},
                        {"$set": {"status": "pending", "updated_at": datetime.now().isoformat()}}
                    )
                return {"status": "error", "message": f"创建分析服务失败: {str(e)}"}
            
            # 4. 准备批量分析
            news_ids = []
            titles = []
            platforms = []
            priorities = []
            
            for item in pending_news:
                news_data = item.get("news_data", {})
                news_ids.append(item.get("news_id"))
                titles.append(news_data.get("title", ""))
                platforms.append(news_data.get("platform", "unknown"))
                priorities.append(item.get("priority", "normal"))
            
            print(f"开始分析 {len(titles)} 条新闻，其中高优先级: {priorities.count('high')}条")
            
            # 5. 使用优化的多线程分析方法
            try:
                results = analysis_service.analyze_multiple_news(
                    titles, platforms, max_workers=max_workers
                )
                print(f"分析完成，得到 {len(results)} 条结果")
            except Exception as analysis_error:
                print(f"分析过程中出错: {str(analysis_error)}")
                # 将状态重置为待处理
                for news_id in news_ids:
                    db.news_analysis_queue.update_one(
                        {"news_id": news_id, "status": "processing"},
                        {"$set": {"status": "pending"}}
                    )
                return {"status": "error", "message": f"分析过程中出错: {str(analysis_error)}"}
            
            # 6. 更新队列和保存结果
            success_count = 0
            for i, result in enumerate(results):
                title = result.get("title", "")
                if not title:
                    continue
                    
                # 获取对应的索引
                idx = -1
                for j, t in enumerate(titles):
                    if t == title:
                        idx = j
                        break
                
                if idx == -1:
                    continue
                
                news_id = news_ids[idx]
                priority = priorities[idx]
                
                try:
                    # 记录分析时间和触发方式
                    timestamp = datetime.now().isoformat()
                    result["analyzed_at"] = timestamp
                    result["analysis_trigger"] = priority
                    
                    # 生成唯一ID，基于标题和时间戳
                    unique_id = f"{title}_{timestamp}"
                    result["id"] = hashlib.md5(unique_id.encode()).hexdigest()
                    
                    # 对数据排序后保存
                    if "comprehensive_heat" in result:
                        result["rank"] = round(result["comprehensive_heat"] * 100)
                    
                    # 保存到transformed_news集合
                    db.transformed_news.update_one(
                        {"title": title},
                        {"$set": result},
                        upsert=True
                    )
                    
                    # 更新分析记录
                    db.news_analysis_records.update_one(
                        {"news_id": news_id},
                        {"$set": {
                            "news_id": news_id,
                            "title": title,
                            "analyzed_at": timestamp,
                            "status": "completed",
                            "priority": priority
                        }},
                        upsert=True
                    )
                    
                    # 从队列中移除 - 确保只删除状态为processing的项目
                    db.news_analysis_queue.delete_one({
                        "news_id": news_id,
                        "status": "processing"
                    })
                    
                    success_count += 1
                    print(f"成功保存新闻分析: {title[:30]}... (优先级: {priority})")
                except Exception as save_error:
                    # 检查是否是重复键错误
                    if "duplicate key error" in str(save_error):
                        print(f"保存新闻分析结果失败 {title[:30]}: {str(save_error)}")
                        try:
                            # 生成新的ID
                            result["id"] = hashlib.md5((title + str(time.time())).encode()).hexdigest()
                            # 重试
                            db.transformed_news.update_one(
                                {"title": title},
                                {"$set": result},
                                upsert=True
                            )
                            # 从队列中移除 - 确保只删除状态为processing的项目
                            db.news_analysis_queue.delete_one({
                                "news_id": news_id,
                                "status": "processing"
                            })
                            success_count += 1
                            print(f"成功使用新ID保存新闻分析: {title[:30]}...")
                        except Exception as retry_error:
                            print(f"使用新ID保存失败: {str(retry_error)}")
                            # 将项目标记为失败
                            db.news_analysis_queue.update_one(
                                {"news_id": news_id, "status": "processing"},
                                {"$set": {"status": "failed", "error": str(retry_error)}}
                            )
                    else:
                        print(f"保存新闻分析结果失败 {title[:30]}: {str(save_error)}")
                        # 将项目标记为失败
                        db.news_analysis_queue.update_one(
                            {"news_id": news_id, "status": "processing"},
                            {"$set": {"status": "failed", "error": str(save_error)}}
                        )
            
            # 统计高优先级和普通优先级的成功数量
            high_success = 0
            normal_success = 0
            for i in range(success_count):
                if i < len(priorities) and priorities[i] == "high":
                    high_success += 1
                else:
                    normal_success += 1
                    
            print(f"成功分析并保存 {success_count}/{len(pending_news)} 条新闻 (高优先级: {high_success}, 普通优先级: {normal_success})")
            
            # 7. 处理失败的新闻
            failed_count = 0
            for i, news_id in enumerate(news_ids):
                # 检查是否仍在队列中并且状态为processing
                queue_item = db.news_analysis_queue.find_one({
                    "news_id": news_id,
                    "status": "processing"
                })
                
                if queue_item:
                    attempts = queue_item.get("attempts", 0)
                    priority = queue_item.get("priority", "normal")
                    
                    if attempts >= 3:  # 最多尝试3次
                        # 超过最大尝试次数，标记为失败
                        db.news_analysis_queue.update_one(
                            {"news_id": news_id, "status": "processing"},
                            {"$set": {
                                "status": "failed",
                                "updated_at": datetime.now().isoformat(),
                                "error": "超过最大尝试次数"
                            }}
                        )
                        failed_count += 1
                    else:
                        # 重新标记为待处理，但保持优先级
                        db.news_analysis_queue.update_one(
                            {"news_id": news_id, "status": "processing"},
                            {"$set": {
                                "status": "pending",
                                "priority": priority,  # 保持原有优先级
                                "updated_at": datetime.now().isoformat()
                            }}
                        )
            
            return {
                "status": "success",
                "message": f"成功处理分析队列中的 {success_count}/{len(pending_news)} 条新闻",
                "processed": success_count,
                "high_priority_processed": high_success,
                "normal_priority_processed": normal_success,
                "failed": failed_count
            }
            
        except Exception as e:
            print(f"处理分析队列失败: {str(e)}")
            import traceback
            traceback.print_exc()
            
            # 将所有正在处理的项目重置为待处理
            try:
                db.news_analysis_queue.update_many(
                    {"status": "processing"},
                    {"$set": {"status": "pending", "updated_at": datetime.now().isoformat()}}
                )
                print("已将所有处理中的新闻重置为待处理状态")
            except Exception as reset_error:
                print(f"重置处理状态失败: {str(reset_error)}")
                
            return {"status": "error", "message": str(e)}

    @staticmethod
    def cleanup_old_queue_items(max_age_hours=48):
        """
        清理分析队列中的旧项目
        
        Args:
            max_age_hours (int): 最大保留时间（小时）
            
        Returns:
            int: 删除的项目数量
        """
        try:
            cutoff_time = datetime.now() - timedelta(hours=max_age_hours)
            
            # 删除已完成或失败的旧项目
            result = db.news_analysis_queue.delete_many({
                "$or": [
                    {"status": "failed", "queued_at": {"$lt": cutoff_time.isoformat()}},
                    {"status": "completed", "queued_at": {"$lt": cutoff_time.isoformat()}}
                ]
            })
            
            deleted_count = result.deleted_count
            print(f"已清理 {deleted_count} 条旧的分析队列项目")
            return deleted_count
            
        except Exception as e:
            print(f"清理分析队列失败: {str(e)}")
            return 0

    @staticmethod
    def ensure_scheduled_tasks_running(app=None):
        """
        确保后台任务已启动
        
        Args:
            app (Flask): Flask应用实例
            
        Returns:
            bool: 是否成功启动
        """
        try:
            from flask import current_app
            app_instance = app or current_app
            
            if not app_instance.config.get('SCHEDULED_TASKS_STARTED', False):
                from ..scheduled_tasks import start_scheduled_tasks
                with app_instance.app_context():
                    start_scheduled_tasks(app_instance)
                app_instance.config['SCHEDULED_TASKS_STARTED'] = True
                print("已启动后台新闻采集和分析任务")
            return True
        except Exception as e:
            print(f"启动后台任务失败: {str(e)}")
            return False

    @staticmethod
    def analyze_multiple_news(titles, platforms, max_workers=16):
        """
        分析多个新闻标题，处理热门新闻
        
        Args:
            titles (list): 新闻标题列表
            platforms (list): 平台列表，长度应与titles一致
            max_workers (int): 最大工作线程数
            
        Returns:
            list: 分析结果
        """
        # 首先检查是否已经有处理好的热门新闻数据
        latest_processed = NewsCollectionService.get_latest_processed_news()
        if latest_processed:
            # 检查数据是否足够新（1小时内）
            timestamp = latest_processed.get("timestamp")
            if isinstance(timestamp, str):
                try:
                    timestamp_datetime = datetime.fromisoformat(timestamp)
                    time_diff = datetime.now() - timestamp_datetime
                    
                    # 如果数据少于1小时，优先使用处理好的数据
                    if time_diff.total_seconds() < 3600:
                        print("使用1小时内已处理好的热门新闻数据")
                        
                        # 从处理好的数据中查找匹配的标题
                        processed_news = []
                        title_set = set(titles)
                        
                        for platform in latest_processed.get("data", []):
                            for news in platform.get("data", []):
                                if news.get("title") in title_set:
                                    processed_news.append(news)
                        
                        # 如果找到了所有标题，直接返回
                        if len(processed_news) >= len(titles):
                            print(f"从处理好的数据中找到了所有{len(titles)}个标题")
                            return processed_news
                        
                        # 如果找到了部分标题，只分析剩余的标题
                        found_titles = set(news.get("title") for news in processed_news)
                        remaining_titles = []
                        remaining_platforms = []
                        
                        for i, title in enumerate(titles):
                            if title not in found_titles:
                                remaining_titles.append(title)
                                if i < len(platforms):
                                    remaining_platforms.append(platforms[i])
                                else:
                                    remaining_platforms.append("unknown")
                        
                        print(f"从处理好的数据中找到了{len(processed_news)}个标题，需要分析剩余的{len(remaining_titles)}个标题")
                        
                        # 分析剩余的标题
                        if remaining_titles:
                            new_analyzed = NewsService._analyze_news_titles(
                                remaining_titles, remaining_platforms, max_workers
                            )
                            return processed_news + new_analyzed
                        
                        return processed_news
                except (ValueError, TypeError):
                    pass
        
        # 如果没有最新处理好的数据，使用原始分析方法
        return NewsService._analyze_news_titles(titles, platforms, max_workers)
    
    @staticmethod
    def _analyze_news_titles(titles, platforms, max_workers=16):
        """
        分析新闻标题的原始方法
        """
        try:
            import random
            from datetime import datetime, timedelta
            import hashlib
            
            print(f"使用测试方法处理{len(titles)}条新闻")
            results = []
            
            for i, title in enumerate(titles):
                if not title:
                    continue
                
                platform = platforms[i] if i < len(platforms) else "unknown"
                news_id = hashlib.md5(title.encode()).hexdigest()
                
                # 生成随机情感数据
                emotion_schema = {
                    "喜悦": round(random.uniform(0, 30), 1),
                    "期待": round(random.uniform(0, 30), 1),
                    "平和": round(random.uniform(0, 30), 1),
                    "惊讶": round(random.uniform(0, 30), 1),
                    "悲伤": round(random.uniform(0, 30), 1),
                    "愤怒": round(random.uniform(0, 30), 1),
                    "恐惧": round(random.uniform(0, 30), 1),
                    "厌恶": round(random.uniform(0, 30), 1)
                }
                
                # 生成随机立场数据
                stance_schema = {
                    "积极倡导": round(random.uniform(5, 30), 1),
                    "强烈反对": round(random.uniform(5, 20), 1),
                    "中立陈述": round(random.uniform(10, 30), 1),
                    "质疑探究": round(random.uniform(5, 20), 1),
                    "理性建议": round(random.uniform(5, 20), 1),
                    "情绪宣泄": round(random.uniform(5, 15), 1),
                    "观望等待": round(random.uniform(5, 15), 1),
                    "扩散传播": round(random.uniform(5, 15), 1)
                }
                
                # 生成随机热度趋势
                now = datetime.now()
                heat_trend = []
                for j in range(5):
                    date = (now - timedelta(days=j)).strftime("%Y-%m-%d")
                    heat_trend.append({
                        "date": date,
                        "value": round(random.uniform(0.5, 1.0), 2)
                    })
                
                # 生成随机词云
                word_cloud = []
                common_words = ["新闻", "热点", "事件", "关注", "社会", "影响", "发展", 
                               "变化", "趋势", "分析", "报道", "媒体", "传播", "舆论"]
                
                for word in common_words:
                    word_cloud.append({
                        "word": word,
                        "weight": round(random.uniform(0.1, 1.0), 2)
                    })
                
                # 组装结果
                result = {
                    "id": news_id,
                    "title": title,
                    "summary": f"{title}的内容摘要...",
                    "category": random.choice(["时政", "科技", "财经", "社会", "国际"]),
                    "source": platform,
                    "location": {
                        "x": round(random.uniform(73, 135), 6),
                        "y": round(random.uniform(18, 53), 6)
                    },
                    "analyzed_at": datetime.now().isoformat(),
                    "spread_metrics": {
                        "speed": round(random.uniform(0.5, 1.0), 2),
                        "range": round(random.uniform(0.5, 1.0), 2),
                        "participants": round(random.uniform(0.5, 1.0), 2)
                    },
                    "emotion_analysis": {
                        "schema": emotion_schema,
                        "rationale": f"{title}引发的情感主要是期待和平和"
                    },
                    "stance_analysis": {
                        "schema": stance_schema,
                        "rationale": f"对{title}的立场主要是积极倡导和中立陈述"
                    },
                    "heat_trend": heat_trend,
                    "timeline": [
                        {
                            "date": (now - timedelta(days=2)).strftime("%Y-%m-%d"),
                            "event": f"{title}首次被报道"
                        },
                        {
                            "date": now.strftime("%Y-%m-%d"),
                            "event": f"{title}引发热议"
                        }
                    ],
                    "wordCloud": word_cloud,
                    "heat": round(random.uniform(60, 100), 2),
                    "is_fallback": True  # 标记为后备数据
                }
                
                results.append(result)
                print(f"生成测试数据: {title[:30]}...")
                
                # 模拟处理时间，避免CPU占用过高
                time.sleep(0.1)
            
            print(f"成功生成{len(results)}条测试数据")
            return results
            
        except Exception as e:
            print(f"生成测试数据时出错: {str(e)}")
            import traceback
            traceback.print_exc()
            return []

    @classmethod
    def update_current_hot_news(cls, n=None):
        """
        从hot_news_processed中找出最新的记录，从data[0].data里找出comprehensive_heat最高的前n条热搜，
        然后根据标题在transformed_news中查找最新的分析结果，
        将这些结果原封不动地覆盖current_hot_news表内容
        
        注意: 除了定时任务外，该功能也可以在服务器启动时通过命令行参数 --update-cache 手动触发
        """
        try:
            from flask import current_app
            from app.extensions import db
            
            # 从配置中获取默认值
            if n is None:
                n = current_app.config.get('TOP_HOT_NEWS_COUNT', 20)
                
            print(f"[{datetime.now()}] 开始更新前{n}条热搜新闻缓存...")
            
            # 步骤1: 从hot_news_processed获取最新的记录
            latest_record = db.hot_news_processed.find_one(
                sort=[("timestamp", pymongo.DESCENDING)]
            )
            
            if not latest_record:
                print("未找到热搜新闻记录")
                return {"status": "error", "message": "No hot news records found", "count": 0}
                
            # 步骤2: 从最新记录的data[0].data中获取前n条热搜（按comprehensive_heat排序）
            try:
                hot_news_data = latest_record.get('data', [{}])[0].get('data', [])
                if not hot_news_data:
                    print("热搜数据为空")
                    return {"status": "error", "message": "Hot news data is empty", "count": 0}
                    
                # 按comprehensive_heat排序并获取前n条
                sorted_news = sorted(hot_news_data, key=lambda x: x.get('comprehensive_heat', 0), reverse=True)
                top_news = sorted_news[:n]
                
                print(f"找到{len(top_news)}条热搜新闻（从总计{len(hot_news_data)}条中）")
                
                # 提取标题
                top_news_titles = [news.get('title') for news in top_news if news.get('title')]
                print(f"提取了{len(top_news_titles)}个有效标题")
                
                # 创建标题到当前热度数据的映射
                title_to_current_heat = {}
                for news in top_news:
                    if news.get('title'):
                        title_to_current_heat[news.get('title')] = {
                            'comprehensive_heat': news.get('comprehensive_heat', 0),
                            'timestamp': latest_record.get('timestamp')
                        }
                
                # 获取历史热度数据（过去7天）
                print("开始收集历史热度数据...")
                title_to_heat_history = {}
                
                # 计算7天前的时间
                seven_days_ago = datetime.now() - timedelta(days=7)
                
                # 获取过去7天的热度记录
                historical_records = list(db.hot_news_processed.find(
                    {"timestamp": {"$gte": seven_days_ago.isoformat()}},
                    sort=[("timestamp", pymongo.ASCENDING)]
                ))
                
                print(f"找到{len(historical_records)}条历史热度记录")
                
                # 为每个热门标题收集历史热度数据
                for title in top_news_titles:
                    heat_history = []
                    
                    # 遍历历史记录
                    for record in historical_records:
                        if not record.get('data') or not record.get('data')[0].get('data'):
                            continue
                            
                        record_timestamp = record.get('timestamp')
                        record_data = record.get('data', [{}])[0].get('data', [])
                        
                        # 在记录中查找匹配标题的新闻
                        for news_item in record_data:
                            if news_item.get('title') == title:
                                heat_history.append({
                                    'timestamp': record_timestamp,
                                    'comprehensive_heat': news_item.get('comprehensive_heat', 0),
                                    'weighted_heat_value': news_item.get('weighted_heat_value', 0),
                                    'normalized_heat': news_item.get('normalized_heat', 0)
                                })
                                break
                    
                    title_to_heat_history[title] = heat_history
                    print(f"为新闻《{title}》收集了{len(heat_history)}条历史热度数据")
                
            except (IndexError, KeyError, TypeError) as e:
                print(f"解析热搜数据时出错: {str(e)}")
                traceback.print_exc()
                return {"status": "error", "message": f"Error parsing hot news data: {str(e)}", "count": 0}
            
            if not top_news_titles:
                print("未找到有效的热搜新闻标题")
                return {"status": "error", "message": "No valid hot news titles found", "count": 0}
            
            # 步骤3: 根据标题获取最新的完整分析结果
            latest_analyses = []
            i = 1
            for title in top_news_titles:
                # 查找该标题最新的分析结果
                analysis = db.transformed_news.find_one(
                    {"title": title},
                    sort=[("analyzed_at", -1)]  # 按分析时间降序
                )
                
                if analysis:
                    # 移除MongoDB的_id字段，避免插入错误
                    if "_id" in analysis:
                        del analysis["_id"]
                    analysis["rank"] = i
                    i += 1
                    
                    # 添加热度历史数据
                    if title in title_to_heat_history:
                        analysis["heat_history"] = title_to_heat_history[title]
                        print(f"为新闻《{title}》添加了热度历史数据")
                    else:
                        analysis["heat_history"] = []
                        print(f"未找到新闻《{title}》的热度历史数据")
                    
                    latest_analyses.append(analysis)
                else:
                    print(f"未找到新闻《{title}》的分析结果")
            
            if not latest_analyses:
                print("未找到任何分析结果")
                return {"status": "error", "message": "No analysis results found", "count": 0}
            
            # 步骤4: 保存现有数据到历史记录并比较排名变化
            try:
                # 获取当前的热搜新闻数据（即将被删除的数据）
                current_hot_news = list(db.current_hot_news.find())
                print(f"获取到{len(current_hot_news)}条现有热搜数据")
                
                # 如果有现有数据，将其保存到历史记录中
                if current_hot_news:
                    # 给历史数据添加时间戳
                    timestamp = datetime.now().isoformat()
                    for item in current_hot_news:
                        if "_id" in item:
                            item["original_id"] = str(item["_id"])
                            del item["_id"]
                        item["archived_at"] = timestamp
                    
                    # 插入到历史记录集合
                    history_result = db.history_top_news.insert_many(current_hot_news)
                    history_count = len(history_result.inserted_ids) if hasattr(history_result, 'inserted_ids') else 0
                    print(f"成功保存{history_count}条历史热搜数据")
                    
                    # 创建标题到排名的映射，用于比较排名变化
                    title_to_old_rank = {item.get("title"): item.get("rank") for item in current_hot_news if item.get("title") and item.get("rank")}
                    
                    # 为新数据添加排名变化信息
                    for analysis in latest_analyses:
                        title = analysis.get("title")
                        new_rank = analysis.get("rank")
                        if title in title_to_old_rank and new_rank is not None:
                            old_rank = title_to_old_rank[title]
                            if new_rank < old_rank:
                                analysis["rank_change"] = "up"  # 排名上升（数字变小）
                                print(f"新闻《{title}》排名上升: {old_rank} -> {new_rank}")
                            elif new_rank > old_rank:
                                analysis["rank_change"] = "down"  # 排名下降（数字变大）
                                print(f"新闻《{title}》排名下降: {old_rank} -> {new_rank}")
                            else:
                                analysis["rank_change"] = "same"  # 排名不变
                                print(f"新闻《{title}》排名不变: 保持在第{new_rank}名")
                        else:
                            analysis["rank_change"] = "new"  # 新上榜
                            print(f"新闻《{title}》新上榜: 第{new_rank}名")
                else:
                    print("当前没有热搜数据，无需保存历史记录")
                    # 所有新数据标记为新上榜
                    for analysis in latest_analyses:
                        analysis["rank_change"] = "new"
            
            except Exception as e:
                print(f"处理历史数据和排名变化时出错: {str(e)}")
                traceback.print_exc()
                # 继续执行，不影响主流程
            
            # 步骤5: 清空current_hot_news表并插入新数据
            try:
                # 删除旧数据
                delete_result = db.current_hot_news.delete_many({})
                print(f"删除了{delete_result.deleted_count}条旧数据")
                
                # 插入新数据
                insert_result = db.current_hot_news.insert_many(latest_analyses)
                inserted_count = len(insert_result.inserted_ids) if hasattr(insert_result, 'inserted_ids') else 0
                print(f"插入了{inserted_count}条新数据")
            except Exception as e:
                print(f"更新数据库时出错: {str(e)}")
                traceback.print_exc()
                return {"status": "error", "message": str(e), "count": 0}
            
            print(f"[{datetime.now()}] 成功更新{len(latest_analyses)}条热搜新闻分析结果到缓存表")
            
            return {
                "status": "success", 
                "timestamp": latest_record.get('timestamp'),
                "total_hot_news": len(top_news),
                "matched_analysis_count": len(latest_analyses),
                "updated_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"更新热搜新闻缓存失败: {str(e)}")
            traceback.print_exc()
            return {"status": "error", "message": str(e), "count": 0} 