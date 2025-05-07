"""
测试热搜新闻缓存更新功能
用法: python test_cache_update.py
"""
import os
import sys
from datetime import datetime
import pymongo

# 将当前目录添加到模块搜索路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 创建Flask应用上下文
from app import create_app
app = create_app()

def test_update_cache():
    """测试更新热搜新闻缓存功能"""
    print(f"[{datetime.now()}] 开始测试热搜新闻缓存更新...")
    
    # 导入服务
    from app.services.news_service import NewsService
    from app.extensions import db
    
    # 检查数据库连接
    try:
        with app.app_context():
            # 查看当前集合状态
            hot_news_count = db.hot_news_processed.count_documents({})
            transformed_count = db.transformed_news.count_documents({})
            current_count = db.current_hot_news.count_documents({})
            
            print(f"热搜新闻记录表 (hot_news_processed) 中有 {hot_news_count} 条记录")
            print(f"新闻分析表 (transformed_news) 中有 {transformed_count} 条记录")
            print(f"当前缓存表 (current_hot_news) 中有 {current_count} 条记录")
            
            # 检查最新的热搜记录
            latest_record = db.hot_news_processed.find_one(
                sort=[("timestamp", pymongo.DESCENDING)]
            )
            
            if latest_record:
                print(f"\n最新热搜记录时间戳: {latest_record.get('timestamp')}")
                try:
                    hot_news_data = latest_record.get('data', [{}])[0].get('data', [])
                    print(f"该记录包含 {len(hot_news_data)} 条热搜数据")
                    
                    # 查看前5条热搜
                    if hot_news_data:
                        sorted_news = sorted(hot_news_data, key=lambda x: x.get('heat_sum', 0), reverse=True)
                        top5 = sorted_news[:5]
                        
                        print("\n热搜榜前5条:")
                        for i, news in enumerate(top5, 1):
                            title = news.get('title', 'N/A')
                            heat = news.get('heat_sum', 0)
                            print(f"{i}. {title} (热度: {heat})")
                            
                            # 检查是否有匹配的分析结果
                            if i == 1 and title != 'N/A':
                                analysis = db.transformed_news.find_one(
                                    {"title": title}, 
                                    sort=[("analyzed_at", -1)]
                                )
                                if analysis:
                                    print(f"   - 有匹配的分析结果，分析时间: {analysis.get('analyzed_at')}")
                                else:
                                    print("   - 没有匹配的分析结果")
                except Exception as e:
                    print(f"解析热搜数据时出错: {str(e)}")
                    import traceback
                    traceback.print_exc()
            else:
                print("未找到热搜数据记录")
            
            # 执行缓存更新
            print("\n开始执行缓存更新...")
            result = NewsService.update_current_hot_news(n=10)  # 更新前10条
            
            # 检查更新结果
            print(f"更新结果: {result}")
            
            # 检查更新后的缓存表状态
            new_count = db.current_hot_news.count_documents({})
            print(f"更新后缓存表中有 {new_count} 条记录")
            
            # 如果有数据，打印第一条记录的关键字段
            if new_count > 0:
                sample = db.current_hot_news.find_one({})
                print("\n示例缓存记录字段:")
                for field in ["title", "type", "platform", "analyzed_at"]:
                    if field in sample:
                        value = sample.get(field)
                        if isinstance(value, dict) or isinstance(value, list):
                            value = str(value)[:100] + "..." if len(str(value)) > 100 else value
                        print(f"  - {field}: {value}")
                
            return result
    except Exception as e:
        print(f"测试过程中出错: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    # 运行测试
    result = test_update_cache()
    
    # 显示最终结果
    if result.get("status") == "success":
        print("\n✅ 测试成功！热搜新闻缓存更新正常工作")
        print(f"时间戳: {result.get('timestamp')}")
        print(f"共找到 {result.get('total_hot_news', 0)} 条热搜新闻")
        print(f"匹配到 {result.get('matched_analysis_count', 0)} 条分析结果")
        print(f"更新时间: {result.get('updated_at')}")
    else:
        print("\n❌ 测试失败！请检查错误信息")
        print(f"错误信息: {result.get('message', '未知错误')}") 