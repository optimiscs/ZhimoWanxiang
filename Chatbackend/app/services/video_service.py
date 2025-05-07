import os
import json
import tempfile
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
import subprocess
import re
import requests

import yt_dlp
from pytube import Search, YouTube
import pysrt
from bson import ObjectId
from pymongo import MongoClient

# 获取MongoDB连接
from ..models import db

class VideoService:
    """
    视频服务类，用于根据新闻标题搜索视频，下载音频和字幕，并保存到MongoDB
    """
    
    @staticmethod
    def search_bilibili_videos(news_title: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """
        使用B站API搜索视频
        
        Args:
            news_title: 搜索关键词
            max_results: 最大结果数
            
        Returns:
            视频信息列表
        """
        try:
            url = "https://api.bilibili.com/x/web-interface/search/all/v2"
            params = {
                "keyword": news_title,
                "page": 1,
                "page_size": max_results
            }
            
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Referer": "https://www.bilibili.com/",
                "Accept": "application/json"
            }
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            if response.status_code != 200:
                print(f"B站API响应错误: {response.status_code}")
                return []
            
            data = response.json()
            
            if data['code'] != 0:
                print(f"B站API返回错误: {data['message']}")
                return []
            
            # 提取视频数据
            result_list = []
            for item in data.get('data', {}).get('result', []):
                if item.get('result_type') == 'video':
                    for video in item.get('data', []):
                        video_info = {
                            "title": video.get('title', '').replace('<em class="keyword">', '').replace('</em>', ''),
                            "video_id": str(video.get('aid')),
                            "bvid": video.get('bvid'),
                            "url": f"https://www.bilibili.com/video/{video.get('bvid')}",
                            "channel": video.get('author'),
                            "views": video.get('play', 0),
                            "publish_date": video.get('pubdate', ''),
                            "thumbnail_url": video.get('pic'),
                            "duration": video.get('duration', ''),
                            "source": "bilibili"
                        }
                        result_list.append(video_info)
                        
                        if len(result_list) >= max_results:
                            break
                            
                    if len(result_list) >= max_results:
                        break
            
            # 按播放量排序
            result_list.sort(key=lambda x: x.get('views', 0), reverse=True)
            
            return result_list
        
        except Exception as e:
            print(f"搜索B站视频时出错: {str(e)}")
            return []

    @staticmethod
    def search_video_by_news_title(news_title: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """
        根据新闻标题搜索相关视频，先尝试YouTube，失败后尝试B站
        
        Args:
            news_title: 新闻标题
            max_results: 最大结果数量
            
        Returns:
            包含视频信息的列表
        """
        print(f"搜索与标题相关的视频: {news_title}")
        
        # 首先尝试YouTube
        try:
            videos = VideoService._search_youtube_videos(news_title, max_results)
            if videos:
                return videos
        except Exception as e:
            print(f"YouTube搜索失败: {str(e)}")
        
        # 如果YouTube失败，尝试B站
        print("尝试使用B站搜索视频...")
        bilibili_videos = VideoService.search_bilibili_videos(news_title, max_results)
        
        return bilibili_videos

    @staticmethod
    def _search_youtube_videos(news_title: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """
        使用yt-dlp搜索YouTube视频
        
        Args:
            news_title: 新闻标题
            max_results: 最大结果数
            
        Returns:
            视频信息列表
        """
        try:
            ydl_opts = {
                'quiet': True,
                'extract_flat': True,
                'force_generic_extractor': True,
                'format': 'best',
                'ignoreerrors': True,
                'no_warnings': True,
                'playlistend': max_results + 5  # 多获取几个以防有些获取不到信息
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                # 搜索YouTube
                search_url = f"ytsearch{max_results + 5}:{news_title}"
                info = ydl.extract_info(search_url, download=False)
                
                if 'entries' not in info:
                    print(f"未找到视频: {info}")
                    return []
                
                videos_info = []
                
                # 提取基本信息
                for entry in info['entries']:
                    if entry is None:
                        continue
                    
                    # 从flat info中获取基本信息
                    try:
                        video_id = entry.get('id')
                        if not video_id:
                            continue
                        
                        # 构建简化的视频信息
                        video_info = {
                            "title": entry.get('title'),
                            "video_id": video_id,
                            "url": f"https://www.youtube.com/watch?v={video_id}",
                            "channel": entry.get('uploader', entry.get('channel')),
                            "views": entry.get('view_count', 0),
                            "publish_date": entry.get('upload_date'),
                            "thumbnail_url": entry.get('thumbnail'),
                            "duration": entry.get('duration'),
                            "source": "youtube"
                        }
                        
                        # 仅添加有必要信息的视频
                        if video_info["title"] and video_info["video_id"]:
                            videos_info.append(video_info)
                            
                            # 如果已经获取了足够的视频，停止
                            if len(videos_info) >= max_results:
                                break
                    
                    except Exception as e:
                        print(f"处理视频信息时出错: {str(e)}")
                        continue
                
                # 按播放量排序
                videos_info.sort(key=lambda x: x.get("views", 0), reverse=True)
                
                return videos_info
        
        except Exception as e:
            print(f"搜索YouTube视频时出错: {str(e)}")
            return []

    @staticmethod
    def download_audio_and_subtitles(video_url: str) -> Tuple[Optional[str], Optional[str]]:
        """
        下载视频的音频和字幕
        
        Args:
            video_url: 视频URL
            
        Returns:
            包含音频文件路径和字幕文件路径的元组
        """
        temp_dir = tempfile.mkdtemp()
        audio_output = os.path.join(temp_dir, "audio.mp3")
        subtitle_output = os.path.join(temp_dir, "subtitles")
        
        try:
            # 识别视频平台
            is_bilibili = "bilibili.com" in video_url
            
            # 使用yt-dlp下载音频和字幕
            ydl_opts = {
                'format': 'bestaudio/best',
                'outtmpl': audio_output,
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
                'writeautomaticsub': True,  # 获取自动生成的字幕
                'subtitleslangs': ['zh-Hans', 'zh-CN', 'en'],  # 优先获取中文字幕
                'subtitlesformat': 'srt',
                'skip_download': False,
                'quiet': True,
                'verbose': False,
            }
            
            if is_bilibili:
                # B站特殊处理
                ydl_opts['extractor_args'] = {
                    'bilibili': {
                        'cookies': os.path.join(os.path.dirname(__file__), 'cookies.txt')
                    }
                }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=True)
                
                # 查找字幕文件
                subtitle_files = [f for f in os.listdir(temp_dir) if f.endswith('.srt')]
                subtitle_path = os.path.join(temp_dir, subtitle_files[0]) if subtitle_files else None
                
                if not subtitle_path:
                    print("没有找到字幕文件，尝试使用自动生成的字幕")
                    # 尝试获取自动生成的字幕
                    ydl_opts['writeautomaticsub'] = True
                    ydl_opts['skip_download'] = True
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl2:
                        ydl2.extract_info(video_url, download=True)
                        
                    # 再次查找字幕文件
                    subtitle_files = [f for f in os.listdir(temp_dir) if f.endswith('.srt')]
                    subtitle_path = os.path.join(temp_dir, subtitle_files[0]) if subtitle_files else None
                
                # 如果找不到字幕，尝试其他方式
                if not subtitle_path and is_bilibili:
                    print("尝试直接提取B站视频字幕...")
                    subtitle_path = VideoService._extract_bilibili_subtitle(video_url, temp_dir)
                
            return audio_output, subtitle_path
        
        except Exception as e:
            print(f"下载音频和字幕时出错: {str(e)}")
            return None, None

    @staticmethod
    def _extract_bilibili_subtitle(video_url: str, temp_dir: str) -> Optional[str]:
        """
        直接从B站API提取字幕
        
        Args:
            video_url: B站视频URL
            temp_dir: 临时目录
            
        Returns:
            字幕文件路径
        """
        try:
            # 提取BV号或AV号
            if "BV" in video_url:
                bvid = re.search(r"BV\w+", video_url).group(0)
                params = {"bvid": bvid}
            else:
                aid = re.search(r"av(\d+)", video_url).group(1)
                params = {"aid": aid}
            
            # 获取视频信息
            cid_api = "https://api.bilibili.com/x/web-interface/view"
            r = requests.get(cid_api, params=params, timeout=10)
            if r.status_code != 200:
                print(f"获取B站视频信息失败: {r.status_code}")
                return None
            
            data = r.json()
            if data['code'] != 0:
                print(f"B站API返回错误: {data['message']}")
                return None
            
            cid = data['data']['cid']
            
            # 获取字幕信息
            subtitle_api = f"https://api.bilibili.com/x/player/v2"
            params["cid"] = cid
            r = requests.get(subtitle_api, params=params, timeout=10)
            
            if r.status_code != 200:
                print(f"获取B站字幕信息失败: {r.status_code}")
                return None
            
            subtitle_data = r.json()
            if subtitle_data['code'] != 0:
                print(f"B站字幕API返回错误: {subtitle_data['message']}")
                return None
            
            subtitles = subtitle_data.get('data', {}).get('subtitle', {}).get('subtitles', [])
            
            if not subtitles:
                print("该B站视频没有字幕")
                return None
            
            # 获取第一个字幕
            subtitle_url = "https:" + subtitles[0]['subtitle_url']
            r = requests.get(subtitle_url, timeout=10)
            
            if r.status_code != 200:
                print(f"下载B站字幕失败: {r.status_code}")
                return None
            
            # B站字幕是JSON格式，需要转换为SRT格式
            subtitle_json = r.json()
            subtitle_path = os.path.join(temp_dir, "bilibili_subtitle.srt")
            
            # 转换为SRT格式
            with open(subtitle_path, "w", encoding="utf-8") as f:
                for i, sub in enumerate(subtitle_json.get('body', [])):
                    start_time = VideoService._format_time(float(sub['from']))
                    end_time = VideoService._format_time(float(sub['to']))
                    
                    f.write(f"{i+1}\n")
                    f.write(f"{start_time} --> {end_time}\n")
                    f.write(f"{sub['content']}\n\n")
            
            return subtitle_path
        
        except Exception as e:
            print(f"提取B站字幕时出错: {str(e)}")
            return None

    @staticmethod
    def _format_time(seconds: float) -> str:
        """
        将秒数转换为SRT时间格式
        
        Args:
            seconds: 秒数
            
        Returns:
            SRT格式时间字符串
        """
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millisecs = int((seconds - int(seconds)) * 1000)
        
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millisecs:03d}"

    @staticmethod
    def parse_srt_to_json(srt_file_path: str) -> List[Dict[str, Any]]:
        """
        将SRT字幕文件解析为JSON格式
        
        Args:
            srt_file_path: SRT文件路径
            
        Returns:
            包含字幕信息的JSON列表
        """
        try:
            subtitles = pysrt.open(srt_file_path)
            
            result = []
            for sub in subtitles:
                subtitle_item = {
                    "index": sub.index,
                    "start_time": {
                        "hours": sub.start.hours,
                        "minutes": sub.start.minutes,
                        "seconds": sub.start.seconds,
                        "milliseconds": sub.start.milliseconds,
                        "total_seconds": sub.start.hours * 3600 + sub.start.minutes * 60 + sub.start.seconds + sub.start.milliseconds / 1000
                    },
                    "end_time": {
                        "hours": sub.end.hours,
                        "minutes": sub.end.minutes,
                        "seconds": sub.end.seconds,
                        "milliseconds": sub.end.milliseconds,
                        "total_seconds": sub.end.hours * 3600 + sub.end.minutes * 60 + sub.end.seconds + sub.end.milliseconds / 1000
                    },
                    "text": sub.text,
                    "position": sub.position
                }
                result.append(subtitle_item)
            
            return result
        
        except Exception as e:
            print(f"解析SRT文件时出错: {str(e)}")
            return []

    @staticmethod
    def save_subtitles_to_mongodb(
        video_info: Dict[str, Any], 
        subtitles_json: List[Dict[str, Any]], 
        news_title: str,
        collection_name: str = "video_subtitles"
    ) -> Optional[str]:
        """
        将字幕JSON保存到MongoDB
        
        Args:
            video_info: 视频信息
            subtitles_json: 字幕JSON数据
            news_title: 相关新闻标题
            collection_name: MongoDB集合名称
            
        Returns:
            插入的文档ID
        """
        try:
            # 准备要保存的文档
            document = {
                "news_title": news_title,
                "video_info": video_info,
                "subtitles": subtitles_json,
                "created_at": datetime.utcnow()
            }
            
            # 插入到MongoDB
            result = db[collection_name].insert_one(document)
            
            print(f"字幕数据已保存到MongoDB, ID: {result.inserted_id}")
            return str(result.inserted_id)
        
        except Exception as e:
            print(f"保存到MongoDB失败: {str(e)}")
            return None

    @staticmethod
    def process_news_video(news_title: str, platform: str = 'all') -> Dict[str, Any]:
        """
        处理新闻视频的完整流程
        
        Args:
            news_title: 新闻标题
            platform: 指定平台 ('youtube', 'bilibili', 'all')
            
        Returns:
            处理结果
        """
        try:
            # 1. 搜索相关视频
            if platform == 'youtube':
                videos = VideoService._search_youtube_videos(news_title)
            elif platform == 'bilibili':
                videos = VideoService.search_bilibili_videos(news_title)
            else:
                videos = VideoService.search_video_by_news_title(news_title)
            
            if not videos:
                return {"success": False, "message": "未找到相关视频", "platform": platform}
            
            # 选择播放量最高的视频
            top_video = videos[0]
            
            # 2. 下载音频和字幕
            audio_path, subtitle_path = VideoService.download_audio_and_subtitles(top_video["url"])
            
            if not audio_path or not subtitle_path:
                return {
                    "success": False, 
                    "message": "下载音频或字幕失败", 
                    "video_info": top_video,
                    "platform": platform
                }
            
            # 3. 解析字幕为JSON
            subtitles_json = VideoService.parse_srt_to_json(subtitle_path)
            
            if not subtitles_json:
                return {
                    "success": False, 
                    "message": "解析字幕失败", 
                    "video_info": top_video, 
                    "audio_path": audio_path,
                    "subtitle_path": subtitle_path,
                    "platform": platform
                }
            
            # 4. 保存到MongoDB
            doc_id = VideoService.save_subtitles_to_mongodb(top_video, subtitles_json, news_title)
            
            if not doc_id:
                return {
                    "success": False, 
                    "message": "保存到MongoDB失败", 
                    "video_info": top_video,
                    "subtitles_count": len(subtitles_json),
                    "platform": platform
                }
            
            # 清理临时文件
            try:
                os.remove(audio_path)
                os.remove(subtitle_path)
            except:
                pass
            
            return {
                "success": True,
                "message": "处理成功",
                "video_info": top_video,
                "subtitles_count": len(subtitles_json),
                "mongodb_id": doc_id,
                "platform": platform
            }
            
        except Exception as e:
            print(f"处理视频时出错: {str(e)}")
            return {"success": False, "message": f"处理视频时出错: {str(e)}", "platform": platform} 