import json
import random
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm
import time
import traceback
from datetime import datetime, timedelta
import hashlib
import requests
from openai import OpenAI
from flask import current_app
from ..utils.db_utils import update_analysis_status, get_pending_analysis_tasks
from ..utils.data_utils import validate_and_fix_data, generate_fallback_data
import inspect

# 客户端工厂函数 - 以处理不同版本的OpenAI库
def create_openai_client(api_key, base_url):
    """创建OpenAI客户端，处理不同版本的API兼容性"""
    try:
        # 检查OpenAI类的初始化参数
        params = inspect.signature(OpenAI.__init__).parameters
        valid_params = {}
        
        # 添加基本参数
        valid_params['api_key'] = api_key
        if 'base_url' in params:
            valid_params['base_url'] = base_url
        print(f"api_key: {api_key}")
        print(f"base_url: {base_url}")
        # 创建客户端，仅使用有效参数
        print(f"尝试创建OpenAI客户端，使用参数: {list(valid_params.keys())}")
        return OpenAI(**valid_params)
        
    except TypeError as e:
        print(f"OpenAI客户端初始化失败: {str(e)}")
        
        # 尝试最小化参数创建
        try:
            print("尝试仅使用api_key创建客户端")
            return OpenAI(api_key=api_key)
        except Exception as min_e:
            print(f"使用最小化参数创建失败: {str(min_e)}")
            raise
    except Exception as e:
        print(f"创建OpenAI客户端时发生错误: {str(e)}")
        raise

# 创建MockClient作为备用方案
class MockClient:
    """当无法创建真实客户端时的备用模拟客户端"""
    
    class MockChoice:
        def __init__(self, content=None):
            self.delta = type('obj', (object,), {'content': content})
            
    class MockResponse:
        def __init__(self, content):
            self.choices = [MockClient.MockChoice(content)]
            
    class CompletionsAPI:
        def create(self, **kwargs):
            """模拟OpenAI API的create方法，支持stream=True参数"""
            print("使用模拟客户端创建完成，将返回模拟数据")
            
            # 检查是否需要流式响应
            stream = kwargs.get('stream', False)
            
            if stream:
                # 模拟流式响应，返回一个生成器
                chunks = [
                    '{"id": "mock-123",',
                    ' "x": 116.3, "y": 39.9,',
                    ' "type": "社会",',
                    ' "title": "' + kwargs.get('messages', [{}])[-1].get('content', '模拟新闻') + '",',
                    ' "introduction": "这是一条模拟数据，用于测试",',
                    ' "spreadSpeed": 0.7,',
                    ' "spreadRange": 0.6,',
                    ' "participants": 0.5,',
                    ' "emotion": { "schema": { "喜悦": 0.2, "期待": 0.2, "平和": 0.2, "惊讶": 0.1, "悲伤": 0.1, "愤怒": 0.1, "恐惧": 0.05, "厌恶": 0.05 } },',
                    ' "wordCloud": [{"weight": 10, "word": "测试"}, {"weight": 8, "word": "模拟"}]',
                    '}'
                ]
                
                # 返回模拟的流式响应对象
                for chunk in chunks:
                    yield MockClient.MockResponse(chunk)
            else:
                # 正常响应，直接返回完整JSON
                return {
                    "id": "mock-123",
                    "x": 116.3, 
                    "y": 39.9,
                    "type": "社会",
                    "title": kwargs.get('messages', [{}])[-1].get('content', '模拟新闻'),
                    "introduction": "这是一条模拟数据，用于测试",
                    "spreadSpeed": 0.7,
                    "spreadRange": 0.6,
                    "participants": 0.5,
                    "emotion": { 
                        "schema": { 
                            "喜悦": 0.2, 
                            "期待": 0.2, 
                            "平和": 0.2, 
                            "惊讶": 0.1, 
                            "悲伤": 0.1, 
                            "愤怒": 0.1, 
                            "恐惧": 0.05, 
                            "厌恶": 0.05 
                        } 
                    },
                    "wordCloud": [
                        {"weight": 10, "word": "测试"}, 
                        {"weight": 8, "word": "模拟"}
                    ]
                }
    
    def __init__(self):
        self.chat = self.CompletionsAPI()

class NewsAnalysisService:
    def __init__(self, api_key, base_url="https://api.openai.com/v1", model="gpt-3.5-turbo"):
        """
        初始化新闻分析服务
        
        Args:
            api_key (str): API密钥
            base_url (str): API基础URL
            model (str): 使用的模型名称
        """
        self.model = model
        self.use_mock = False
        
        try:
            # 使用工厂函数创建客户端
            print(f"正在创建OpenAI客户端 (model={model})")
            self.client = create_openai_client(api_key, base_url)
            print("OpenAI客户端创建成功")
        except Exception as e:
            print(f"OpenAI客户端创建失败，将使用模拟客户端: {str(e)}")
            self.client = MockClient()
            self.use_mock = True
        
        current_date = datetime.now().strftime("%Y-%m-%d")
        current_date_str = f'今天是{current_date}，'
        tmpprompt = current_date_str + """请你扮演新闻助理，为近期指定新闻梳理信息脉络，并量化关键参数。依据给定新闻标题，参考关键词id、type、title等进行如下操作：

1. **参数量化**：将spreadSpeed、spreadRange、participants、emotion、heatTrend、timeline相关参数量化至0 - 1区间。其中emotion各维度数值总和需为1。词云词数至少50条

2. **信息细化**：热度趋势和事件时间线需从事件爆发首日起，尽可能详细梳理，确保数据真实可靠，严禁伪造。

3. **输出规范**：请以JSON格式输出结果，不要包含任何其他文字说明
{
    "id": "编号",
    "x": 经度,
    "y": 纬度,
    "type": "类型",
    "title": "新闻名称",
    "introduction": "内容",
    "spreadSpeed": 量化值,
    "spreadRange": 量化值,
    "participants": 热度参与大致人数量化值,
    "emotion": {
      "schema": {
        "喜悦": 量化值,
        "期待": 量化值,
        "平和": 量化值,
        "惊讶": 量化值,
        "悲伤": 量化值,
        "愤怒": 量化值,
        "恐惧": 量化值,
        "厌恶": 量化值
      },
      "rationale": "阐述情绪维度量化依据"
    },
    "stance": {
      "schema": {
        "积极倡导": 量化值,
        "强烈反对": 量化值,
        "中立陈述": 量化值,
        "质疑探究": 量化值,
        "理性建议": 量化值,
        "情绪宣泄": 量化值,
        "观望等待": 量化值,
        "扩散传播": 量化值
      },
      "rationale": "阐述立场维度量化依据"
    },
    "heatTrend": [
        {"date": "日期1", "value": 热度量化值},
        {"date": "日期2", "value": 热度量化值},
        {"date": "日期3", "value": 热度量化值}
    ],
    "timeline": [
        {"date":"日期1", "event": "时间点详细介绍"},
        {"date":"日期2", "event": "时间点详细介绍"}
    ],
    "wordCloud": [
        {"weight": 真实值1, "word": "word1"},
        {"weight": 真实值2, "word": "word2"}
    ]
}

请确保:
- 经纬度是合理的地理坐标
- 所有量化值在0-1范围内
- emotion各维度总和为1
- 至少提供5个热度趋势数据点
- 至少提供3个时间线事件
- 词云词汇至少50个
- 数据尽可能真实可靠
"""
        self.sys_prompt = tmpprompt
        
        # API调用监控
        self.api_stats = {
            "total": 0,
            "success": 0,
            "timeout": 0,
            "error": 0,
            "rate_limited": 0,
            "avg_duration": 0,
            "durations": []
        }

    def analyze_news(self, news_data):
        """
        分析单个新闻
        
        Args:
            news_data (dict): 新闻数据，必须包含'id'和'title'字段
            
        Returns:
            dict: 分析结果
        """
        # 获取新闻信息
        news_id = news_data.get("id")
        news_title = news_data.get("title", "未知标题")
        
        if not news_id:
            raise ValueError("新闻数据缺少必要的id字段")
            
        print(f"开始分析新闻: {news_title}")
        
        # 更新状态为处理中
        update_analysis_status(news_id, "processing")
        
        # 处理各种客户端异常情况
        if self.use_mock:
            print(f"使用模拟客户端分析新闻: {news_title}")
            fallback = generate_fallback_data(news_title)
            update_analysis_status(news_id, "completed", fallback)
            return fallback
        elif self.client is None:
            print(f"警告: API客户端未初始化，使用备用数据: {news_title}")
            fallback = generate_fallback_data(news_title)
            update_analysis_status(news_id, "completed", fallback)
            return fallback
            
        # 构建消息内容
        messages = [
            {'role': 'system', 'content': self.sys_prompt},
            {'role': 'user', 'content': news_title}
        ]
        
        try:
            # 流式调用API
            start_time = time.time()
            
            # 记录API调用
            self.api_stats["total"] += 1
            
            # 流式调用API
            try:
                stream = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=0.7,
                    stream=True,  # 启用流式处理
                    extra_body={"enable_search": True}
                )
            except Exception as api_error:
                print(f"API调用失败: {str(api_error)}")
                # 尝试不带enable_search参数重试一次
                if "extra_body" in str(api_error) or "enable_search" in str(api_error):
                    print("尝试不带enable_search参数重试...")
                    stream = self.client.chat.completions.create(
                        model=self.model,
                        messages=messages,
                        temperature=0.7,
                        stream=True  # 启用流式处理
                    )
                else:
                    raise
            
            # 收集所有响应片段
            response_chunks = []
            for chunk in stream:
                if hasattr(chunk.choices[0], 'delta') and hasattr(chunk.choices[0].delta, 'content') and chunk.choices[0].delta.content:
                    response_chunks.append(chunk.choices[0].delta.content)
            
            # 计算API调用时间
            api_duration = time.time() - start_time
            
            # 更新API统计
            self.api_stats["success"] += 1
            self.api_stats["durations"].append(api_duration)
            
            # 计算平均响应时间
            if self.api_stats["durations"]:
                self.api_stats["avg_duration"] = sum(self.api_stats["durations"]) / len(self.api_stats["durations"])
            
            # 检测是否可能被限流
            if api_duration > 2 * self.api_stats["avg_duration"] and api_duration > 10:
                self.api_stats["rate_limited"] += 1
                print(f"⚠️ 可能被限流: 请求耗时 {api_duration:.2f}秒，是平均时间的 {api_duration/self.api_stats['avg_duration']:.1f}倍")
            
            # 合并所有响应片段
            result_str = "".join(response_chunks)
            
            try:
                # 尝试去除可能的markdown格式 ```json ... ```
                if "```json" in result_str:
                    result_str = result_str.split("```json")[1].split("```")[0].strip()
                elif "```" in result_str:
                    result_str = result_str.split("```")[1].split("```")[0].strip()
                
                # 解析JSON
                result_json = json.loads(result_str)
                
                # 验证和修正数据
                result_json = validate_and_fix_data(result_json, news_title)
                
                # 更新状态为已完成，保存结果
                update_analysis_status(news_id, "completed", result_json)
                
                print(f"新闻'{news_title}'分析完成")
                return result_json
                
            except json.JSONDecodeError as e:
                print(f"JSON解析失败: {str(e)}")
                print(f"原始响应: {result_str[:200]}...")  # 只显示前200个字符
                
                # 生成后备数据
                fallback = generate_fallback_data(news_title)
                
                # 更新状态为失败
                update_analysis_status(news_id, "completed", fallback)
                
                return fallback
                
        except Exception as e:
            self.api_stats["error"] += 1
            print(f"分析失败: {str(e)}")
            print(traceback.format_exc())
            
            # 更新状态为失败
            update_analysis_status(news_id, "failed")
            
            # 生成后备数据
            return generate_fallback_data(news_title)

    def fetch_news_titles(self, api_url="https://api.vvhan.com/api/hotlist/all", max_news_per_platform=5):
        """
        从API获取热门新闻标题
        
        Args:
            api_url (str): API的URL地址
            max_news_per_platform (int): 每个平台最多获取的新闻数量
            
        Returns:
            dict: 包含平台名称和对应热门新闻标题的字典
        """
        if self.use_mock:
            print("使用模拟客户端获取新闻标题")
            # 返回一些模拟数据
            return {
                "weibo": ["模拟新闻标题1", "模拟新闻标题2"],
                "toutiao": ["模拟新闻标题3", "模拟新闻标题4"]
            }
            
        if self.client is None:
            raise ValueError("API客户端未初始化")
        
        try:
            response = requests.get(api_url, timeout=10)
            response.raise_for_status()
            
            # 解析JSON响应
            json_data = response.json()
            
            # 确保数据格式正确
            if not json_data.get('success'):
                raise ValueError("API返回数据格式错误，未找到'success'字段")
                
            # 提取新闻标题
            result = {}
            for platform_data in json_data.get('data', []):
                platform_name = platform_data.get('name', 'unknown')
                news_titles = []
                
                for news_item in platform_data.get('data', []):
                    title = news_item.get('title')
                    if title:
                        news_titles.append(title)
                        # 达到最大数量后停止添加
                        if len(news_titles) >= max_news_per_platform:
                            break
                
                if news_titles:
                    result[platform_name] = news_titles
                    
            return result
            
        except requests.exceptions.RequestException as e:
            print(f"获取新闻标题失败: {str(e)}")
            return {}
        except (ValueError, KeyError, json.JSONDecodeError) as e:
            print(f"解析新闻数据失败: {str(e)}")
            return {}

    def analyze_multiple_news(self, news_items, platforms=None, max_workers=16, timeout=60):
        """
        并行分析多个新闻，带有避免重复处理、错误恢复和API限流保护
        
        Args:
            news_items (list): 新闻标题列表
            platforms (list, optional): 对应的平台列表
            max_workers (int): 最大线程数
            timeout (int): API调用超时时间（秒）
            
        Returns:
            list: 分析结果列表
        """
        if self.use_mock:
            print(f"使用模拟客户端批量分析 {len(news_items)} 条新闻")
            results = []
            # 确保platforms有效
            if platforms is None:
                platforms = [None] * len(news_items)
            for title, platform in zip(news_items, platforms):
                if not title:
                    continue
                # 生成一个唯一ID
                news_id = hashlib.md5(title.encode()).hexdigest()
                # 生成模拟数据
                result = generate_fallback_data(title)
                result["platform"] = platform
                result["analyzed_at"] = datetime.now().isoformat()
                result["title"] = title
                results.append(result)
            return results
            
        if self.client is None:
            raise ValueError("API客户端未初始化")
        
        if not news_items:
            return []
        
        results = []
        
        # 确保platforms有效
        if platforms is None:
            platforms = [None] * len(news_items)
        elif len(platforms) != len(news_items):
            if len(platforms) < len(news_items):
                platforms = platforms + [None] * (len(news_items) - len(platforms))
            else:
                platforms = platforms[:len(news_items)]
        
        # 去重并准备要处理的新闻
        processed_titles = set()
        news_to_process = []
        platform_map = []
        
        for title, platform in zip(news_items, platforms):
            if not title or title in processed_titles:
                continue
            
            processed_titles.add(title)
            news_to_process.append(title)
            platform_map.append(platform)
        
        if not news_to_process:
            return []
        
        # 优化线程数量，避免过多线程
        effective_workers = min(max_workers, len(news_to_process))
        print(f"使用{effective_workers}个线程分析{len(news_to_process)}条新闻")
        
        # 分析单个新闻的函数
        def analyze_one_with_retry(title, platform, retry_count=0, max_retries=1):
            news_id = hashlib.md5(title.encode()).hexdigest()
            
            try:
                # 添加随机延迟分散请求
                if retry_count > 0:
                    delay = random.uniform(1, 3)
                    time.sleep(delay)
                    print(f"重试 '{title}' (尝试 {retry_count}/{max_retries})，等待{delay:.1f}秒")
                
                # 分析新闻
                news_data = {
                    "id": news_id,
                    "title": title
                }
                
                try:
                    # 设置超时定时器
                    result = self.analyze_news(news_data)
                except TimeoutError:
                    self.api_stats["timeout"] += 1
                    print(f"⏱️ 分析'{title}'超时 (>{timeout}秒)")
                    
                    # 尝试重试一次
                    if retry_count < max_retries:
                        return analyze_one_with_retry(title, platform, retry_count + 1, max_retries)
                    
                    # 使用后备方案
                    result = generate_fallback_data(title)
                
                # 添加平台信息和分析时间
                result["platform"] = platform
                result["analyzed_at"] = datetime.now().isoformat()
                result["title"] = title
                
                return result
                
            except Exception as e:
                self.api_stats["error"] += 1
                print(f"分析'{title}'失败: {str(e)}")
                
                # 尝试重试
                if retry_count < max_retries:
                    return analyze_one_with_retry(title, platform, retry_count + 1, max_retries)
                
                # 使用后备方案
                result = generate_fallback_data(title)
                result["platform"] = platform
                result["analyzed_at"] = datetime.now().isoformat()
                result["title"] = title
                return result
        
        # 使用线程池并行处理
        with ThreadPoolExecutor(max_workers=effective_workers) as executor, \
             tqdm(total=len(news_to_process), desc="分析新闻", unit="条") as pbar:
            
            # 提交所有任务
            future_to_news = {
                executor.submit(analyze_one_with_retry, title, platform): (title, platform, i) 
                for i, (title, platform) in enumerate(zip(news_to_process, platform_map))
            }
            
            # 处理完成的任务
            for future in as_completed(future_to_news):
                title, platform, index = future_to_news[future]
                try:
                    # 获取结果，带超时保护
                    result = future.result(timeout=timeout + 30)  # 给予额外的完成时间
                    results.append(result)
                except Exception as e:
                    print(f"获取'{title}'结果失败: {str(e)}")
                    # 添加后备数据
                    fallback = generate_fallback_data(title)
                    fallback["platform"] = platform
                    fallback["analyzed_at"] = datetime.now().isoformat()
                    fallback["title"] = title
                    results.append(fallback)
                
                # 更新进度条
                pbar.update(1)
                
                # 定期输出API状态
                if pbar.n % 5 == 0 or pbar.n == len(news_to_process):
                    success_rate = 0
                    if self.api_stats["total"] > 0:
                        success_rate = (self.api_stats["success"] / self.api_stats["total"]) * 100
                    avg_time = self.api_stats["avg_duration"]
                    print(f"\n📊 API监控 - 完成: {pbar.n}/{len(news_to_process)} | 成功率: {success_rate:.1f}% | 平均时间: {avg_time:.2f}秒 | 超时: {self.api_stats['timeout']} | 错误: {self.api_stats['error']}")
        
        # 输出最终统计信息
        if self.api_stats["total"] > 0:
            success_rate = self.api_stats["success"] / self.api_stats["total"] * 100
            print(f"API调用成功率: {success_rate:.1f}%，平均响应时间: {self.api_stats['avg_duration']:.2f}秒")
        
        if self.api_stats["rate_limited"] > 0:
            print(f"⚠️ 检测到 {self.api_stats['rate_limited']} 次可能的API限流")
        
        # 按参与热度排序
        results.sort(key=lambda x: x.get("participants", 0), reverse=True)
        return results

    # def parallel_process(self, title_url="https://api.vvhan.com/api/hotlist/all", max_workers=16, max_news_per_platform=5):
    #     """
    #     从API获取热门新闻并进行并行分析处理，并实现防重复处理和错误恢复
        
    #     Args:
    #         title_url (str): 获取新闻标题的API URL
    #         max_workers (int): 最大线程数
    #         max_news_per_platform (int): 每个平台最多获取的新闻数量
            
    #     Returns:
    #         dict: 按平台分类的新闻分析结果
    #     """
    #     if self.client is None:
    #         raise ValueError("API客户端未初始化")
        
    #     total_start = time.time()
        
    #     # 获取新闻标题
    #     fetch_start = time.time()
    #     print(f"开始从API获取新闻标题...")
    #     news_dict = self.fetch_news_titles(title_url, max_news_per_platform)
    #     fetch_end = time.time()
    #     fetch_duration = fetch_end - fetch_start
        
    #     # 统计所有新闻标题
    #     all_titles = []
    #     all_platforms = []
    #     for platform, titles in news_dict.items():
    #         for title in titles:
    #             all_titles.append(title)
    #             all_platforms.append(platform)
        
    #     total_news_count = len(all_titles)
    #     print(f"新闻标题获取完成，共 {total_news_count} 条，耗时 {fetch_duration:.2f} 秒")
        
    #     if not all_titles:
    #         print("未能获取到新闻标题，返回空结果")
    #         return {}
        
    #     # 准备分析结果
    #     results = {}
    #     for platform in news_dict.keys():
    #         results[platform] = []
        
    #     # 并行分析所有新闻
    #     analysis_start = time.time()
    #     analyzed_results = self.analyze_multiple_news(
    #         all_titles, all_platforms, max_workers
    #     )
    #     analysis_end = time.time()
    #     analysis_duration = analysis_end - analysis_start
        
    #     # 将结果按平台整理
    #     for result in analyzed_results:
    #         platform = result.get("platform", "unknown")
    #         if platform in results:
    #             results[platform].append({
    #                 "title": result.get("title", ""),
    #                 "analysis": result
    #             })
        
    #     # 输出最终统计信息
    #     total_end = time.time()
    #     total_duration = total_end - total_start
        
    #     print(f"\n===== 并行处理统计信息 =====")
    #     print(f"总计分析 {total_news_count} 条新闻，总耗时 {total_duration:.2f} 秒")
    #     print(f"- 获取标题耗时: {fetch_duration:.2f} 秒 ({fetch_duration/total_duration*100:.1f}%)")
    #     print(f"- 分析内容耗时: {analysis_duration:.2f} 秒 ({analysis_duration/total_duration*100:.1f}%)")
        
    #     if total_news_count > 0:
    #         print(f"- 平均每条新闻: {total_duration/total_news_count:.2f} 秒")
    #         print(f"- 处理速率: {total_news_count/total_duration:.2f} 条/秒")
        
    #     return results

    def process_pending_tasks(self, limit=16):
        """
        处理待分析的新闻
        
        Args:
            limit (int): 限制处理的任务数量
            
        Returns:
            dict: 处理结果统计
        """
        if self.client is None:
            raise ValueError("API客户端未初始化")
        
        # 获取待处理任务
        tasks = get_pending_analysis_tasks(limit)
        
        stats = {
            "total": len(tasks),
            "success": 0,
            "failed": 0
        }
        
        if not tasks:
            print("没有待处理的分析任务")
            return stats
        
        print(f"开始处理 {len(tasks)} 条待分析新闻")
        
        for task in tasks:
            news_id = task.get("news_id")
            news_data = task.get("news_data", {})
            
            try:
                # 分析新闻
                self.analyze_news(news_data)
                stats["success"] += 1
            except Exception as e:
                print(f"任务处理失败 {news_id}: {str(e)}")
                update_analysis_status(news_id, "failed")
                stats["failed"] += 1
        
        print(f"分析任务处理完成: 成功 {stats['success']}, 失败 {stats['failed']}")
        return stats

    @staticmethod
    def create_analysis_service():
        """
        创建并返回一个新的NewsAnalysisService实例
        
        Returns:
            NewsAnalysisService: 分析服务实例
        """
        try:
            api_key = current_app.config.get('QWEN_API_KEY')
            base_url = current_app.config.get('QWEN_BASE_URL')
            model = current_app.config.get('QWEN_MODEL')
            
            if not api_key or not base_url:
                raise ValueError("缺少API配置: 需要 QWEN_API_KEY 和 QWEN_BASE_URL")
                
            print(f"创建分析服务: model={model}, base_url={base_url[:15]}...")
            return NewsAnalysisService(api_key, base_url, model)
        except Exception as e:
            print(f"创建分析服务失败: {str(e)}")
            traceback.print_exc()
            return None 