import requests
import json
import hashlib
import re
import math
from datetime import datetime, timedelta
from collections import defaultdict, Counter
from flask import current_app
from app.extensions import db
from app.utils.api_utils import fetch_hot_news
import os
import copy
import numpy as np

class NewsCollectionService:
    # Platform weights for different news sources
    PLATFORM_WEIGHTS = {
        # 头部综合平台（高覆盖率+强时效性）
        "微博": 20,  # 月活6亿，传播速度最快，权重较高
        "今日头条": 5,  # 降低权重以避免主导结果
        "知乎热榜": 2,  # 专业内容互动权重高
        "抖音": 5,  # 短视频平台，用户粘性强
        "百度热点": 10,  # 搜索引擎，覆盖广泛
        "36氪": 8888,  # 科技领域覆盖率TOP3
        "哔哩哔哩": 2,  # Z世代用户粘性强
        "weibo": 1.0,
        "zhihu": 0.9,
        "bilibili": 0.85,
        "wexin": 0.8,
        "toutiao": 0.75,
        "tiktok": 0.7,
        "163": 0.65,
        "36kr": 0.6,
        "youtube": 0.7,
        "twitter": 0.75,
        "meituan": 0.6,
        "cloudmusic": 0.55,
        "xiaohongshu": 0.5,
        "xiaomi": 0.5
    }

    # 定义平台类型分组
    PLATFORM_CATEGORIES = {
        "综合热点": ["微博", "今日头条", "抖音", "百度"],
        "专业平台": ["知乎热榜", "36氪", "哔哩哔哩"],
        "social_media": ["weibo", "zhihu", "bilibili", "tiktok", "xiaohongshu", "cloudmusic"],
        "news": ["baidu", "toutiao", "163", "36kr"],
        "international": ["youtube", "twitter"],
        "other": ["wexin", "meituan", "xiaomi"]
    }

    # 定义要排除的平台
    EXCLUDE_PLATFORMS = ["虫部落", "woShiPm", "虎嗅", "IT之家", "知乎日报", "虎扑", "豆瓣小组", "澎湃新闻", "xiaomi"]

    # 热度级别配置
    HEAT_LEVELS = {
        (0.8, 2): "爆",
        (0.6, 0.8): "热",
        (0.4, 0.6): "高",
        (0.2, 0.4): "中",
        (0, 0.2): "低"
    }

    @staticmethod
    def normalize_heat(heat_values):
        """
        将热度值归一化到 [0, 1] 范围
        """
        if not heat_values:
            return []
        min_heat = min(heat_values)
        max_heat = max(heat_values)
        if min_heat == max_heat:
            return [0] * len(heat_values)
        return [(heat - min_heat) / (max_heat - min_heat) for heat in heat_values]

    @staticmethod
    def normalize_within_platform(items):
        """
        在单个平台内部进行热度归一化
        """
        hot_values = [item['hot_value'] for item in items]
        normalized = NewsCollectionService.normalize_heat(hot_values)
        for item, norm_value in zip(items, normalized):
            item['normalized_hot'] = norm_value
        return items

    @staticmethod
    def parse_hot_value(hot_str):
        """
        处理不同格式的热度值，转换为浮点数
        """
        if not hot_str:
            return 0.0

        if isinstance(hot_str, (int, float)):
            return float(hot_str)

        # 记录原始输入以便调试
        original_value = str(hot_str)
        
        # 移除非数字内容（如"万"、"热度"、"亮"等）
        hot_str = str(hot_str)
        
        # 特殊处理知乎热榜格式，例如 "3901 万热度"
        if "万热度" in hot_str:
            try:
                # 提取数字部分
                num_part = hot_str.split("万热度")[0].strip()
                result = float(num_part) * 10000
             
                return result
            except ValueError:
              
                return 0.0
                
        # 特殊处理带有单位的数字格式，如"4.1万"、"3.6亿"
        match = re.search(r'([\d\.]+)([亿万千])', hot_str)
        if match:
            try:
                base_num = float(match.group(1))
                unit = match.group(2)
                multipliers = {'千': 1000, '万': 10000, '亿': 100000000}
                result = base_num * multipliers.get(unit, 1)
                print(f"解析带单位热度: '{original_value}' => {result}")
                return result
            except (ValueError, AttributeError):
                pass
        
        # 处理"万"单位但没有按正则匹配到的情况
        if "万" in hot_str:
            hot_str = hot_str.replace("万", "")
            try:
                result = float(hot_str) * 10000
                print(f"解析带'万'热度: '{original_value}' => {result}")
                return result
            except ValueError:
                print(f"解析带'万'热度失败: '{original_value}'")
        
        # 尝试直接提取数字部分
        hot_str = re.sub(r'[^0-9.]', '', hot_str)

        try:
            result = float(hot_str)
            # 对于某些平台（如36氪）可能需要额外的缩放
            if result < 100 and any(keyword in original_value.lower() for keyword in ["热度", "热力", "heat"]):
                # 如果热度值很小且含有"热度"关键词，可能是某种缩放后的值，乘以10000提升量级
                result = result * 10000
                print(f"对小热度值进行缩放: '{original_value}' => {result}")
            elif result < 1000 and "36氪" in original_value:
                # 36氪特殊处理
                result = result * 10000
                print(f"36氪热度值缩放: '{original_value}' => {result}")
            else:
                print(f"提取数字部分: '{original_value}' => {result}")
            return result
        except ValueError:
            print(f"无法解析热度值: '{original_value}'")
            return 0.0

    @staticmethod
    def parse_hotness(hotness_str):
        """
        将热度字符串解析为数值
        
        Args:
            hotness_str (str): 热度字符串，如"1.2万"、"3.4亿"等
            
        Returns:
            float: 解析后的数值
        """
        if not hotness_str or not isinstance(hotness_str, str):
            return 0
            
        # 记录原始输入以便调试
        original_value = str(hotness_str)
        
        # 清理字符串
        cleaned = hotness_str.strip().replace(',', '')
        
        # 特殊处理知乎格式
        if "万热度" in cleaned:
            try:
                num_part = cleaned.split("万热度")[0].strip()
                result = float(num_part) * 10000
                print(f"parse_hotness-知乎: '{original_value}' => {result}")
                return result
            except ValueError:
                pass
        
        # 匹配数字和单位
        match = re.search(r'([\d\.]+)([亿万千])?', cleaned)
        if not match:
            print(f"parse_hotness-无法匹配: '{original_value}'")
            return 0
            
        base_num = float(match.group(1))
        unit = match.group(2) if match.group(2) else ''
        
        # 根据单位转换数值
        multipliers = {'': 1, '千': 1000, '万': 10000, '亿': 100000000}
        result = base_num * multipliers.get(unit, 1)
        
        # 特殊处理某些平台
        if "36氪" in original_value and result < 1000:
            result = result * 10000
            print(f"parse_hotness-36氪: '{original_value}' => {result}")
        elif "澎湃" in original_value and result < 1000:
            result = result * 10000
            print(f"parse_hotness-澎湃: '{original_value}' => {result}")
        else:
            print(f"parse_hotness: '{original_value}' => {result}")
            
        return result

    @staticmethod
    def normalize_heat_value(value, max_heat_values):
        """
        将不同平台的热度值归一化到[0,1]范围
        
        Args:
            value (float): 热度值
            platform (str): 平台名称
            max_heat_values (dict): 各平台的最大热度值
        
        Returns:
            float: 归一化后的热度值
        """
            
        
        # 对于头部新闻，避免都归一化为1，采用开方变换增加区分度
        # 使用1.15倍最大值作为归一化基准，以降低头部新闻都是1的概率
            
        # 线性归一化，使用调整后的全局最大值
        normalized = value / max_heat_values
        
        # 对归一化值进行开方变换，增加头部区分度
        # 幂次小于1会拉伸较大值之间的差异
        if normalized > 0:
            normalized = normalized ** 0.8
            
        return max(0,normalized)  # 确保值在[0,1]范围内

    @staticmethod
    def check_recent_update(max_age_hours=1):
        """
        检查数据库中是否有最近的更新
        
        Args:
            max_age_hours (int): 最大有效时间（小时）
            
        Returns:
            bool: 如果有最近更新则返回True，否则返回False
        """
        try:
            print(f"检查是否有最近{max_age_hours}小时内的更新")
            cutoff_time = datetime.now() - timedelta(hours=max_age_hours)
            cutoff_time_str = cutoff_time.isoformat()
            print(f"截止时间: {cutoff_time_str}")
            
            # 查询最近更新的记录
            latest = db.hot_news_processed.find_one(
                sort=[("timestamp", -1)]
            )
            
            if latest and "timestamp" in latest:
                timestamp = latest["timestamp"]
                if isinstance(timestamp, str):
                    try:
                        print(f"最近更新时间: {timestamp}")
                        timestamp_dt = datetime.fromisoformat(timestamp)
                        is_recent = timestamp_dt > cutoff_time
                        print(f"数据是否在{max_age_hours}小时内: {is_recent}")
                        return is_recent
                    except ValueError as e:
                        print(f"时间戳格式无效: {timestamp}, 错误: {str(e)}")
                        return False
                elif isinstance(timestamp, datetime):
                    is_recent = timestamp > cutoff_time
                    print(f"最近更新时间: {timestamp.isoformat()}")
                    print(f"数据是否在{max_age_hours}小时内: {is_recent}")
                    return is_recent
            
            print("数据库中没有找到最近的更新或时间戳字段")
            return False
            
        except Exception as e:
            print(f"检查最近更新失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

    @staticmethod
    def process_hot_news(response_file=None, skip_save=False, force_update=False):
        """
        处理热门新闻数据，整合get_hot_news.py的功能
        
        Args:
            response_file (str, optional): 响应文件路径，默认值为None，
                                        None表示使用API获取数据
            skip_save (bool, optional): 是否跳过保存到数据库，默认为False
            force_update (bool, optional): 是否强制更新，即使数据库中有最近的数据，默认为False
        
        Returns:
            dict: 处理后的热门新闻数据
        """
        try:
            print("开始处理热门新闻数据...")
            
            # 如果不是强制更新，首先检查是否有最近更新
            if not force_update and not response_file:
                if NewsCollectionService.check_recent_update(max_age_hours=1):
                    print("数据库中已有最近更新，跳过处理")
                    return NewsCollectionService.get_latest_processed_news()
            
            # 获取热点新闻数据
            if response_file and isinstance(response_file, str) and os.path.exists(response_file):
                print(f"从文件读取热门新闻数据: {response_file}")
                # 从文件读取
                with open(response_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            else:
                print("从API获取热门新闻数据...")
                # 从API获取
                data = fetch_hot_news()
                
            if not data:
                print("未能获取到热门新闻数据")
                return None
            
            # 获取所有新闻并合并
            all_news = []
            platforms = {}
            print(f"原始数据包含 {len(data.get('data', []))} 个平台的新闻")
            
            # 收集并标准化每个平台的新闻
            for platform_data in data.get("data", []):
                platform = platform_data.get("name")
                
                if platform in NewsCollectionService.EXCLUDE_PLATFORMS:
                    print(f"跳过排除的平台: {platform}")
                    continue
                    
                platforms[platform] = {
                    "name": platform,
                    "platform": platform,
                    "data": []
                }
                
                news_list = platform_data.get("data", [])
                print(f"处理平台 {platform} 的 {len(news_list)} 条新闻")
                
                for news in news_list:
                    hotness = news.get("hot", "0")
                    news_item = {
                        "title": news.get("title", ""),
                        "url": news.get("url", ""),
                        "hotness": hotness,
                        "heat_value": NewsCollectionService.parse_hotness(hotness),
                        "platform": platform
                    }
                    platforms[platform]["data"].append(news_item)
            
            # 计算加权热度和归一化
            max_heat_values = {}
            for platform, platform_data in platforms.items():
                platform_weight = NewsCollectionService.PLATFORM_WEIGHTS.get(platform, 0.5)
                max_heat = 0
                for news in platform_data["data"]:
                    news["weighted_heat_value"] = news["heat_value"] * platform_weight
                    max_heat = max(max_heat, news["weighted_heat_value"])
                max_heat_values[platform] = max_heat
                print(f"平台 {platform} 的最大加权热度值: {max_heat}")
            
            global_max_heat = max(max_heat_values.values()) if max_heat_values else 0
            print(f"全局最大加权热度值: {global_max_heat}")
            
            for platform, platform_data in platforms.items():
                for news in platform_data["data"]:
                    news["normalized_heat"] = NewsCollectionService.normalize_heat_value(
                        news["weighted_heat_value"], global_max_heat
                    )
            print("完成跨平台热度全局归一化")
            
            # 收集处理后的新闻到all_news
            all_news = []
            for platform_data in platforms.values():
                all_news.extend(platform_data["data"])
            print(f"标准化后共有 {len(all_news)} 条新闻")
            
            # 合并相同标题的新闻
            merged_news = {}
            for news in all_news:
                title = news["title"].strip()
                if not title:
                    continue
                    
                platform = news["platform"]
                normalized_heat = news["normalized_heat"]
                
                if title in merged_news:
                    merged_news[title]["platforms"].append(platform)
                    merged_news[title]["platform_count"] += 1
                    merged_news[title]["heat_sum"] += normalized_heat
                    merged_news[title]["weighted_heat_value"] += int(news["weighted_heat_value"])
                else:
                    merged_news[title] = {
                        "title": title,
                        "url": news["url"],
                        "platforms": [platform],
                        "platform_count": 1,
                        "heat_sum": normalized_heat,
                        "weighted_heat_value": int(news["weighted_heat_value"]),
                        "hotness": news["hotness"],
                    }
            
            print(f"合并后共有 {len(merged_news)} 条不同标题的新闻")
            
            # 计算综合热度分数
            for title, news in merged_news.items():
                diversity_score = min(1.0, news["platform_count"] / 3)
                news["comprehensive_heat"] = news["heat_sum"] * (1 + diversity_score)
                news["comprehensive_heat"] = min(1.0, news["comprehensive_heat"])
            
            # 按综合热度排序
            sorted_news = sorted(
                merged_news.values(),
                key=lambda x: x["comprehensive_heat"],
                reverse=True
            )
            print(f"排序后共有 {len(sorted_news)} 条新闻")
            
            # 最终归一化并计算热度级别
            if sorted_news:
                max_heat = max(news["comprehensive_heat"] for news in sorted_news)
                print(f"最大综合热度值: {max_heat}")
                
                for news in sorted_news:
                    news["normalized_heat"] = news["comprehensive_heat"] / max_heat if max_heat > 0 else 0
                    for (min_val, max_val), level in NewsCollectionService.HEAT_LEVELS.items():
                        if min_val <= news["normalized_heat"] < max_val:
                            news["heat_level"] = level
                            break
                    else:
                        news["heat_level"] = "低"
                    
                    categories_covered = set()
                    for platform in news["platforms"]:
                        for category, platforms in NewsCollectionService.PLATFORM_CATEGORIES.items():
                            if platform in platforms:
                                categories_covered.add(category)
                                break
                    news["category_diversity"] = len(categories_covered)
            else:
                print("没有有效的新闻数据")
            
            # 整理结果
            result = {
                "timestamp": datetime.now().isoformat(),
                "total_news": len(sorted_news),
                "data": [{
                    "name": "热门新闻",
                    "platform": "comprehensive",
                    "data": sorted_news
                }]  
            }
            
            # 保存到数据库
            if not skip_save:
                print("保存热门新闻数据到MongoDB...")
                try:
                    db.hot_news_processed.insert_one(result)
                    print("数据成功保存到MongoDB")
                except Exception as db_error:
                    print(f"MongoDB保存失败: {str(db_error)}")
                print(f"处理了 {len(sorted_news)} 条热门新闻并保存到数据库")
            else:
                print("跳过保存到MongoDB")
            
            return result
            
        except Exception as e:
            print(f"处理热门新闻时出错: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
    
    @staticmethod
    def collect_news(force=False):
        """
        从API收集最新热门新闻并处理
        
        Args:
            force (bool): 是否强制采集，即使数据库中有最近的数据
            
        Returns:
            dict: 包含处理后的热门新闻数据
        """
        try:
            # 检查是否有最近更新
            print("in collect_news")
            if not force and NewsCollectionService.check_recent_update(max_age_hours=1):
                print("数据库中已有最近更新，跳过采集")
                
                # 返回最近的处理结果
                latest = db.hot_news_processed.find_one(
                    sort=[("timestamp", -1)]
                )
                
                if latest:
                    return {"status": "recent_data", "timestamp": latest.get("timestamp")}
                
                # 如果没有找到最近的结果但判断存在更新，防止重复获取
                return {"status": "recent_data_expected", "message": "数据库中应该有最近更新，但未能获取到"}
            
            api_url = current_app.config.get('NEWS_API_BASE_URL', 'https://api.vvhan.com/api/hotlist/all')
            
            try:
                # 获取API数据
                print(f"从API获取热门新闻: {api_url}")
                response = requests.get(api_url, timeout=10)
                response.raise_for_status()
                data = response.json()
                
                if not data.get('success'):
                    raise ValueError("API返回数据格式错误")
                
                # 处理热门新闻
                result = NewsCollectionService.process_hot_news(data, force_update=force)
                
                if result:
                    return {"status": "success", "total_news": result.get("total_news", 0)}
                else:
                    return {"status": "error", "message": "处理热门新闻失败"}
                
            except requests.exceptions.RequestException as e:
                print(f"请求API失败: {str(e)}")
                return {"status": "api_error", "message": str(e)}
                
        except Exception as e:
            print(f"新闻采集失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"status": "error", "message": str(e)}
    
    @staticmethod
    def get_latest_processed_news():
        """
        从MongoDB获取最新处理过的热门新闻数据
        
        Returns:
            dict: 包含最新处理过的热门新闻数据的字典
        """
        try:
            # 直接使用已导入的db对象
            # 获取最新的一条记录，按时间戳降序排序
            latest_record = db.hot_news_processed.find_one(
                sort=[("timestamp", -1)]
            )
            
            if latest_record:
                # 转换ObjectId为字符串，以便JSON序列化
                if "_id" in latest_record:
                    latest_record["_id"] = str(latest_record["_id"])
                
                return latest_record
            
            return None
        except Exception as e:
            print(f"获取最新处理过的热门新闻数据失败: {str(e)}")
            return None

    @staticmethod
    def get_latest_news(limit=100):
        """
        获取最新的新闻数据（未处理的）
        
        Args:
            limit (int): 限制返回的记录数量
            
        Returns:
            list: 新闻数据列表
        """
        try:
            latest_news = list(db.hot_news.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit))
            return latest_news
        except Exception as e:
            print(f"获取最新新闻失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return []

    @staticmethod
    def generate_content_hash(data):
        """
        生成内容哈希值，用于快速比较两份数据是否有实质区别
        
        Args:
            data (dict): 新闻数据
            
        Returns:
            str: 哈希值
        """
        if not data or not isinstance(data, dict):
            return ""
            
        # 创建标题集合用于哈希计算
        titles = set()
        try:
            # 提取所有平台的标题
            for platform_data in data.get("data", []):
                platform_items = platform_data.get("data", [])
                for item in platform_items:
                    if "title" in item:
                        titles.add(item["title"])
        except (KeyError, TypeError, AttributeError):
            # 处理数据结构不符合预期的情况
            pass
            
        # 对标题集合进行排序并连接
        sorted_titles = sorted(titles)
        title_str = "|".join(sorted_titles)
        
        # 生成MD5哈希
        return hashlib.md5(title_str.encode('utf-8')).hexdigest()
        
    @staticmethod
    def smart_collect_news(force=False, max_age_minutes=55):
        """
        智能采集热门新闻，包含变更检测机制，避免重复采集相同内容
        
        Args:
            force (bool): 是否强制采集，忽略时间和变更检测
            max_age_minutes (int): 数据的最大有效时间（分钟）
            
        Returns:
            dict: 采集结果统计
        """
        try:
            print(f"智能热门新闻采集开始，最大有效期: {max_age_minutes}分钟, 强制更新: {force}")
            
            # 1. 检查最近更新时间
            if not force:
                cutoff_time = datetime.now() - timedelta(minutes=max_age_minutes)
                
                # 获取最近一条记录
                latest = db.hot_news.find_one(sort=[("timestamp", -1)])
                
                if latest and "timestamp" in latest:
                    timestamp = latest.get("timestamp")
                    if isinstance(timestamp, str):
                        try:
                            timestamp_dt = datetime.fromisoformat(timestamp)
                            if timestamp_dt > cutoff_time:
                                # 检查更新次数记录，分析一段时间内的更新模式
                                update_times = []
                                updates = list(db.hot_news_updates.find(
                                    {"timestamp": {"$gte": (datetime.now() - timedelta(days=1)).isoformat()}},
                                    {"timestamp": 1, "_id": 0}
                                ).sort("timestamp", 1))
                                
                                for update in updates:
                                    try:
                                        update_time = datetime.fromisoformat(update.get("timestamp"))
                                        update_times.append(update_time)
                                    except (ValueError, TypeError):
                                        pass
                                
                                # 数据足够新，只需要检查变更
                                content_hash = latest.get("content_hash", "")
                                current_data = fetch_hot_news()
                                
                                if current_data and "data" in current_data:
                                    current_hash = NewsCollectionService.generate_content_hash(current_data)
                                    
                                    # 如果内容哈希值相同，数据没有变化，跳过采集
                                    if content_hash and content_hash == current_hash:
                                        print(f"数据哈希值相同({content_hash[:8]}...)，未检测到API更新，跳过采集")
                                        
                                        # 记录检查时间
                                        db.hot_news_checks.insert_one({
                                            "timestamp": datetime.now().isoformat(),
                                            "content_hash": content_hash,
                                            "result": "unchanged",
                                            "age_minutes": (datetime.now() - timestamp_dt).total_seconds() / 60
                                        })
                                        
                                        return {
                                            "status": "unchanged",
                                            "message": "API数据未更新",
                                            "last_update": timestamp,
                                            "check_time": datetime.now().isoformat()
                                        }
                                    
                                    # 内容哈希值不同，数据有更新
                                    print(f"检测到API数据更新，旧哈希: {content_hash[:8]}..., 新哈希: {current_hash[:8]}...")
                                    
                                    # 记录更新时间模式
                                    update_time = datetime.now()
                                    db.hot_news_updates.insert_one({
                                        "timestamp": update_time.isoformat(),
                                        "old_hash": content_hash,
                                        "new_hash": current_hash,
                                        "minute_of_hour": update_time.minute,
                                        "hour": update_time.hour
                                    })
                                    
                                    # 智能推测下一次更新时间
                                    if len(update_times) >= 5:
                                        # 分析更新时间模式
                                        minutes = [t.minute for t in update_times[-5:]]
                                        hours = [t.hour for t in update_times[-5:]]
                                        
                                        # 检查是否有规律的分钟模式
                                        minute_counter = Counter(minutes)
                                        common_minute = minute_counter.most_common(1)[0][0] if minute_counter else None
                                        
                                        if common_minute is not None and minute_counter[common_minute] >= 3:
                                            print(f"发现API更新模式: 多数在每小时的第{common_minute}分钟更新")
                                            # 可以存储此模式用于优化未来的采集策略
                                            db.api_update_patterns.update_one(
                                                {"type": "hourly_pattern"},
                                                {"$set": {
                                                    "common_minute": common_minute,
                                                    "confidence": minute_counter[common_minute] / len(minutes),
                                                    "updated_at": datetime.now().isoformat()
                                                }},
                                                upsert=True
                                            )
                        except ValueError:
                            pass
            
            # 执行正常的采集流程
            result = NewsCollectionService.collect_news(force=force)
            
            # 更新API更新时间估计
            current_minute = datetime.now().minute
            db.hot_news_metadata.update_one(
                {"key": "last_api_update"},
                {"$set": {
                    "timestamp": datetime.now().isoformat(),
                    "minute_of_hour": current_minute
                }},
                upsert=True
            )
            
            return result
            
        except Exception as e:
            print(f"智能热门新闻采集失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"status": "error", "message": str(e)}
            
    @staticmethod
    def schedule_deep_analysis(max_news=10):
        """
        安排深度新闻分析任务，优先分析高热度新闻
        
        Args:
            max_news (int): 最大分析新闻数量
            
        Returns:
            dict: 安排结果统计
        """
        try:
            print(f"安排深度新闻分析任务，最大数量: {max_news}")
            
            # 获取最新处理的热门新闻数据
            latest_processed = NewsCollectionService.get_latest_processed_news()
            if not latest_processed or "data" not in latest_processed:
                print("未找到已处理的热门新闻数据，无法安排分析")
                return {"status": "error", "message": "未找到热门新闻数据"}
                
            # 获取综合热力榜数据
            news_to_analyze = []
            
            for platform_data in latest_processed["data"]:
                if platform_data.get("platform") == "comprehensive":
                    # 按综合热度降序排序
                    news_list = platform_data.get("data", [])
                    sorted_news = sorted(news_list, key=lambda x: x.get("comprehensive_heat", 0), reverse=True)
                    
                    # 取前max_news条新闻
                    top_news = sorted_news[:max_news]
                    
                    # 添加到待分析列表
                    for news in top_news:
                        news_to_analyze.append({
                            "title": news.get("title", ""),
                            "platform": news.get("platforms", ["unknown"])[0] if news.get("platforms") else "unknown",
                            "url": news.get("url", ""),
                            "heat": news.get("comprehensive_heat", 0)
                        })
            
            if not news_to_analyze:
                print("未找到需要分析的热门新闻")
                return {"status": "error", "message": "未找到需要分析的热门新闻"}
                
            print(f"找到{len(news_to_analyze)}条需要深度分析的热门新闻")
            
            # 导入NewsService并调用其方法安排分析任务
            from .news_service import NewsService
            
            # 过滤出未分析或分析时间超过24小时的新闻
            existing, to_analyze = NewsService.check_news_in_database(news_to_analyze, max_age=24)
            
            if not to_analyze:
                print("所有热门新闻都已有最新分析，无需再次分析")
                return {"status": "skipped", "message": "所有新闻已有分析"}
                
            print(f"安排分析{len(to_analyze)}条热门新闻")
            
            # 将新闻加入分析队列
            result = NewsService.schedule_news_analysis()
            
            # 开始处理队列
            process_result = NewsService.process_queue_immediately(max_workers=16)
            
            return {
                "status": "scheduled",
                "message": f"已安排{len(to_analyze)}条热门新闻深度分析",
                "schedule_result": result,
                "process_result": process_result
            }
            
        except Exception as e:
            print(f"安排深度新闻分析失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"status": "error", "message": str(e)}

    @staticmethod
    def detect_high_heat_news(threshold=0.75):
        """
        检测高热度新闻并触发即时分析
        此方法可被集成到智能采集流程中，自动检测重大热点
        
        Args:
            threshold (float): 热度阈值，范围为[0,1]，高于此值的新闻会触发即时分析
            
        Returns:
            dict: 检测结果统计
        """
        try:
            print(f"检测高热度新闻，阈值: {threshold}")
            
            # 获取最新处理的热门新闻数据
            latest_processed = NewsCollectionService.get_latest_processed_news()
            if not latest_processed or "data" not in latest_processed:
                print("未找到已处理的热门新闻数据，无法检测高热度新闻")
                return {"status": "error", "message": "未找到热门新闻数据"}
                
            # 检查是否有高热度新闻
            high_heat_news = []
            
            for platform_data in latest_processed["data"]:
                if platform_data.get("platform") == "comprehensive":
                    news_list = platform_data.get("data", [])
                    
                    for news in news_list:
                        # 获取归一化后的热度值
                        normalized_heat = news.get("normalized_heat", 0)
                        
                        # 如果热度值高于阈值，添加到高热度列表
                        if normalized_heat >= threshold:
                            # 检查该新闻是否已在近期分析过
                            news_id = hashlib.md5(news.get("title", "").encode()).hexdigest()
                            
                            # 查询分析记录
                            from app.extensions import db
                            recent_analysis = db.news_analysis_records.find_one({
                                "news_id": news_id,
                                "analyzed_at": {"$gte": (datetime.now() - timedelta(hours=4)).isoformat()}
                            })
                            
                            # 如果最近4小时内未分析过，加入待分析列表
                            if not recent_analysis:
                                high_heat_news.append({
                                    "title": news.get("title", ""),
                                    "platform": news.get("platforms", ["unknown"])[0] if news.get("platforms") else "unknown",
                                    "url": news.get("url", ""),
                                    "heat": news.get("comprehensive_heat", 0),
                                    "normalized_heat": normalized_heat
                                })
                            else:
                                print(f"高热度新闻'{news.get('title', '')[:30]}...'已于{recent_analysis.get('analyzed_at')}分析过，跳过")
            
            if not high_heat_news:
                print(f"未检测到热度高于{threshold}的新闻")
                return {"status": "normal", "message": "未检测到高热度新闻"}
                
            print(f"检测到{len(high_heat_news)}条高热度新闻，准备即时分析")
            
            # 记录高热度新闻检测
            from app.extensions import db
            db.high_heat_detections.insert_one({
                "timestamp": datetime.now().isoformat(),
                "threshold": threshold,
                "detected_count": len(high_heat_news),
                "news_titles": [news.get("title") for news in high_heat_news]
            })
            
            # 导入NewsService并调用其方法安排分析任务
            from .news_service import NewsService
            
            # 将高热度新闻加入分析队列
            for news in high_heat_news:
                news_id = hashlib.md5(news.get("title", "").encode()).hexdigest()
                
                # 使用高优先级标记，确保优先分析
                db.news_analysis_queue.update_one(
                    {"news_id": news_id},
                    {"$set": {
                        "news_id": news_id,
                        "news_data": news,
                        "status": "pending",
                        "priority": "high",  # 高优先级标记
                        "queued_at": datetime.now().isoformat(),
                        "attempts": 0,
                        "last_attempt": None,
                        "heat_level": news.get("normalized_heat", 0)
                    }},
                    upsert=True
                )
                
                # 记录到分析记录
                db.news_analysis_records.insert_one({
                    "news_id": news_id,
                    "title": news.get("title", ""),
                    "queued_at": datetime.now().isoformat(),
                    "heat_level": news.get("normalized_heat", 0),
                    "trigger": "high_heat_detection"
                })
            
            # 立即启动处理队列
            process_result = NewsService.process_queue_immediately(max_workers=2)
            
            return {
                "status": "high_heat_detected",
                "message": f"检测到{len(high_heat_news)}条高热度新闻并安排即时分析",
                "news_count": len(high_heat_news),
                "titles": [news.get("title") for news in high_heat_news],
                "process_result": process_result
            }
            
        except Exception as e:
            print(f"检测高热度新闻失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"status": "error", "message": str(e)}
